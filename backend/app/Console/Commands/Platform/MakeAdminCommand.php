<?php

namespace App\Console\Commands\Platform;

use App\Models\PlatformAdmin;
use App\Models\PlatformRole;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

class MakeAdminCommand extends Command
{
    protected $signature = 'platform:make-admin
        {--name= : The admin\'s name}
        {--email= : The admin\'s email}
        {--password= : The admin\'s password}
        {--role=super-admin : The platform role code they get (what they can do in the panel)}';

    protected $description = 'Create a Platform Admin account for the Filament panel (replaces make:filament-user, which creates a tenant User instead)';

    public function handle(): int
    {
        $name = $this->option('name') ?? $this->ask('Name');
        $email = $this->option('email') ?? $this->ask('Email');
        $password = $this->option('password') ?? $this->secret('Password');

        $validator = Validator::make(
            compact('name', 'email', 'password'),
            [
                'name' => ['required', 'string', 'max:255'],
                'email' => ['required', 'email', 'max:255', 'unique:platform_admins,email'],
                'password' => ['required', 'string', 'min:8'],
            ],
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        // Without a role an admin can sign in but open nothing.
        $role = PlatformRole::query()->where('code', $this->option('role'))->first();
        if (! $role) {
            $this->error("No platform role \"{$this->option('role')}\". Run the migrations first, or pick an existing role.");

            return self::FAILURE;
        }

        $admin = PlatformAdmin::query()->create([
            'name' => $name,
            'email' => $email,
            'password' => $password,
            'status' => 'active',
        ]);
        $admin->roles()->attach($role);

        $this->info("Platform admin \"{$email}\" created. They can log in at /admin/login.");

        return self::SUCCESS;
    }
}
