<?php

use App\Http\Controllers\MfaController;
use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/register', [AuthController::class, 'register'])
    ->middleware('throttle:auth');
Route::post('/auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:auth');

// MFA step only — temp token with mfa:verify ability
Route::middleware(['auth:sanctum', 'abilities:mfa:verify'])->group(function () {
    Route::post('/auth/verify-mfa', [AuthController::class, 'verifyMfa']);
});
// Full session — normal auth token with * ability
Route::middleware(['auth:sanctum', 'abilities:*'])->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/user', [AuthController::class, 'user']);
    Route::post('/mfa/setup', [MfaController::class, 'setup']);
    Route::post('/mfa/enable', [MfaController::class, 'enable']);
    Route::post('/mfa/disable', [MfaController::class, 'disable']);
    Route::post('/mfa/backup-codes', [MfaController::class, 'regenerateBackupCodes']);
    Route::get('/mfa/status', [MfaController::class, 'status']);
});