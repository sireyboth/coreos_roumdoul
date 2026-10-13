<?php

namespace App\Filament\Resources\TaxExchangeRateResource\Pages;

use App\Filament\Resources\TaxExchangeRateResource;
use Filament\Actions;
use Filament\Resources\Pages\ManageRecords;

class ManageTaxExchangeRates extends ManageRecords
{
    protected static string $resource = TaxExchangeRateResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
