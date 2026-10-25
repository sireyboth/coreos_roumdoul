<?php

namespace Database\Factories;

use App\Models\PlatformAdmin;
use App\Models\PlatformRole;
use App\Support\PlatformPermissions;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * @extends Factory<PlatformAdmin>
 */
class PlatformAdminFactory extends Factory
{
    protected static ?string $password;

    protected $model = PlatformAdmin::class;

    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'password' => static::$password ??= Hash::make('password'),
            'status' => 'active',
            'email_verified_at' => now(),
        ];
    }

    /** A super-admin unless told otherwise, like the admins made with platform:make-admin. */
    public function configure(): static
    {
        return $this->afterCreating(function (PlatformAdmin $admin) {
            $role = PlatformRole::query()->where('code', PlatformPermissions::SUPER_ADMIN)->first();
            if ($role && ! $admin->roles()->exists()) {
                $admin->roles()->attach($role);
            }
        });
    }

    /** No platform role at all: can sign in, but open nothing. */
    public function withoutRoles(): static
    {
        return $this->afterCreating(fn (PlatformAdmin $admin) => $admin->roles()->detach());
    }
}
