<?php

namespace App\Filament\Resources\StatutoryRateResource\Pages;

use App\Filament\Resources\StatutoryRateResource;
use Filament\Actions;
use Filament\Resources\Pages\ManageRecords;

class ManageStatutoryRates extends ManageRecords
{
    protected static string $resource = StatutoryRateResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
