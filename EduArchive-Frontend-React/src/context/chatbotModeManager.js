/**
 * Pure mode resolution logic for the AI Capstone Research Assistant.
 *
 * Rules:
 * - Entering a capstone (prev == null, next != null): auto-switches to 'pdf_only', isManual = false.
 * - Changing capstone (prev != next, next != null): auto-switches to 'pdf_only', isManual = false.
 * - Leaving capstone (prev != null, next == null): auto-switches to 'smart', isManual = false.
 * - Same context (prev == next): preserves manual override and mode.
 * - If no capstone is open, 'pdf_only' is forbidden; fallback to 'smart'.
 */
export function resolveAutoMode({ prevCapstoneId, nextCapstoneId, currentMode, isManual }) {
    // Context changed: opened a new capstone or switched to a different capstone
    if (nextCapstoneId !== null && nextCapstoneId !== undefined) {
        if (prevCapstoneId !== nextCapstoneId) {
            return { mode: 'pdf_only', isManual: false };
        }
        // Staying on same capstone: keep manual choice or current mode
        return {
            mode: currentMode || 'pdf_only',
            isManual: Boolean(isManual),
        };
    }

    // No active capstone (e.g. main page, browse, dashboard)
    if (prevCapstoneId !== null && prevCapstoneId !== undefined) {
        // Just closed/left the capstone: revert to smart mode
        return { mode: 'smart', isManual: false };
    }

    // Was already on main page: if currently in pdf_only without a capstone, reset to smart
    if (currentMode === 'pdf_only') {
        return { mode: 'smart', isManual: false };
    }

    return {
        mode: currentMode || 'smart',
        isManual: Boolean(isManual),
    };
}
