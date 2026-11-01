import { useState, useEffect, useRef, useCallback } from 'react';
import { HiOutlineSearch, HiOutlineX, HiOutlineSparkles } from 'react-icons/hi';
import api from '../api/axios';

/**
 * NLP-aware search input with:
 *  - 350ms debounce before firing onChange
 *  - Live keyword autocomplete from the /keywords/suggest endpoint
 *  - Expanded-term hint ("Also searching for: …")
 *  - Clear button
 */
export default function SearchWithSuggestions({
    value,
    onChange,
    placeholder = 'Search by title, author, or keyword...',
    className = '',
    id = 'nlp-search-input',
}) {
    const [inputVal, setInputVal]           = useState(value ?? '');
    const [suggestions, setSuggestions]     = useState([]);
    const [expansions, setExpansions]       = useState([]);
    const [showDropdown, setShowDropdown]   = useState(false);
    const [suggLoading, setSuggLoading]     = useState(false);
    const debounceRef  = useRef(null);
    const expandRef    = useRef(null);
    const wrapperRef   = useRef(null);
    const abortRef     = useRef(null);
    const inputRef = useRef(null);
    const composingRef = useRef(false);
    const [activeSuggestion, setActiveSuggestion] = useState(-1);
    useEffect(() => () => {
        clearTimeout(debounceRef.current);
        clearTimeout(expandRef.current);
        abortRef.current?.abort();
    }, []);

    // Sync controlled value from parent
    useEffect(() => {
        setInputVal(value ?? '');
    }, [value]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // NLP abbreviation / synonym map (mirrors NlpSearchService — client-side preview only)
    const CLIENT_EXPANSIONS = {
        ml: ['machine learning', 'deep learning'],
        ai: ['artificial intelligence', 'machine learning'],
        iot: ['internet of things', 'smart devices'],
        nlp: ['natural language processing'],
        cv: ['computer vision'],
        dl: ['deep learning', 'neural network'],
        nn: ['neural network'],
        ar: ['augmented reality'],
        vr: ['virtual reality'],
        api: ['application programming interface'],
        ui: ['user interface'],
        ux: ['user experience'],
        pos: ['point of sale'],
        erp: ['enterprise resource planning'],
        lms: ['learning management system'],
        gis: ['geographic information system'],
        gps: ['global positioning system'],
        rfid: ['radio frequency identification'],
        it: ['information technology'],
        cs: ['computer science'],
        se: ['software engineering'],
    };

    const getClientExpansions = useCallback((q) => {
        if (!q || q.length < 2) return [];
        const lower = q.toLowerCase().trim();
        const result = new Set();
        // Direct abbreviation match
        if (CLIENT_EXPANSIONS[lower]) {
            CLIENT_EXPANSIONS[lower].forEach(t => result.add(t));
        }
        // Check if any known synonym key is contained in query
        Object.entries(CLIENT_EXPANSIONS).forEach(([abbr, expansions]) => {
            if (lower.includes(abbr) && abbr.length > 1) {
                expansions.forEach(t => result.add(t));
            }
        });
        return [...result].slice(0, 4);
    }, []);

    const fetchSuggestions = useCallback(async (q) => {
        if (!q || q.length < 2) {
            setSuggestions([]);
            return;
        }
        setSuggLoading(true);
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const res = await api.get('/published/suggest', {
                params: { q, limit: 6 },
                signal: controller.signal,
            });
            if (!controller.signal.aborted) setSuggestions(res.data?.data || []);
        } catch {
            if (!controller.signal.aborted) setSuggestions([]);
        } finally {
            if (!controller.signal.aborted) setSuggLoading(false);
        }
    }, []);

    const handleInput = (e) => {
        const q = e.target.value;
        setInputVal(q);
        setActiveSuggestion(-1);
        clearTimeout(debounceRef.current);
        clearTimeout(expandRef.current);
        abortRef.current?.abort();
        if (composingRef.current) return;
        setShowDropdown(true);

        // Client-side expansion preview (instant)
        setExpansions(getClientExpansions(q));

        // Debounce: notify parent after 350ms
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            onChange(q);
        }, 350);

        // Debounce: fetch suggestions after 250ms
        clearTimeout(expandRef.current);
        expandRef.current = setTimeout(() => {
            fetchSuggestions(q);
        }, 250);
    };

    const handleSuggestionClick = (suggestion) => {
        clearTimeout(debounceRef.current);
        clearTimeout(expandRef.current);
        abortRef.current?.abort();
        const val = typeof suggestion === 'string' ? suggestion : suggestion.name;
        setInputVal(val);
        onChange(val);
        setSuggestions([]);
        setExpansions(getClientExpansions(val));
        setShowDropdown(false);
        inputRef.current?.focus();
    };

    const handleClear = () => {
        clearTimeout(debounceRef.current);
        clearTimeout(expandRef.current);
        abortRef.current?.abort();
        setInputVal('');
        onChange('');
        setSuggestions([]);
        setExpansions([]);
        setShowDropdown(false);
        inputRef.current?.focus();
    };

    const showSuggList  = showDropdown && suggestions.length > 0;
    const showExpansion = expansions.length > 0 && inputVal.length > 0;

    return (
        <div ref={wrapperRef} className={`relative ${className}`}>
            {/* Input */}
            <div className="relative flex items-center">
                <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                    ref={inputRef}
                    id={id}
                    role="combobox" aria-label="Search capstone research" aria-autocomplete="list"
                    aria-expanded={showSuggList} aria-controls={showSuggList ? `${id}-suggestions` : undefined}
                    aria-activedescendant={showSuggList && activeSuggestion >= 0 ? `${id}-suggestion-${activeSuggestion}` : undefined}
                    type="text"
                    value={inputVal}
                    onChange={handleInput}
                    onCompositionStart={() => { composingRef.current = true; clearTimeout(debounceRef.current); clearTimeout(expandRef.current); }}
                    onCompositionEnd={e => { composingRef.current = false; handleInput(e); }}
                    onKeyDown={e => {
                        if (e.nativeEvent.isComposing) return;
                        if (e.key === 'Escape') { setShowDropdown(false); setActiveSuggestion(-1); }
                        if (['ArrowDown', 'ArrowUp'].includes(e.key) && suggestions.length) {
                            e.preventDefault(); setShowDropdown(true);
                            setActiveSuggestion(i => e.key === 'ArrowDown' ? (i + 1) % suggestions.length : (i <= 0 ? suggestions.length - 1 : i - 1));
                        }
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            if (showSuggList && activeSuggestion >= 0) handleSuggestionClick(suggestions[activeSuggestion]);
                            else { clearTimeout(debounceRef.current); onChange(inputVal); setShowDropdown(false); }
                        }
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder={placeholder}
                    autoComplete="off"
                    className="w-full pl-10 pr-9 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-shadow"
                />
                {inputVal && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
                        aria-label="Clear search"
                    >
                        <HiOutlineX className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* NLP expansion hint */}
            {showExpansion && (
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <HiOutlineSparkles className="w-3 h-3 text-green-500 flex-shrink-0" />
                    <span className="text-[10px] text-gray-400">Also searching:</span>
                    {expansions.map((exp, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => handleSuggestionClick(exp)}
                            className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full hover:bg-green-100 transition-colors font-medium"
                        >
                            {exp}
                        </button>
                    ))}
                </div>
            )}

            {/* Autocomplete dropdown */}
            {showSuggList && (
                <div id={`${id}-suggestions`} role="listbox" aria-label="Search suggestions" className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    {suggLoading && (
                        <div className="px-4 py-2 text-xs text-gray-400">Loading suggestions…</div>
                    )}
                    {suggestions.map((s, i) => {
                        const label = typeof s === 'string' ? s : s.name;
                        return (
                            <button
                                key={i}
                                id={`${id}-suggestion-${i}`} role="option" aria-selected={activeSuggestion === i} tabIndex={-1}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleSuggestionClick(s)}
                                style={activeSuggestion === i ? { background: 'var(--color-bg-tertiary)' } : undefined}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800 transition-colors flex items-center gap-2"
                            >
                                <HiOutlineSearch className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                {label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
