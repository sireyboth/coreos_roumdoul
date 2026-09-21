<?php

namespace Tests\Feature\Api;

use App\Models\Branch;
use App\Models\Employee;
use App\Models\Schedule;
use App\Models\Shift;
use App\Services\CompanyProvisioner;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

class EmployeePhotoTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    private $company;

    private $admin;

    private int $employeeId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        Storage::fake('local');

        $this->company = app(CompanyProvisioner::class)->provision('Photo Co', 'Boss', 'boss@photo.test', 'password123');
        $this->admin = $this->company->users()->first();
        $branch = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'HQ']);

        $this->employeeId = $this->as($this->admin)->postJson('/api/employees', ['name' => 'Dara', 'branch_id' => $branch->id])
            ->assertCreated()->json('id');
    }

    private function as($user)
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user);
    }

    private function upload(?UploadedFile $file = null, $as = null, ?int $employeeId = null)
    {
        return $this->as($as ?? $this->admin)->post(
            '/api/employees/'.($employeeId ?? $this->employeeId).'/photo',
            ['photo' => $file ?? UploadedFile::fake()->image('me.png', 900, 600)],
            ['Accept' => 'application/json'],
        );
    }

    private function photoUrl(): ?string
    {
        return $this->as($this->admin)->getJson("/api/employees/{$this->employeeId}")->json('photo_url');
    }

    public function test_a_photo_is_stored_privately_as_a_small_square_jpeg_and_only_a_signed_link_is_exposed(): void
    {
        $url = $this->upload()->assertOk()->json('photo_url');

        $this->assertNotNull($url);
        $this->assertStringStartsWith('/api/employees/', $url);
        $this->assertStringContainsString('signature=', $url);

        $path = Employee::query()->findOrFail($this->employeeId)->photo_path;
        Storage::disk('local')->assertExists($path);
        $this->assertStringStartsWith("employee-photos/{$this->company->id}/", $path);

        [$width, $height, $type] = getimagesizefromstring(Storage::disk('local')->get($path));
        $this->assertSame([512, 512, IMAGETYPE_JPEG], [$width, $height, $type]);

        // The internal path never appears in any response.
        $json = $this->as($this->admin)->getJson('/api/employees')->assertOk()->getContent();
        $this->assertStringNotContainsString($path, $json);
        $this->assertStringNotContainsString('photo_path', $json);
    }

    public function test_the_signed_link_serves_the_image_without_a_login_but_a_tampered_one_does_not(): void
    {
        $this->upload()->assertOk();
        $url = $this->photoUrl();

        $this->app['auth']->forgetGuards();
        $response = $this->get($url)->assertOk();
        $this->assertSame('image/jpeg', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('nosniff', $response->headers->get('X-Content-Type-Options'));

        // Same link for a different employee, or with the signature altered, is refused.
        $this->get(str_replace("/employees/{$this->employeeId}/", '/employees/'.($this->employeeId + 1).'/', $url))->assertForbidden();
        $this->get(preg_replace('/signature=[^&]+/', 'signature=deadbeef', $url))->assertForbidden();
        $this->get("/api/employees/{$this->employeeId}/photo")->assertForbidden();
    }

    public function test_links_expire(): void
    {
        $this->upload()->assertOk();
        $url = $this->photoUrl();

        $this->get($url)->assertOk();

        $this->travel(14)->hours();
        $this->get($url)->assertForbidden();
    }

    public function test_replacing_or_removing_the_photo_kills_the_old_link_and_deletes_the_old_file(): void
    {
        $this->upload()->assertOk();
        $oldPath = Employee::query()->findOrFail($this->employeeId)->photo_path;
        $oldUrl = $this->photoUrl();

        $this->upload(UploadedFile::fake()->image('new.jpg', 600, 600))->assertOk();
        $newPath = Employee::query()->findOrFail($this->employeeId)->photo_path;

        $this->assertNotSame($oldPath, $newPath);
        Storage::disk('local')->assertMissing($oldPath);
        $this->app['auth']->forgetGuards();
        $this->get($oldUrl)->assertNotFound();

        $this->as($this->admin)->deleteJson("/api/employees/{$this->employeeId}/photo")->assertNoContent();
        Storage::disk('local')->assertMissing($newPath);
        $this->assertNull($this->photoUrl());
    }

    public function test_only_people_who_manage_employees_can_change_a_photo_but_others_can_see_it(): void
    {
        $this->upload()->assertOk();
        $staff = $this->createUserWithRole($this->company, 'employee');

        $this->upload(null, $staff)->assertForbidden();
        $this->as($staff)->deleteJson("/api/employees/{$this->employeeId}/photo")->assertForbidden();

        // A staff member with normal access still gets the link, so avatars show for everyone.
        $listed = collect($this->as($staff)->getJson('/api/employees')->assertOk()->json('data'))->firstWhere('id', $this->employeeId);
        $this->assertNotNull($listed['photo_url']);
    }

    public function test_files_that_are_not_real_photos_are_rejected(): void
    {
        $this->upload(UploadedFile::fake()->create('notes.pdf', 50, 'application/pdf'))->assertStatus(422)->assertJsonValidationErrors('photo');
        $this->upload(UploadedFile::fake()->createWithContent('evil.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))
            ->assertStatus(422)->assertJsonValidationErrors('photo');
        // Text renamed to .png passes the extension check but is not decodable.
        $this->upload(UploadedFile::fake()->createWithContent('fake.png', '<?php echo "hi"; ?>'))->assertStatus(422)->assertJsonValidationErrors('photo');

        $this->assertNull(Employee::query()->findOrFail($this->employeeId)->photo_path);
    }

    public function test_another_companys_admin_cannot_touch_this_employees_photo(): void
    {
        $rival = app(CompanyProvisioner::class)->provision('Rival', 'Rival', 'boss@rival.test', 'password123');

        $this->upload(null, $rival->users()->first())->assertNotFound();
        // Read unscoped: the test session is now the rival, who (rightly) can't see this employee.
        $this->assertNull(Employee::query()->withoutGlobalScopes()->findOrFail($this->employeeId)->photo_path);
    }

    public function test_the_photo_link_shows_up_wherever_the_employee_is_nested_too(): void
    {
        $this->upload()->assertOk();
        $employee = Employee::query()->findOrFail($this->employeeId);
        $shift = Shift::query()->create([
            'company_id' => $this->company->id, 'name' => 'Day', 'start_time' => '08:00', 'end_time' => '17:00', 'break_minutes' => 0, 'grace_minutes' => 0,
        ]);
        Schedule::query()->create(['company_id' => $this->company->id, 'employee_id' => $employee->id, 'shift_id' => $shift->id, 'date' => '2026-09-22']);

        $row = $this->as($this->admin)->getJson('/api/schedules?from=2026-09-01&to=2026-09-30')->assertOk()->json('data.0');
        $this->assertNotNull($row['employee']['photo_url']);
        $this->assertArrayNotHasKey('photo_path', $row['employee']);
    }

    public function test_the_roster_can_be_filtered_to_one_employee(): void
    {
        $other = Employee::query()->create(['company_id' => $this->company->id, 'name' => 'Other']);
        $shift = Shift::query()->create([
            'company_id' => $this->company->id, 'name' => 'Day', 'start_time' => '08:00', 'end_time' => '17:00', 'break_minutes' => 0, 'grace_minutes' => 0,
        ]);
        foreach ([$this->employeeId, $other->id] as $id) {
            Schedule::query()->create(['company_id' => $this->company->id, 'employee_id' => $id, 'shift_id' => $shift->id, 'date' => '2026-09-22']);
        }

        $rows = $this->as($this->admin)->getJson("/api/schedules?from=2026-09-01&to=2026-09-30&employee_id={$this->employeeId}")->assertOk()->json('data');

        $this->assertCount(1, $rows);
        $this->assertSame($this->employeeId, $rows[0]['employee_id']);
    }
}
