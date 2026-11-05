import { useState, useEffect, useRef, useId } from 'react';
import { getPublishedCategories } from '../api/admin';

/**
 * Category Combobox — a dropdown that shows existing categories
 * but also allows typing a new custom category.
 */
export default function CategoryCombobox({ value, onChange, className = '', id, disabled = false, 'aria-label': ariaLabel = 'Category' }) {
    const generatedId = useId();
    const inputId = id || generatedId;
    const [activeIndex, setActiveIndex] = useState(-1);
    const [categories, setCategories] = useState([]);
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState('');
    const wrapperRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        getPublishedCategories()
            .then(res => setCategories(res.data.data || []))
            .catch(() => {});
    }, []);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // API returns either plain strings or objects { name, count } — normalise to strings
    const categoryNames = categories.map(cat => (cat && typeof cat === 'object' ? cat.name : cat)).filter(Boolean);

    const filtered = categoryNames.filter(name =>
        name.toLowerCase().includes((filter || value || '').toLowerCase())
    );

    const handleInputChange = (e) => {
        const v = e.target.value;
        onChange(v);
        setFilter(v);
        setActiveIndex(-1);
        if (!open) setOpen(true);
    };

    const handleSelect = (cat) => {
        onChange(cat);
        setFilter('');
        setOpen(false);
        setActiveIndex(-1);
        inputRef.current?.focus();
    };

    const handleFocus = () => {
        if (disabled) return;
        setOpen(true);
        setFilter('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            setOpen(false);
            setActiveIndex(-1);
        }
        if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
            e.preventDefault(); setOpen(true);
            if (filtered.length) setActiveIndex(i => e.key === 'ArrowDown' ? (i + 1) % filtered.length : (i <= 0 ? filtered.length - 1 : i - 1));
        }
        if (e.key === 'Enter' && open && activeIndex >= 0 && filtered[activeIndex]) {
            e.preventDefault(); handleSelect(filtered[activeIndex]);
        }
        if (e.key === 'Tab') {
            setOpen(false);
        }
    };

    return (
        <div ref={wrapperRef} className="relative">
            <input
                ref={inputRef}
                id={inputId} role="combobox" aria-label={ariaLabel} aria-autocomplete="list"
                aria-expanded={open} aria-controls={open ? `${inputId}-options` : undefined}
                aria-activedescendant={open && activeIndex >= 0 ? `${inputId}-option-${activeIndex}` : undefined}
                type="text"
                value={value}
                disabled={disabled}
                onChange={handleInputChange}
                onFocus={handleFocus}
                onKeyDown={handleKeyDown}
                placeholder="Select or type a category..."
                autoComplete="off"
                className={className || 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none'}
            />
            {/* Dropdown chevron */}
            <button
                type="button"
                aria-label="Show category suggestions" aria-expanded={open}
                tabIndex={-1}
                disabled={disabled}
                onClick={() => { setOpen(!open); inputRef.current?.focus(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
            >
                <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown panel */}
            {open && (
                <div id={`${inputId}-options`} role="listbox" aria-label="Categories" className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                    {filtered.length > 0 ? (
                        filtered.map((cat, i) => (
                            <button
                                key={i}
                                id={`${inputId}-option-${i}`} role="option" aria-selected={cat === value} tabIndex={-1}
                                onMouseDown={e => e.preventDefault()}
                                style={activeIndex === i ? { background: 'var(--color-bg-tertiary)' } : undefined}
                                type="button"
                                onClick={() => handleSelect(cat)}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-green-50 hover:text-green-700 transition-colors ${
                                    cat === value ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-700'
                                }`}
                            >
                                {cat}
                            </button>
                        ))
                    ) : (
                        <div className="px-3 py-2 text-xs text-gray-400 italic">
                            {value ? `"${value}" will be added as a new category` : 'No categories yet'}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
