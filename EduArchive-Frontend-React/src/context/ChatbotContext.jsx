import { useState, useCallback } from 'react';
import { ChatbotContext } from './useChatbotContext';
import { resolveAutoMode } from './chatbotModeManager';

/**
 * ChatbotContext
 *
 * Provides active capstone context, unified AI mode management,
 * and page navigation helpers across the application.
 */
export function ChatbotProvider({ children }) {
    const [activeCapstone, setActiveCapstoneState] = useState(null);
    const [mode, setModeState] = useState('smart'); // 'smart' | 'pdf_only' | 'general'
    const [isManual, setIsManual] = useState(false);

    // Manual mode selection by user
    const setMode = useCallback((newMode, manual = true) => {
        // PDF Only Mode is forbidden when no capstone is active
        if (!activeCapstone && newMode === 'pdf_only') {
            setModeState('smart');
            setIsManual(false);
            return;
        }
        setModeState(newMode);
        setIsManual(Boolean(manual));
    }, [activeCapstone]);

    // Called when a capstone opens or closes
    const setActiveCapstone = useCallback((nextCapstone) => {
        const nextId = nextCapstone?.id ?? null;
        setActiveCapstoneState((prev) => {
            const prevId = prev?.id ?? null;
            const resolution = resolveAutoMode({
                prevCapstoneId: prevId,
                nextCapstoneId: nextId,
                currentMode: mode,
                isManual,
            });

            setModeState(resolution.mode);
            setIsManual(resolution.isManual);
            return nextCapstone || null;
        });
    }, [mode, isManual]);

    const clearActiveCapstone = useCallback(() => {
        setActiveCapstone(null);
    }, [setActiveCapstone]);

    // Backwards-compatible alias for existing detail page hooks
    const setCapstoneContext = useCallback((cap) => {
        setActiveCapstone(cap);
    }, [setActiveCapstone]);

    // PDF page navigation helper
    const scrollToPdfPage = useCallback((pageNumber) => {
        if (!pageNumber) return;
        const targetPage = parseInt(pageNumber, 10);
        if (Number.isNaN(targetPage)) return;

        // 1. Dispatch custom event for readers/fullscreen
        window.dispatchEvent(new CustomEvent('acadex:pdf-page-scroll', {
            detail: { pageNumber: targetPage },
        }));

        // 2. Direct DOM scroll attempt
        const el = document.querySelector(`[data-document-page="${targetPage}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, []);

    const value = {
        activeCapstone,
        capstoneContext: activeCapstone, // backwards-compatible alias
        mode,
        isManualMode: isManual,
        setMode,
        setActiveCapstone,
        setCapstoneContext,
        clearActiveCapstone,
        scrollToPdfPage,
    };

    return (
        <ChatbotContext.Provider value={value}>
            {children}
        </ChatbotContext.Provider>
    );
}
