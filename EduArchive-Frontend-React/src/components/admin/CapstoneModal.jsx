import { useNavigate } from 'react-router-dom';
import { HiX, HiArrowRight } from 'react-icons/hi';

export default function CapstoneModal({ capstone, open, onClose, onViewFull }) {
    const navigate = useNavigate();

    if (!open || !capstone) return null;

    const handleViewFull = () => {
        if (onViewFull) {
            onViewFull();
        } else {
            onClose();
            navigate(`/admin/capstones/${capstone.id}`);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col animate-scale-in">
                {/* Header */}
                <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 pr-8 leading-tight">{capstone.title}</h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
                    >
                        <HiX className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 custom-scrollbar">
                    <div className="grid grid-cols-2 gap-4">
                        <InfoField label="Year" value={capstone.year || '—'} />
                        <InfoField label="Program" value={capstone.program || '—'} />
                        <InfoField label="Author" value={capstone.author || '—'} />
                        <InfoField label="Category" value={capstone.category || '—'} />
                    </div>

                    {/* Keywords */}
                    {capstone.keywords?.length > 0 && (
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase block mb-2">Keywords</label>
                            <div className="flex flex-wrap gap-2">
                                {capstone.keywords.map((kw, i) => (
                                    <span key={i} className="px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-full border border-green-200">
                                        {kw.name || kw}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Abstract */}
                    {capstone.abstract && (
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase block mb-2">Abstract</label>
                            <p className="text-sm text-gray-700 leading-relaxed text-justify indent-8">
                                {capstone.abstract.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim()}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end px-6 py-4 border-t border-gray-200">
                    <button
                        onClick={handleViewFull}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#1B5E20] text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors"
                    >
                        View Full Page
                        <HiArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function InfoField({ label, value }) {
    return (
        <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">{label}</label>
            <p className="text-sm text-gray-800">{value}</p>
        </div>
    );
}
