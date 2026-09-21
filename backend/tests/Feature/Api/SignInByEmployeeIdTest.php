<?php

namespace Tests\Feature\Api;

use App\Models\Branch;
use App\Models\Company;
use App\Models\CompanyMembership;
use App\Models\Employee;
use App\Models\User;
use App\Services\CompanyProvisioner;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\Concerns\CreatesCompanyUsers;
use Tests\TestCase;

/**
 * An employee can be given a login that uses EITHER their email OR their
 * employee ID (with the company code) — never both.
 */
class SignInByEmployeeIdTest extends TestCase
{
    use CreatesCompanyUsers, RefreshDatabase;

    private Company $company;

    private $admin;

    private Branch $branch;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        RateLimiter::clear('x');

        $this->company = app(CompanyProvisioner::class)->provision('Acme', 'Boss', 'boss@acme.test', 'password123');
        $this->admin = $this->company->users()->first();
        $this->branch = Branch::query()->create(['company_id' => $this->company->id, 'name' => 'HQ']);
    }

    private function as($user)
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user);
    }

    private function addEmployee(array $extra = [], ?Company $in = null, $by = null, ?Branch $branch = null)
    {
        $in ??= $this->company;

        return $this->as($by ?? $this->admin)->postJson('/api/employees', $extra + [
            'name' => 'Sokha', 'branch_id' => ($branch ?? $this->branch)->id,
        ]);
    }

    private function signIn(array $credentials)
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/auth/login', $credentials + ['password' => 'secret-pass-1']);
    }

    public function test_an_employee_can_be_given_an_employee_id_login_with_no_email_at_all(): void
    {
        $response = $this->addEmployee([
            'employee_code' => 'E-001', 'login_method' => 'employee_id', 'password' => 'secret-pass-1',
        ])->assertCreated()->assertJsonPath('has_login', true);

        $user = User::query()->findOrFail(Employee::query()->findOrFail($response->json('id'))->user_id);
        $this->assertNull($user->email);
        $this->assertSame('e-001', $user->membership->login_id);
        // Same defaults as any employee login: the employee role, limited to their own branch.
        $this->assertSame('employee', $user->membership->roles()->first()->name);
        $this->assertSame([$this->branch->id], $user->membership->accessibleBranchIds());

        // The manager is told how this person signs in.
        $response->assertJsonPath('login.method', 'employee_id')
            ->assertJsonPath('login.identifier', 'E-001')
            ->assertJsonPath('login.company_code', $this->company->slug);
    }

    public function test_they_sign_in_with_company_code_and_employee_id_and_get_a_working_session(): void
    {
        $this->addEmployee(['employee_code' => 'E-001', 'login_method' => 'employee_id', 'password' => 'secret-pass-1'])->assertCreated();

        $token = $this->signIn(['company' => $this->company->slug, 'employee_id' => 'E-001'])->assertOk()->json('token');
        $this->assertNotEmpty($token);

        $this->app['auth']->forgetGuards();
        $me = $this->getJson('/api/me', ['Authorization' => "Bearer {$token}"])->assertOk();
        $me->assertJsonPath('employee.name', 'Sokha')->assertJsonPath('user.login_id', 'e-001')->assertJsonPath('user.email', null);
        $this->assertSame($this->company->slug, $me->json('company.slug'));
    }

    public function test_the_employee_id_and_company_code_ignore_letter_case_and_spaces(): void
    {
        $this->addEmployee(['employee_code' => 'E-001', 'login_method' => 'employee_id', 'password' => 'secret-pass-1'])->assertCreated();

        $this->signIn(['company' => '  '.strtoupper($this->company->slug).' ', 'employee_id' => ' e-001 '])->assertOk();
    }

    public function test_the_email_option_still_works_exactly_as_before(): void
    {
        $this->addEmployee(['email' => 'dara@acme.test', 'password' => 'secret-pass-1'])->assertCreated();
        $this->addEmployee(['name' => 'Vanna', 'email' => 'vanna@acme.test', 'login_method' => 'email', 'password' => 'secret-pass-1'])->assertCreated();

        $this->signIn(['email' => 'dara@acme.test'])->assertOk();
        $this->signIn(['email' => 'vanna@acme.test'])->assertOk();
        // And an email login has no employee ID sign-in.
        $this->assertNull(User::query()->where('email', 'dara@acme.test')->first()->membership->login_id);
    }

    public function test_only_one_way_can_be_chosen_when_creating_and_when_signing_in(): void
    {
        // Creating: the chosen method's requirement must be met, and the other is not needed.
        $this->addEmployee(['login_method' => 'employee_id', 'password' => 'secret-pass-1'])
            ->assertStatus(422)->assertJsonValidationErrors('employee_code');
        $this->addEmployee(['login_method' => 'email', 'password' => 'secret-pass-1'])
            ->assertStatus(422)->assertJsonValidationErrors('email');

        // Signing in: supplying both an email and an ID is refused, not guessed at.
        $this->addEmployee(['employee_code' => 'E-001', 'login_method' => 'employee_id', 'password' => 'secret-pass-1'])->assertCreated();
        $this->signIn(['email' => 'boss@acme.test', 'company' => $this->company->slug, 'employee_id' => 'E-001'])
            ->assertStatus(422)->assertJsonValidationErrors('email');
        $this->signIn(['employee_id' => 'E-001'])->assertStatus(422)->assertJsonValidationErrors('company');
        $this->signIn([])->assertStatus(422);
    }

    public function test_two_companies_can_use_the_same_employee_id_without_mixing_up(): void
    {
        $other = app(CompanyProvisioner::class)->provision('Beta', 'Owner', 'owner@beta.test', 'password123');
        $otherBranch = Branch::query()->create(['company_id' => $other->id, 'name' => 'HQ']);

        $this->addEmployee(['name' => 'Acme Sokha', 'employee_code' => 'E-001', 'login_method' => 'employee_id', 'password' => 'secret-pass-1'])->assertCreated();
        $this->addEmployee(['name' => 'Beta Bora', 'employee_code' => 'E-001', 'login_method' => 'employee_id', 'password' => 'other-pass-22'], $other, $other->users()->first(), $otherBranch)->assertCreated();

        $acme = $this->signIn(['company' => $this->company->slug, 'employee_id' => 'E-001'])->assertOk()->json('token');
        $beta = $this->signIn(['company' => $other->slug, 'employee_id' => 'E-001', 'password' => 'other-pass-22'])->assertOk()->json('token');

        $this->app['auth']->forgetGuards();
        $this->assertSame('Acme Sokha', $this->getJson('/api/me', ['Authorization' => "Bearer {$acme}"])->json('employee.name'));
        $this->app['auth']->forgetGuards();
        $this->assertSame('Beta Bora', $this->getJson('/api/me', ['Authorization' => "Bearer {$beta}"])->json('employee.name'));

        // Acme's password does not open Beta's account, or the other way round.
        $this->signIn(['company' => $other->slug, 'employee_id' => 'E-001'])->assertStatus(422);
        $this->signIn(['company' => $this->company->slug, 'employee_id' => 'E-001', 'password' => 'other-pass-22'])->assertStatus(422);
    }

    public function test_every_failure_looks_the_same_so_nothing_reveals_which_accounts_exist(): void
    {
        $this->addEmployee(['employee_code' => 'E-001', 'login_method' => 'employee_id', 'password' => 'secret-pass-1'])->assertCreated();

        $wrongPassword = $this->signIn(['company' => $this->company->slug, 'employee_id' => 'E-001', 'password' => 'nope-nope-1']);
        $unknownId = $this->signIn(['company' => $this->company->slug, 'employee_id' => 'E-999']);
        $unknownCompany = $this->signIn(['company' => 'no-such-company', 'employee_id' => 'E-001']);

        foreach ([$wrongPassword, $unknownId, $unknownCompany] as $response) {
            $response->assertStatus(422)->assertJsonPath('errors.employee_id.0', 'These credentials do not match our records.');
        }
    }

    public function test_deactivated_accounts_and_suspended_companies_are_blocked_for_id_logins_too(): void
    {
        $id = $this->addEmployee(['employee_code' => 'E-001', 'login_method' => 'employee_id', 'password' => 'secret-pass-1'])->json('id');
        $user = User::query()->findOrFail(Employee::query()->findOrFail($id)->user_id);

        $user->update(['is_active' => false]);
        $this->signIn(['company' => $this->company->slug, 'employee_id' => 'E-001'])
            ->assertStatus(422)->assertJsonPath('errors.employee_id.0', 'This account has been deactivated.');

        $user->update(['is_active' => true]);
        $this->company->update(['status' => 'suspended']);
        $this->signIn(['company' => $this->company->slug, 'employee_id' => 'E-001'])->assertStatus(422);
    }

    public function test_an_employee_id_can_only_sign_in_one_person_per_company(): void
    {
        $this->addEmployee(['employee_code' => 'E-001', 'login_method' => 'employee_id', 'password' => 'secret-pass-1'])->assertCreated();

        // Same code again (any letter case): refused, whether by the code rule or the sign-in rule.
        $this->addEmployee(['name' => 'Copy', 'employee_code' => 'e-001', 'login_method' => 'employee_id', 'password' => 'secret-pass-1'])
            ->assertStatus(422)->assertJsonValidationErrors('employee_code');

        $this->assertSame(1, CompanyMembership::query()->where('company_id', $this->company->id)->where('login_id', 'e-001')->count());
    }

    public function test_an_existing_employee_can_be_given_either_kind_of_login_later(): void
    {
        $withCode = $this->addEmployee(['name' => 'Has Code', 'employee_code' => 'E-010'])->json('id');
        $noCode = $this->addEmployee(['name' => 'No Code'])->json('id');
        $emailOnly = $this->addEmployee(['name' => 'Email Person'])->json('id');

        // Existing code becomes the ID; it can't be swapped for another one silently.
        $this->as($this->admin)->postJson("/api/employees/{$withCode}/login", ['login_method' => 'employee_id', 'employee_code' => 'E-999', 'password' => 'secret-pass-1'])
            ->assertStatus(422)->assertJsonValidationErrors('employee_code');
        $this->as($this->admin)->postJson("/api/employees/{$withCode}/login", ['login_method' => 'employee_id', 'employee_code' => 'E-010', 'password' => 'secret-pass-1'])
            ->assertOk()->assertJsonPath('login.identifier', 'E-010');

        // No code yet: one is supplied and saved on the employee.
        $this->as($this->admin)->postJson("/api/employees/{$noCode}/login", ['login_method' => 'employee_id', 'employee_code' => 'E-020', 'password' => 'secret-pass-1'])->assertOk();
        $this->assertSame('E-020', Employee::query()->findOrFail($noCode)->employee_code);

        // The email option keeps working, and needs its email.
        $this->as($this->admin)->postJson("/api/employees/{$emailOnly}/login", ['password' => 'secret-pass-1'])->assertStatus(422)->assertJsonValidationErrors('email');
        $this->as($this->admin)->postJson("/api/employees/{$emailOnly}/login", ['email' => 'em@acme.test', 'password' => 'secret-pass-1'])
            ->assertOk()->assertJsonPath('login.method', 'email')->assertJsonPath('login.identifier', 'em@acme.test');

        $this->signIn(['company' => $this->company->slug, 'employee_id' => 'E-010'])->assertOk();
        $this->signIn(['company' => $this->company->slug, 'employee_id' => 'E-020'])->assertOk();
        $this->signIn(['email' => 'em@acme.test'])->assertOk();
    }

    public function test_the_users_list_shows_the_employee_id_for_accounts_without_an_email(): void
    {
        $this->addEmployee(['employee_code' => 'E-001', 'login_method' => 'employee_id', 'password' => 'secret-pass-1'])->assertCreated();

        $row = collect($this->as($this->admin)->getJson('/api/users')->assertOk()->json())->firstWhere('login_id', 'e-001');

        $this->assertNotNull($row);
        $this->assertNull($row['email']);
    }

    public function test_someone_without_an_email_can_still_edit_their_profile_and_add_one_later(): void
    {
        $id = $this->addEmployee(['employee_code' => 'E-001', 'login_method' => 'employee_id', 'password' => 'secret-pass-1'])->json('id');
        $user = User::query()->findOrFail(Employee::query()->findOrFail($id)->user_id);

        $this->as($user)->putJson('/api/profile', ['name' => 'Sokha Renamed'])->assertOk()->assertJsonPath('name', 'Sokha Renamed');
        $this->as($user)->putJson('/api/profile', ['name' => 'Sokha Renamed', 'email' => 'sokha@acme.test'])->assertOk()->assertJsonPath('email', 'sokha@acme.test');

        // An email-only account still can't blank its email (it would lock them out).
        $emailUser = $this->company->users()->first();
        $this->as($emailUser)->putJson('/api/profile', ['name' => 'Boss'])->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_many_accounts_can_have_no_email_at_once(): void
    {
        $this->addEmployee(['name' => 'One', 'employee_code' => 'E-001', 'login_method' => 'employee_id', 'password' => 'secret-pass-1'])->assertCreated();
        $this->addEmployee(['name' => 'Two', 'employee_code' => 'E-002', 'login_method' => 'employee_id', 'password' => 'secret-pass-1'])->assertCreated();

        $this->assertSame(2, User::query()->whereNull('email')->count());
    }

    public function test_repeated_failed_sign_ins_are_slowed_down(): void
    {
        $this->addEmployee(['employee_code' => 'E-001', 'login_method' => 'employee_id', 'password' => 'secret-pass-1'])->assertCreated();

        $statuses = [];
        foreach (range(1, 10) as $ignored) {
            $statuses[] = $this->signIn(['company' => $this->company->slug, 'employee_id' => 'E-001', 'password' => 'wrong-wrong-1'])->status();
        }

        $this->assertSame([422, 422, 422, 422, 422, 422, 422, 422, 429, 429], $statuses);

        // The message is one a person can act on.
        $this->signIn(['company' => $this->company->slug, 'employee_id' => 'E-001'])
            ->assertStatus(429)->assertJsonPath('message', 'Too many sign-in attempts. Please wait a minute and try again.');

        // A different person on the same device isn't blocked by that one person's attempts.
        $this->signIn(['email' => 'boss@acme.test', 'password' => 'password123'])->assertOk();
    }

    public function test_signing_in_never_depends_on_the_default_cache_being_up(): void
    {
        $this->addEmployee(['employee_code' => 'E-001', 'login_method' => 'employee_id', 'password' => 'secret-pass-1'])->assertCreated();

        // Simulate a server whose Redis is down: the default cache points at nothing.
        config([
            'cache.default' => 'redis',
            'cache.stores.redis' => ['driver' => 'redis', 'connection' => 'cache'],
            'database.redis.client' => 'predis',
            'database.redis.cache' => ['host' => '127.0.0.1', 'port' => 1, 'timeout' => 0.2],
        ]);
        app('cache')->forgetDriver('redis');

        // The attempt counters live in the database, so sign-in still works — and is still limited.
        $this->signIn(['company' => $this->company->slug, 'employee_id' => 'E-001'])->assertOk();
        $this->assertSame('database', config('cache.limiter'));
    }

    public function test_the_employee_id_someone_signs_in_with_cannot_be_changed_from_their_profile(): void
    {
        $id = $this->addEmployee(['employee_code' => 'E-001', 'login_method' => 'employee_id', 'password' => 'secret-pass-1', 'email' => 'contact@acme.test'])->json('id');

        // Their contact email is only a detail and stays editable...
        $this->as($this->admin)->putJson("/api/employees/{$id}", ['email' => 'new-contact@acme.test'])->assertOk();
        // ...and re-saving the same ID (any letter case) is fine, since nothing changes.
        $this->as($this->admin)->putJson("/api/employees/{$id}", ['employee_code' => 'E-001'])->assertOk();
        // But swapping or clearing the ID would leave their sign-in pointing at nothing.
        $this->as($this->admin)->putJson("/api/employees/{$id}", ['employee_code' => 'E-777'])->assertStatus(422)->assertJsonValidationErrors('employee_code');
        $this->as($this->admin)->putJson("/api/employees/{$id}", ['employee_code' => null])->assertStatus(422)->assertJsonValidationErrors('employee_code');

        $this->signIn(['company' => $this->company->slug, 'employee_id' => 'E-001'])->assertOk();

        // Someone who signs in by email is unaffected: their code can change freely.
        $emailPerson = $this->addEmployee(['name' => 'By Email', 'email' => 'byemail@acme.test', 'password' => 'secret-pass-1', 'employee_code' => 'E-050'])->json('id');
        $this->as($this->admin)->putJson("/api/employees/{$emailPerson}", ['employee_code' => 'E-051'])->assertOk();
    }
}
