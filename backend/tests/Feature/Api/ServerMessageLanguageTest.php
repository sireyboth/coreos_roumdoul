<?php

namespace Tests\Feature\Api;

use App\Services\Company\CompanyProvisioner;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The app sends its chosen language as Accept-Language (SetLocaleFromRequest),
 * so server messages come back in Khmer or English to match the screen:
 * our own __() messages from lang/km.json, Laravel's form checks from
 * lang/km/validation.php.
 */
class ServerMessageLanguageTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
        app(CompanyProvisioner::class)->provision('Acme', 'Boss', 'boss@acme.test', 'password123');
    }

    private function wrongPassword(?string $language)
    {
        return $this->withHeaders($language ? ['Accept-Language' => $language] : [])
            ->postJson('/api/auth/login', ['email' => 'boss@acme.test', 'password' => 'not-it']);
    }

    public function test_our_own_messages_follow_the_language_sent(): void
    {
        $this->wrongPassword('km')->assertUnprocessable()
            ->assertJsonPath('errors.email.0', 'ព័ត៌មានចូលប្រព័ន្ធមិនត្រឹមត្រូវទេ។');

        $this->wrongPassword('en')->assertUnprocessable()
            ->assertJsonPath('errors.email.0', 'These credentials do not match our records.');
    }

    public function test_no_language_or_an_unknown_one_gets_english(): void
    {
        $this->wrongPassword(null)->assertJsonPath('errors.email.0', 'These credentials do not match our records.');
        $this->wrongPassword('fr')->assertJsonPath('errors.email.0', 'These credentials do not match our records.');
    }

    public function test_laravel_form_checks_use_khmer_field_names(): void
    {
        $this->withHeaders(['Accept-Language' => 'km'])
            ->postJson('/api/auth/login', ['email' => 'boss@acme.test'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.password.0', 'សូមបំពេញ ពាក្យសម្ងាត់។');
    }

    public function test_placeholders_are_filled_in_khmer_too(): void
    {
        // :month and friends stay as placeholders in km.json and are filled in at runtime.
        app()->setLocale('km');
        $this->assertSame(':month ត្រូវបានចាក់សោរួចហើយ។', __(':month is already locked.'));
        $this->assertSame('មករា 2026 ត្រូវបានចាក់សោរួចហើយ។', __(':month is already locked.', ['month' => 'មករា 2026']));
    }
}
