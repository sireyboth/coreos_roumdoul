<?php

namespace App\Filament\Resources\CompanyResource\Pages;

use App\Filament\Resources\CompanyResource;
use App\Models\Company;
use App\Services\CompanyProvisioner;
use Filament\Actions;
use Filament\Resources\Pages\ManageRecords;
use Illuminate\Database\Eloquent\Model;

class ManageCompanies extends ManageRecords
{
    protected static string $resource = CompanyResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make()
                // Route company creation through CompanyProvisioner instead
                // of a plain Eloquent create, so a company made here also
                // gets its default roles and first admin user — exactly
                // like self-service registration does.
                ->using(function (array $data): Model {
                    $company = app(CompanyProvisioner::class)->provision(
                        $data['name'],
                        $data['admin_name'],
                        $data['admin_email'],
                        $data['admin_password'],
                    );

                    $company->update(collect($data)
                        ->only(['email', 'phone', 'industry', 'timezone', 'status', 'trial_ends_at'])
                        ->filter()
                        ->all());

                    return $company;
                }),
        ];
    }
}
