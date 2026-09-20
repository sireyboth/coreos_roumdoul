<?php

namespace App\Console\Commands\Platform;

use App\Models\PlatformAdmin;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

class MakeAdminCommand extends Command
{
    protected $signature = 'platform:make-admin
        {--name= : The admin\'s name}
        {--email= : The admin\'s email}
        {--password= : The admin\'s password}';

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

        PlatformAdmin::query()->create([
            'name' => $name,
            'email' => $email,
            'password' => $password,
            'status' => 'active',
        ]);

        $this->info("Platform admin \"{$email}\" created. They can log in at /admin/login.");

        return self::SUCCESS;
    }
}
