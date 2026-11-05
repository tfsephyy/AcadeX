import Loading from './Loading'

/**
 * Shared terminal-state UI for the authenticated PDF blob download.
 * Metadata is already rendered by the page; this only describes the document request.
 */
export default function PdfLoadState({ status, progress, error, onRetry, emptyText = 'No PDF available.' }) {
    if (status === 'loading') {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-2 text-center px-6" role="status" aria-live="polite">
                <Loading text={progress !== null && progress !== undefined ? `Opening document… ${progress}%` : 'Opening document…'} />
                <p className="text-xs text-gray-400">The record is ready. The document may take a moment on a slow connection.</p>
            </div>
        )
    }
    if (status === 'error') {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6" role="alert">
                <p className="text-sm font-medium text-gray-700">{error || 'The document could not be loaded.'}</p>
                {onRetry && (
                    <button onClick={onRetry} className="px-4 py-2 bg-[#1B5E20] text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors">
                        Retry document
                    </button>
                )}
            </div>
        )
    }
    return <div className="flex items-center justify-center py-20 text-gray-400">{emptyText}</div>
}
