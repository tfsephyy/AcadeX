<?php

namespace App\Services\Chatbot;

/**
 * ChatbotPermissionService
 *
 * Centralised role-based permission checks for the chatbot.
 * Role is always derived from the authenticated backend session —
 * never from anything the user sends in their message.
 */
class ChatbotPermissionService
{
    const ROLE_ADMIN   = 'admin';
    const ROLE_FACULTY = 'faculty';
    const ROLE_STUDENT = 'student';
    const ROLE_VISITOR = 'visitor';

    /** Every authenticated role may search / recommend capstones */
    public function canSearchCapstones(string $role): bool
    {
        return in_array($role, [self::ROLE_ADMIN, self::ROLE_FACULTY, self::ROLE_STUDENT, self::ROLE_VISITOR]);
    }

    /** Admin, Faculty, Student see all published capstones */
    public function canViewAllPublished(string $role): bool
    {
        return in_array($role, [self::ROLE_ADMIN, self::ROLE_FACULTY, self::ROLE_STUDENT]);
    }

    /** Visitors use the restricted query (published OR copyrighted OR has IMRAD) */
    public function isVisitor(string $role): bool
    {
        return $role === self::ROLE_VISITOR;
    }

    public function isAdmin(string $role): bool
    {
        return $role === self::ROLE_ADMIN;
    }

    /** Only admin may see system statistics */
    public function canViewAnalytics(string $role): bool
    {
        return $role === self::ROLE_ADMIN;
    }

    /** Only admin may see activity / audit logs */
    public function canViewLogs(string $role): bool
    {
        return $role === self::ROLE_ADMIN;
    }

    /** Only admin may see upload / usage trends */
    public function canViewTrends(string $role): bool
    {
        return $role === self::ROLE_ADMIN;
    }

    /**
     * Check whether a given intent is allowed for a role.
     * Called BEFORE any database query is executed.
     */
    public function isIntentAllowed(string $intent, string $role): bool
    {
        $adminOnly = [
            ChatbotIntentService::INTENT_ADMIN_STATS,
            ChatbotIntentService::INTENT_ADMIN_TRENDS,
            ChatbotIntentService::INTENT_ADMIN_LOGS,
        ];

        if (in_array($intent, $adminOnly)) {
            return $role === self::ROLE_ADMIN;
        }

        return true; // all other intents allowed for every role
    }

    /**
     * Return a user-friendly access-denied message appropriate for the role.
     */
    public function getDeniedMessage(string $intent, string $role): string
    {
        $adminOnlyIntents = [
            ChatbotIntentService::INTENT_ADMIN_STATS,
            ChatbotIntentService::INTENT_ADMIN_TRENDS,
            ChatbotIntentService::INTENT_ADMIN_LOGS,
        ];

        if (in_array($intent, $adminOnlyIntents)) {
            if ($role === self::ROLE_VISITOR) {
                return "Sorry, system statistics and activity information are only available to registered administrators. " .
                       "I can help you find publicly available capstone projects — just ask!";
            }
            return "Sorry, system statistics and activity logs are only available to administrators.";
        }

        return "Sorry, you don't have permission to access that information.";
    }
}
