<?php

namespace App\Filament\Resources;

use App\Filament\Resources\CompanyResource\Pages;
use App\Filament\Resources\CompanyResource\RelationManagers;
use App\Models\Company;
use App\Models\SupportAccessSession;
use App\Services\AuditLogger;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;

class CompanyResource extends Resource
{
    protected static ?string $model = Company::class;

    protected static ?string $navigationIcon = 'heroicon-o-building-office-2';

    protected static ?string $navigationGroup = 'Platform';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\TextInput::make('name')
                    ->required()
                    ->maxLength(255)
                    ->live(onBlur: true)
                    ->afterStateUpdated(fn (string $context, $state, callable $set) => $context === 'create' ? $set('slug', \Illuminate\Support\Str::slug($state)) : null),
                Forms\Components\TextInput::make('slug')
                    ->required()
                    ->maxLength(255)
                    ->unique(ignoreRecord: true)
                    ->visibleOn('edit')
                    ->helperText('Set automatically when the company is created.'),
                Forms\Components\Section::make('Admin account')
                    ->description('Creates the company\'s first user, with the company-admin role.')
                    ->visibleOn('create')
                    ->schema([
                        Forms\Components\TextInput::make('admin_name')
                            ->label('Name')
                            ->required()
                            ->maxLength(255),
                        Forms\Components\TextInput::make('admin_email')
                            ->label('Email')
                            ->email()
                            ->required()
                            ->maxLength(255)
                            ->unique('users', 'email'),
                        Forms\Components\TextInput::make('admin_password')
                            ->label('Password')
                            ->password()
                            ->revealable()
                            ->required()
                            ->minLength(8),
                    ]),
                Forms\Components\TextInput::make('email')
                    ->email()
                    ->maxLength(255),
                Forms\Components\TextInput::make('phone')
                    ->tel()
                    ->maxLength(255),
                Forms\Components\TextInput::make('industry')
                    ->maxLength(255),
                Forms\Components\TextInput::make('timezone')
                    ->required()
                    ->maxLength(255)
                    ->default('Asia/Phnom_Penh'),
                Forms\Components\Select::make('status')
                    ->options([
                        'trial' => 'Trial',
                        'active' => 'Active',
                        'suspended' => 'Suspended',
                        'cancelled' => 'Cancelled',
                    ])
                    ->required()
                    ->default('trial'),
                Forms\Components\DateTimePicker::make('trial_ends_at'),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->searchable(),
                Tables\Columns\TextColumn::make('slug')
                    ->searchable(),
                Tables\Columns\TextColumn::make('email')
                    ->searchable(),
                Tables\Columns\TextColumn::make('industry')
                    ->searchable()
                    ->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'active' => 'success',
                        'trial' => 'warning',
                        'suspended', 'cancelled' => 'danger',
                        default => 'gray',
                    }),
                Tables\Columns\TextColumn::make('trial_ends_at')
                    ->dateTime()
                    ->sortable(),
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('updated_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('deleted_at')
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
                Tables\Actions\Action::make('start_support_access')
                    ->label('Start support access')
                    ->icon('heroicon-o-lifebuoy')
                    ->visible(fn (Company $record) => ! $record->supportAccessSessions()->whereNull('ended_at')->where('expires_at', '>', now())->exists())
                    ->form([
                        Forms\Components\Textarea::make('reason')
                            ->required()
                            ->maxLength(255),
                        Forms\Components\TextInput::make('duration_minutes')
                            ->numeric()
                            ->required()
                            ->default(60)
                            ->minValue(1)
                            ->maxValue(480),
                    ])
                    ->action(function (Company $record, array $data) {
                        $session = $record->supportAccessSessions()->create([
                            'platform_admin_id' => auth()->id(),
                            'reason' => $data['reason'],
                            'started_at' => now(),
                            'expires_at' => now()->addMinutes((int) $data['duration_minutes']),
                        ]);

                        AuditLogger::record('support_access.started', $session, ['reason' => $data['reason']], $record->id);

                        Notification::make()->title('Support access session started')->success()->send();
                    }),
                Tables\Actions\Action::make('end_support_access')
                    ->label('End support access')
                    ->icon('heroicon-o-lock-closed')
                    ->color('danger')
                    ->visible(fn (Company $record) => $record->supportAccessSessions()->whereNull('ended_at')->where('expires_at', '>', now())->exists())
                    ->requiresConfirmation()
                    ->action(function (Company $record) {
                        $session = $record->supportAccessSessions()->whereNull('ended_at')->where('expires_at', '>', now())->first();
                        $session?->update(['ended_at' => now()]);

                        AuditLogger::record('support_access.ended', $session, [], $record->id);

                        Notification::make()->title('Support access session ended')->success()->send();
                    }),
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
            'index' => Pages\ManageCompanies::route('/'),
        ];
    }
}
