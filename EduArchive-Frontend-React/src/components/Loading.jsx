export default function Loading({ text = 'Loading...' }) {
    return (
        <div className="flex flex-col items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
            <p className="mt-4 text-sm text-gray-500">{text}</p>
        </div>
    );
}

export function LoadingOverlay({ text = 'Loading...', onSkip = null, skipText = 'Skip' }) {
    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-white/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
                <p className="text-sm font-medium text-gray-600">{text}</p>
                {onSkip && (
                    <button
                        onClick={onSkip}
                        className="mt-2 px-5 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100 transition-all shadow-md border border-gray-300 hover:border-gray-400"
                    >
                        {skipText}
                    </button>
                )}
            </div>
        </div>
    );
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
    return (
        <div className="animate-pulse">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex gap-4 py-3 border-b border-gray-100">
                    {Array.from({ length: cols }).map((_, j) => (
                        <div key={j} className="flex-1 h-4 bg-gray-200 rounded" />
                    ))}
                </div>
            ))}
        </div>
    );
}
