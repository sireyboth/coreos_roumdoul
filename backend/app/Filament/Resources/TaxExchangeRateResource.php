<?php

namespace App\Filament\Resources;

use App\Filament\Resources\TaxExchangeRateResource\Pages;
use App\Models\TaxExchangeRate;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * The official riel-per-dollar rate for tax, one per month. Payroll uses it
 * to work out tax and NSSF for dollar salaries; without it a company's
 * fallback rate is used, or the run can't be approved.
 */
class TaxExchangeRateResource extends Resource
{
    protected static ?string $model = TaxExchangeRate::class;

    protected static ?string $navigationIcon = 'heroicon-o-currency-dollar';

    protected static ?string $navigationGroup = 'Payroll';

    protected static ?string $navigationLabel = 'Tax exchange rates';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\TextInput::make('month')
                    ->required()
                    ->placeholder('2026-10')
                    ->regex('/^\d{4}-(0[1-9]|1[0-2])$/')
                    ->unique(ignoreRecord: true),
                Forms\Components\TextInput::make('rate')
                    ->label('KHR per USD')
                    ->required()
                    ->numeric()
                    ->minValue(1000)
                    ->maxValue(10000),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('month', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('month')->sortable()->searchable(),
                Tables\Columns\TextColumn::make('rate')->label('KHR per USD')->numeric(2),
                Tables\Columns\TextColumn::make('updated_at')->dateTime()->sortable(),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ManageTaxExchangeRates::route('/'),
        ];
    }
}
