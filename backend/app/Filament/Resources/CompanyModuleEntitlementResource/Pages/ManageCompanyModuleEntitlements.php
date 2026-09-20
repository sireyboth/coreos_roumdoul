<?php

namespace App\Filament\Resources\CompanyModuleEntitlementResource\Pages;

use App\Filament\Resources\CompanyModuleEntitlementResource;
use Filament\Actions;
use Filament\Resources\Pages\ManageRecords;

class ManageCompanyModuleEntitlements extends ManageRecords
{
    protected static string $resource = CompanyModuleEntitlementResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make()
                ->mutateFormDataUsing(function (array $data): array {
                    $data['changed_by_platform_admin_id'] = auth()->id();

                    return $data;
                }),
        ];
    }
}
