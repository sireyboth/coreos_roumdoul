<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FeatureFlag extends Model
{
    protected $fillable = [
        'code',
        'name',
        'description',
        'is_enabled',
    ];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
        ];
    }

    public static function isEnabled(string $code): bool
    {
        return static::query()->where('code', $code)->value('is_enabled') ?? false;
    }
}
