import { HiOutlineChevronLeft, HiOutlineChevronRight } from 'react-icons/hi';

/**
 * Reusable Pagination Component
 * 
 * @param {Object} paginationData - Pagination metadata from API
 * @param {number} paginationData.current_page - Current page number
 * @param {number} paginationData.last_page - Total number of pages
 * @param {number} paginationData.total - Total number of items
 * @param {number} paginationData.from - First item number on current page
 * @param {number} paginationData.to - Last item number on current page
 * @param {number} page - Current page state
 * @param {function} onPageChange - Callback when page changes
 * @param {number} perPage - Items per page (default: 15)
 */
export default function Pagination({ paginationData, page, onPageChange, perPage = 15 }) {
    if (!paginationData || paginationData.total === 0) return null;
    
    const { current_page, last_page, total, from, to } = paginationData;
    
    // Calculate page numbers to display (max 5 buttons)
    const getPageNumbers = () => {
        const pages = [];
        const maxButtons = 5;
        
        if (last_page <= maxButtons) {
            // Show all pages if total is 5 or less
            for (let i = 1; i <= last_page; i++) {
                pages.push(i);
            }
        } else if (page <= 3) {
            // Near the start: show first 5
            for (let i = 1; i <= maxButtons; i++) {
                pages.push(i);
            }
        } else if (page >= last_page - 2) {
            // Near the end: show last 5
            for (let i = last_page - 4; i <= last_page; i++) {
                pages.push(i);
            }
        } else {
            // In the middle: show current page ± 2
            for (let i = page - 2; i <= page + 2; i++) {
                pages.push(i);
            }
        }
        
        return pages;
    };
    
    const pageNumbers = getPageNumbers();
    
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50">
            {/* Items info */}
            <p className="text-xs text-gray-700">
                Showing <span className="font-medium text-gray-900">{from || 1}</span> to{' '}
                <span className="font-medium text-gray-900">{to || Math.min(perPage, total)}</span> of{' '}
                <span className="font-medium text-gray-900">{total}</span> {total === 1 ? 'entry' : 'entries'}
            </p>
            
            {/* Page controls */}
            <div className="flex items-center gap-1">
                {/* Previous button */}
                <button
                    onClick={() => onPageChange(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="p-2 text-gray-700 hover:bg-gray-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                    title="Previous page"
                >
                    <HiOutlineChevronLeft className="w-4 h-4" />
                </button>
                
                {/* Page number buttons */}
                {pageNumbers.map((pageNum) => (
                    <button
                        key={pageNum}
                        onClick={() => onPageChange(pageNum)}
                        className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${
                            pageNum === page
                                ? 'bg-green-600 text-white shadow-sm'
                                : 'text-gray-800 hover:bg-gray-200'
                        }`}
                        aria-label={`Page ${pageNum}`}
                        aria-current={pageNum === page ? 'page' : undefined}
                    >
                        {pageNum}
                    </button>
                ))}
                
                {/* Next button */}
                <button
                    onClick={() => onPageChange(Math.min(last_page, page + 1))}
                    disabled={page >= last_page}
                    className="p-2 text-gray-700 hover:bg-gray-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next page"
                    title="Next page"
                >
                    <HiOutlineChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
