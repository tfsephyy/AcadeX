import { useState, useEffect, useRef } from 'react';
import { getPublishedCategories } from '../api/admin';

/**
 * Category Combobox — a dropdown that shows existing categories
 * but also allows typing a new custom category.
 */
export default function CategoryCombobox({ value, onChange, className = '', labelClass = '' }) {
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

    const filtered = categories.filter(cat =>
        cat.toLowerCase().includes((filter || value || '').toLowerCase())
    );

    const handleInputChange = (e) => {
        const v = e.target.value;
        onChange(v);
        setFilter(v);
        if (!open) setOpen(true);
    };

    const handleSelect = (cat) => {
        onChange(cat);
        setFilter('');
        setOpen(false);
    };

    const handleFocus = () => {
        setOpen(true);
        setFilter('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
        }
    };

    return (
        <div ref={wrapperRef} className="relative">
            <input
                ref={inputRef}
                type="text"
                value={value}
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
                tabIndex={-1}
                onClick={() => { setOpen(!open); inputRef.current?.focus(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
            >
                <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown panel */}
            {open && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                    {filtered.length > 0 ? (
                        filtered.map((cat, i) => (
                            <button
                                key={i}
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
