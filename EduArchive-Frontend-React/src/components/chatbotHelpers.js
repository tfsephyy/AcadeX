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

/**
 * Generates dynamic suggested question chips based on the active capstone or default discovery state.
 *
 * @param {object|null} activeCapstone
 * @returns {string[]}
 */
export function generateSuggestedQuestions(activeCapstone) {
    if (!activeCapstone || !activeCapstone.id) {
        return [
            'Find popular capstones in the archive',
            'Recommend machine learning capstone topics',
            'What are the most frequent research keywords?',
            'How do I structure the IMRAD format?',
        ];
    }

    const title = activeCapstone.title || 'this capstone';
    const category = (activeCapstone.category || '').toLowerCase();
    const questions = [
        `What methodology and technologies were used in ${title}?`,
        'What were the major findings and evaluation results?',
        'What are the research gaps and documented limitations?',
        'Find similar capstones in the repository',
    ];

    if (category.includes('iot') || category.includes('hardware') || category.includes('internet of things')) {
        questions.push('What microcontrollers and sensors were used in this system?');
    } else if (category.includes('ai') || category.includes('machine learning') || category.includes('intelligence')) {
        questions.push('What algorithms and models were evaluated in this study?');
    } else if (category.includes('web') || category.includes('mobile')) {
        questions.push('What frontend and backend architecture was implemented?');
    }

    return questions;
}
