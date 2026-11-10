/**
 * Available AI Assistant Modes
 */
export const AI_MODES = [
    {
        id: 'smart',
        label: 'Smart',
        fullLabel: 'Smart Mode',
        description: 'Context-aware: prioritizes active PDF, answers general questions',
        badge: 'Smart Mode',
    },
    {
        id: 'pdf_only',
        label: 'PDF Only',
        fullLabel: 'PDF Only Mode',
        description: 'Answers strictly using the active PDF document',
        badge: 'PDF Only',
    },
    {
        id: 'general',
        label: 'General AI',
        fullLabel: 'General AI Mode',
        description: 'General AI knowledge without document restrictions',
        badge: 'General AI',
    },
];

export function getAvailableModes(activeCapstone) {
    const hasCapstone = Boolean(activeCapstone?.id);
    return AI_MODES.map((mode) => {
        if (mode.id === 'pdf_only') {
            return {
                ...mode,
                disabled: !hasCapstone,
                disabledReason: !hasCapstone ? 'Open a capstone PDF to enable PDF Only Mode' : null,
            };
        }
        return {
            ...mode,
            disabled: false,
            disabledReason: null,
        };
    });
}
