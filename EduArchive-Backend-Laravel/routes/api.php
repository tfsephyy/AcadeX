<?php

use App\Http\Controllers\Api\V1\ActivityLogController;
use App\Http\Controllers\Api\V1\AdminDashboardController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CapstoneController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\PasswordResetController;
use App\Http\Controllers\Api\V1\PublishedCapstoneController;
use App\Http\Controllers\Api\V1\UserManagementController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — v1
|--------------------------------------------------------------------------
| Prefix: /api/v1
*/

Route::prefix('v1')->group(function () {

    // ── Public routes ────────────────────────────────────
    Route::post('/register', [AuthController::class, 'register'])
        ->middleware('throttle:10,1');

    Route::post('/login', [AuthController::class, 'login'])
        ->middleware('throttle:5,1');

    // ── Password reset & email verification (public) ─────
    Route::post('/forgot-password',        [PasswordResetController::class, 'sendCode'])->middleware('throttle:5,1');
    Route::post('/verify-reset-code',      [PasswordResetController::class, 'verifyCode'])->middleware('throttle:10,1');
    Route::post('/reset-password',         [PasswordResetController::class, 'resetPassword'])->middleware('throttle:5,1');
    Route::post('/send-verification-code', [PasswordResetController::class, 'sendVerificationCode'])->middleware('throttle:5,1');
    Route::post('/verify-email-code',      [PasswordResetController::class, 'verifyEmailCode'])->middleware('throttle:10,1');

    // ── Protected routes (Sanctum) ───────────────────────
    Route::middleware('auth:sanctum')->group(function () {

        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/user',    [AuthController::class, 'user']);
        Route::put('/profile', [AuthController::class, 'updateProfile']);
        Route::post('/change-password', [PasswordResetController::class, 'changePassword']);

        // ── Published capstones (all authenticated users) ────
        Route::prefix('published')->group(function () {
            Route::get('/',           [PublishedCapstoneController::class, 'index']);
            Route::get('/years',      [PublishedCapstoneController::class, 'years']);
            Route::get('/programs',   [PublishedCapstoneController::class, 'programs']);
            Route::get('/keywords',   [PublishedCapstoneController::class, 'keywords']);
            Route::get('/categories', [PublishedCapstoneController::class, 'categories']);
        });

        // ── Shared capstone utilities (all authenticated users) ──
        Route::get('/capstones/faculty-list',              [CapstoneController::class, 'getFacultyList']);
        Route::get('/capstones/bookmarked',                [CapstoneController::class, 'userBookmarks']);
        Route::post('/capstones/{capstone}/view',          [CapstoneController::class, 'recordView']);
        Route::get('/capstones/{capstone}/download',       [CapstoneController::class, 'download']);
        Route::get('/capstones/{capstone}/pdf',            [CapstoneController::class, 'servePdf']);
        Route::post('/capstones/{capstone}/bookmark',      [CapstoneController::class, 'toggleBookmark']);
        Route::get('/capstones/{capstone}',                [CapstoneController::class, 'show']);

        // ── Admin-only routes ────────────────────────────
        Route::middleware('role:admin')->prefix('admin')->group(function () {

            // Dashboard
            Route::get('/dashboard/stats',              [AdminDashboardController::class, 'stats']);
            Route::get('/dashboard/uploaded-by-year',   [AdminDashboardController::class, 'uploadedByYear']);
            Route::get('/dashboard/approved-by-year',   [AdminDashboardController::class, 'approvedByYear']);
            Route::get('/dashboard/students-per-year',  [AdminDashboardController::class, 'studentsPerYear']);
            Route::get('/dashboard/recent-approved',    [AdminDashboardController::class, 'recentApproved']);

            // Capstone Management
            Route::get('/capstones',                       [CapstoneController::class, 'index']);
            Route::post('/capstones',                      [CapstoneController::class, 'store']);
            Route::post('/capstones/upload',               [CapstoneController::class, 'upload']);
            Route::post('/capstones/upload-resource',      [CapstoneController::class, 'uploadResource']);
            Route::get('/capstones/archived',              [CapstoneController::class, 'archived']);
            Route::get('/capstones/bookmarked',            [CapstoneController::class, 'adminBookmarks']);
            Route::post('/capstones/{capstone}/approve',   [CapstoneController::class, 'approve']);
            Route::post('/capstones/{capstone}/reject',    [CapstoneController::class, 'reject']);
            Route::post('/capstones/{capstone}/archive',   [CapstoneController::class, 'archive']);
            Route::post('/capstones/{capstone}/unarchive', [CapstoneController::class, 'unarchive']);
            Route::post('/capstones/{capstone}/unpublish', [CapstoneController::class, 'unpublish']);
            Route::put('/capstones/{capstone}',            [CapstoneController::class, 'update']);
            Route::delete('/capstones/{capstone}',         [CapstoneController::class, 'destroy']);

            // User Management
            Route::get('/users/new',                    [UserManagementController::class, 'newUsers']);
            Route::get('/users/students',               [UserManagementController::class, 'students']);
            Route::get('/users/faculty',                [UserManagementController::class, 'faculty']);
            Route::get('/users/archived',               [UserManagementController::class, 'archivedUsers']);
            Route::get('/users/{user}',                 [UserManagementController::class, 'show']);
            Route::post('/users/{user}/approve',        [UserManagementController::class, 'approve']);
            Route::post('/users/{user}/deny',           [UserManagementController::class, 'deny']);
            Route::post('/users/{user}/archive',        [UserManagementController::class, 'archive']);
            Route::post('/users/{user}/unarchive',      [UserManagementController::class, 'unarchive']);
            Route::delete('/users/{user}',              [UserManagementController::class, 'remove']);

            // Notifications
            Route::get('/notifications',                      [NotificationController::class, 'index']);
            Route::get('/notifications/unread-count',         [NotificationController::class, 'unreadCount']);
            Route::put('/notifications/{notification}/read',  [NotificationController::class, 'markAsRead']);
            Route::put('/notifications/mark-all-read',        [NotificationController::class, 'markAllAsRead']);

            // Activity Logs
            Route::get('/activity-logs',       [ActivityLogController::class, 'index']);
            Route::get('/activity-logs/types', [ActivityLogController::class, 'types']);
        });

        // ── Faculty routes ───────────────────────────────
        Route::middleware('role:admin,faculty')->prefix('faculty')->group(function () {
            // Faculty Capstone Management (scoped to own uploads)
            Route::get('/capstones',                         [CapstoneController::class, 'index']);
            Route::post('/capstones',                        [CapstoneController::class, 'store']);
            Route::post('/capstones/upload',                 [CapstoneController::class, 'upload']);
            Route::post('/capstones/upload-resource',        [CapstoneController::class, 'uploadResource']);
            Route::get('/capstones/archived',                [CapstoneController::class, 'archived']);
            Route::post('/capstones/{capstone}/archive',     [CapstoneController::class, 'archive']);
            Route::post('/capstones/{capstone}/unarchive',   [CapstoneController::class, 'unarchive']);
            Route::put('/capstones/{capstone}',              [CapstoneController::class, 'update']);
            Route::delete('/capstones/{capstone}',           [CapstoneController::class, 'destroy']);
        });
    });
});
