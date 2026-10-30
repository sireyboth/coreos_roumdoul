<?php

namespace Tests\Feature\Api\Account;

use App\Models\Branch;
use App\Models\Employee;
use App\Services\Company\CompanyProvisioner;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

/** Employees set their own photo from their profile, without HR. */
class ProfilePhotoTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    private $company;

    private $staff;

    private Employee $own;

    private Employee $colleague;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        Storage::fake('s3');

        $this->company = app(CompanyProvisioner::class)->provision('Photo Co', 'Boss', 'boss@photo.test', 'password123');
        $branch = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'HQ']);

        // A plain staff member: no employees.manage permission.
        $this->staff = $this->createUserWithRole($this->company, 'employee');
        $this->own = Employee::query()->create(['company_id' => $this->company->id, 'branch_id' => $branch->id, 'name' => 'Dara', 'user_id' => $this->staff->id]);
        $this->colleague = Employee::query()->create(['company_id' => $this->company->id, 'branch_id' => $branch->id, 'name' => 'Sok']);
    }

    private function upload(?UploadedFile $file = null)
    {
        return $this->actingAs($this->staff)->post(
            '/api/profile/photo',
            ['photo' => $file ?? UploadedFile::fake()->image('me.png', 900, 600)],
            ['Accept' => 'application/json'],
        );
    }

    public function test_an_employee_can_set_their_own_photo_without_hr_permission(): void
    {
        $url = $this->upload()->assertOk()->json('photo_url');

        $this->assertStringContainsString('signature=', $url);
        $path = $this->own->fresh()->photo_path;
        $this->assertStringStartsWith("employee-photos/{$this->company->id}/{$this->own->id}-", $path);
        [$width, $height, $type] = getimagesizefromstring(Storage::disk('s3')->get($path));
        $this->assertSame([512, 512, IMAGETYPE_JPEG], [$width, $height, $type]);

        // The colleague is untouched, and the HR route stays closed to staff.
        $this->assertNull($this->colleague->fresh()->photo_path);
        $this->actingAs($this->staff)->post("/api/employees/{$this->colleague->id}/photo", [
            'photo' => UploadedFile::fake()->image('x.png'),
        ], ['Accept' => 'application/json'])->assertForbidden();

        // /me carries the link, so the profile page can show it; v1 works too.
        $this->actingAs($this->staff)->getJson('/api/v1/me')->assertOk()->assertJsonPath('employee.id', $this->own->id);
        $this->assertNotNull($this->actingAs($this->staff)->getJson('/api/me')->json('employee.photo_url'));
    }

    public function test_replacing_or_removing_their_photo_deletes_the_old_file(): void
    {
        $this->upload()->assertOk();
        $first = $this->own->fresh()->photo_path;

        $this->upload(UploadedFile::fake()->image('new.jpg', 600, 600))->assertOk();
        $second = $this->own->fresh()->photo_path;
        Storage::disk('s3')->assertMissing($first);

        $this->actingAs($this->staff)->deleteJson('/api/v1/profile/photo')->assertNoContent();
        Storage::disk('s3')->assertMissing($second);
        $this->assertNull($this->own->fresh()->photo_path);
        $this->assertNull($this->actingAs($this->staff)->getJson('/api/me')->json('employee.photo_url'));
    }

    public function test_files_that_are_not_real_photos_are_rejected(): void
    {
        $this->upload(UploadedFile::fake()->createWithContent('fake.png', '<?php echo "hi"; ?>'))
            ->assertStatus(422)->assertJsonValidationErrors('photo');

        $this->assertNull($this->own->fresh()->photo_path);
    }

    public function test_an_account_without_an_employee_record_gets_a_clear_error(): void
    {
        $owner = $this->company->users()->first();

        $this->actingAs($owner)->post('/api/profile/photo', ['photo' => UploadedFile::fake()->image('me.png')], ['Accept' => 'application/json'])
            ->assertNotFound()->assertJsonPath('code', 'no_employee_record');
    }
}
