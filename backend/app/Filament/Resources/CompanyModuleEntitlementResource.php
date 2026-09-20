<?php

namespace App\Filament\Resources;

use App\Filament\Resources\CompanyModuleEntitlementResource\Pages;
use App\Filament\Resources\CompanyModuleEntitlementResource\RelationManagers;
use App\Models\CompanyModuleEntitlement;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;

class CompanyModuleEntitlementResource extends Resource
{
    protected static ?string $model = CompanyModuleEntitlement::class;

    protected static ?string $navigationIcon = 'heroicon-o-adjustments-horizontal';

    protected static ?string $navigationGroup = 'Platform';

    protected static ?string $navigationLabel = 'Module Overrides';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Select::make('company_id')
                    ->relationship('company', 'name')
                    ->searchable()
                    ->required(),
                Forms\Components\Select::make('module_id')
                    ->relationship('module', 'name')
                    ->searchable()
                    ->required(),
                Forms\Components\Toggle::make('is_enabled')
                    ->required()
                    ->default(true)
                    ->helperText('Overrides whatever the company\'s plan says for this module.'),
                Forms\Components\TextInput::make('note')
                    ->maxLength(255)
                    ->helperText('Why this override exists, for future reference.'),
                Forms\Components\TextInput::make('override_reason')
                    ->maxLength(255),
                Forms\Components\DateTimePicker::make('starts_at'),
                Forms\Components\DateTimePicker::make('ends_at'),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('company.name')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('module.name')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\IconColumn::make('is_enabled')
                    ->boolean(),
                Tables\Columns\TextColumn::make('note')
                    ->searchable(),
                Tables\Columns\TextColumn::make('changedByPlatformAdmin.name')
                    ->label('Changed by')
                    ->placeholder('—'),
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
            'index' => Pages\ManageCompanyModuleEntitlements::route('/'),
        ];
    }
}
