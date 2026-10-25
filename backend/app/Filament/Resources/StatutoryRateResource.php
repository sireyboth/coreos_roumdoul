<?php

namespace App\Filament\Resources;

use App\Filament\Concerns\RequiresPlatformPermission;
use App\Filament\Resources\StatutoryRateResource\Pages;
use App\Models\StatutoryRate;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * Tax on salary brackets and NSSF rates, by date. When the law changes, add
 * a NEW row from the date it takes effect — never edit an old one, or months
 * already paid would no longer match their rules.
 */
class StatutoryRateResource extends Resource
{
    use RequiresPlatformPermission;

    protected static string $permissionArea = 'statutory_rates';

    protected static ?string $model = StatutoryRate::class;

    protected static ?string $navigationIcon = 'heroicon-o-scale';

    protected static ?string $navigationGroup = 'Payroll';

    protected static ?string $navigationLabel = 'Tax and NSSF rates';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Select::make('kind')
                    ->options(['tax_on_salary' => 'Tax on salary', 'nssf' => 'NSSF'])
                    ->required(),
                Forms\Components\TextInput::make('country')->default('KH')->required()->maxLength(2),
                Forms\Components\DatePicker::make('effective_from')->required(),
                Forms\Components\TextInput::make('note')->maxLength(255)->columnSpanFull(),
                Forms\Components\Textarea::make('params')
                    ->label('Rates (JSON)')
                    ->helperText('Amounts in riel, shares as decimals (2% = 0.02). Copy the previous row and change only what the law changed.')
                    ->rows(18)
                    ->required()
                    ->rules(['json'])
                    ->formatStateUsing(fn ($state) => is_array($state) ? json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) : $state)
                    ->dehydrateStateUsing(fn ($state) => is_string($state) ? json_decode($state, true) : $state)
                    ->columnSpanFull(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('effective_from', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('kind')->badge()->sortable(),
                Tables\Columns\TextColumn::make('country'),
                Tables\Columns\TextColumn::make('effective_from')->date()->sortable(),
                Tables\Columns\TextColumn::make('note')->limit(60),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\ReplicateAction::make()->label('Copy as new'),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ManageStatutoryRates::route('/'),
        ];
    }
}
