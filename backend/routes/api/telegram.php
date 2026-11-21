<?php

// Telegram group alerts: the company's linked groups and what each gets.
// Loaded by routes/api.php inside the signed-in, active-company group.
// (Telegram's own webhook is public and lives in routes/api.php.)
// {group} only finds the signed-in company's groups (BelongsToCompany scope).

use App\Http\Controllers\Api\Telegram\TelegramGroupController;
use Illuminate\Support\Facades\Route;

Route::middleware('company_permission:company.manage')->group(function () {
    Route::get('/telegram', [TelegramGroupController::class, 'show']);
    Route::post('/telegram/link', [TelegramGroupController::class, 'link']);
    Route::put('/telegram/groups/{group}', [TelegramGroupController::class, 'update']);
    Route::post('/telegram/groups/{group}/test', [TelegramGroupController::class, 'test']);
    Route::delete('/telegram/groups/{group}', [TelegramGroupController::class, 'destroy']);
});
