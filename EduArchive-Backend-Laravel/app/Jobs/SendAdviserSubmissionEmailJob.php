<?php

namespace App\Jobs;

use App\Models\Notification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Queued adviser email for a capstone submission. Deduplicated by the
 * notification row, so retries or repeated store requests send at most once.
 */
class SendAdviserSubmissionEmailJob implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 60;
    public int $uniqueFor = 3600;

    public function __construct(public int $notificationId) {}

    public function uniqueId(): string
    {
        return 'adviser-email:'.$this->notificationId;
    }

    public function handle(): void
    {
        $notification = Notification::with(['relatedCapstone', 'relatedUser', 'admin'])->find($this->notificationId);
        if (!$notification || $notification->email_sent_at) return;

        $recipient = $notification->admin;
        $capstone = $notification->relatedCapstone;
        if (!$recipient?->email || !$capstone) return;

        $frontend = rtrim((string) config('acadex.frontend_url'), '/');
        $link = $frontend.'/faculty/capstones/'.($capstone->slug ?: $capstone->id);
        $uploader = $notification->relatedUser?->name ?? 'A student';
        $submitted = optional($capstone->created_at)->format('F j, Y') ?? now()->format('F j, Y');

        Mail::raw(
            "Hello {$recipient->name},\n\n"
            ."{$uploader} submitted a capstone where you are listed as adviser.\n\n"
            ."Title: {$capstone->title}\n"
            ."Uploader: {$uploader}\n"
            ."Submitted: {$submitted}\n\n"
            ."Review the submission: {$link}\n\n"
            ."AcadeX — Mindoro State University",
            function ($message) use ($recipient, $capstone) {
                $message->to($recipient->email)
                    ->subject('Capstone submission: '.mb_substr($capstone->title, 0, 90));
            }
        );

        $notification->forceFill(['email_sent_at' => now()])->save();
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('Adviser submission email permanently failed.', [
            'notification_id' => $this->notificationId,
            'type' => get_class($exception),
        ]);
    }
}
