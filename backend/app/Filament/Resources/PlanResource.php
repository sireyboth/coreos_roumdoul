<?php

namespace App\Filament\Resources;

use App\Filament\Resources\PlanResource\Pages;
use App\Models\Plan;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;

class PlanResource extends Resource
{
    protected static ?string $model = Plan::class;

    protected static ?string $navigationIcon = 'heroicon-o-rectangle-stack';

    protected static ?string $navigationGroup = 'Platform';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\TextInput::make('name')
                    ->required()
                    ->maxLength(255),
                Forms\Components\TextInput::make('code')
                    ->required()
                    ->maxLength(255)
                    ->unique(ignoreRecord: true),
                Forms\Components\Textarea::make('description')
                    ->columnSpanFull(),
                Forms\Components\TextInput::make('max_employees')
                    ->numeric(),
                Forms\Components\TextInput::make('max_branches')
                    ->numeric(),
                Forms\Components\Select::make('status')
                    ->options(['active' => 'Active', 'inactive' => 'Inactive'])
                    ->required()
                    ->default('active'),
                Forms\Components\CheckboxList::make('modules')
                    ->relationship('modules', 'name')
                    ->columnSpanFull(),
                Forms\Components\Repeater::make('prices')
                    ->relationship('prices')
                    ->defaultItems(0)
                    ->schema([
                        Forms\Components\Select::make('interval')
                            ->options(['monthly' => 'Monthly', 'yearly' => 'Yearly'])
                            ->required(),
                        Forms\Components\TextInput::make('price_cents')
                            ->label('Price (cents)')
                            ->helperText('E.g. 4900 = $49.00')
                            ->required()
                            ->numeric()
                            ->default(0),
                        Forms\Components\TextInput::make('currency')
                            ->required()
                            ->maxLength(3)
                            ->default('USD'),
                    ])
                    ->columns(3)
                    ->columnSpanFull()
                    ->addActionLabel('Add price'),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query) => $query->with('prices'))
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->searchable(),
                Tables\Columns\TextColumn::make('code')
                    ->searchable(),
                Tables\Columns\TextColumn::make('monthly_price')
                    ->label('Monthly')
                    ->state(fn (\App\Models\Plan $record) => $record->monthlyPrice()
                        ? number_format($record->monthlyPrice()->price_cents / 100, 2).' '.$record->monthlyPrice()->currency
                        : '—'),
                Tables\Columns\TextColumn::make('yearly_price')
                    ->label('Yearly')
                    ->state(fn (\App\Models\Plan $record) => $record->yearlyPrice()
                        ? number_format($record->yearlyPrice()->price_cents / 100, 2).' '.$record->yearlyPrice()->currency
                        : '—'),
                Tables\Columns\TextColumn::make('max_employees')
                    ->numeric()
                    ->sortable(),
                Tables\Columns\TextColumn::make('max_branches')
                    ->numeric()
                    ->sortable(),
                Tables\Columns\TextColumn::make('status')
                    ->badge(),
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('updated_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                //
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ManagePlans::route('/'),
        ];
    }
}
