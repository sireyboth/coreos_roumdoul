<?php

namespace App\Filament\Resources;

use App\Filament\Resources\AuditLogResource\Pages;
use App\Models\AuditLog;
use Filament\Forms\Components\KeyValue;
use Filament\Forms\Components\Placeholder;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class AuditLogResource extends Resource
{
    protected static ?string $model = AuditLog::class;

    protected static ?string $navigationIcon = 'heroicon-o-document-magnifying-glass';

    protected static ?string $navigationGroup = 'Platform';

    // Audit logs are a record of what happened — never created or edited by hand.
    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit($record): bool
    {
        return false;
    }

    public static function canDelete($record): bool
    {
        return false;
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Placeholder::make('event')
                ->content(fn (AuditLog $record) => $record->event),
            Placeholder::make('company')
                ->content(fn (AuditLog $record) => $record->company?->name ?? '— platform —'),
            Placeholder::make('actor')
                ->content(fn (AuditLog $record) => $record->actor
                    ? class_basename($record->actor_type).': '.$record->actor->name
                    : 'system'),
            Placeholder::make('subject')
                ->content(fn (AuditLog $record) => $record->subject_type
                    ? class_basename($record->subject_type).' #'.$record->subject_id
                    : '—'),
            Placeholder::make('reason')
                ->content(fn (AuditLog $record) => $record->reason ?? '—'),
            KeyValue::make('before_data')
                ->disabled(),
            KeyValue::make('after_data')
                ->disabled(),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('created_at')
                    ->label('When')
                    ->dateTime()
                    ->sortable(),
                Tables\Columns\TextColumn::make('company.name')
                    ->label('Company')
                    ->placeholder('— platform —')
                    ->searchable(),
                Tables\Columns\TextColumn::make('actor.name')
                    ->label('By')
                    ->placeholder('system')
                    ->searchable(),
                Tables\Columns\TextColumn::make('event')
                    ->badge()
                    ->searchable(),
                Tables\Columns\TextColumn::make('subject_type')
                    ->label('Subject')
                    ->formatStateUsing(fn (?string $state) => $state ? class_basename($state) : null)
                    ->placeholder('—'),
                Tables\Columns\TextColumn::make('ip_address')
                    ->label('IP')
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->defaultSort('created_at', 'desc')
            ->filters([
                //
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListAuditLogs::route('/'),
        ];
    }
}
