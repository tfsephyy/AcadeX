import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineUpload, HiOutlineX, HiOutlineDocumentText } from 'react-icons/hi';
import { uploadCapstone } from '../../api/admin';
import { useNotification } from '../../components/Notification';
import { LoadingOverlay } from '../../components/Loading';

export default function UploadCapstoneModal({ open, onClose }) {
    const notify = useNotification();
    const navigate = useNavigate();
    const fileRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState(null);

    if (!open) return null;

    const handleClose = () => {
        setFile(null);
        onClose();
    };

    const handleFileSelect = (e) => {
        const selected = e.target.files[0];
        if (selected && selected.type === 'application/pdf') {
            setFile(selected);
        } else {
            notify.error('Please select a PDF file.');
        }
    };

    const handleUpload = async () => {
        if (!file) { notify.error('Please select a PDF file.'); return; }
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('pdf', file);
            const res = await uploadCapstone(formData);
            const data = res.data.data;

            onClose();
            // Navigate to the Review Extracted Data page
            navigate('/admin/capstone-library/review-data', {
                state: {
                    pdfInfo: {
                        pdf_path: data.pdf_path,
                        pdf_original_name: data.pdf_original_name,
                    },
                    extracted: data.extracted || {},
                },
            });
        } catch (err) {
            notify.error(err.response?.data?.message || 'Upload failed.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
            <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full flex flex-col animate-scale-in overflow-hidden border border-green-100">
                {uploading && <LoadingOverlay text="Uploading & extracting..." />}

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#1B5E20] to-[#2E7D32]">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Upload Capstone PDF</h2>
                        <p className="text-green-200 text-xs mt-0.5">Select a PDF file to extract metadata automatically</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-white text-[#1B5E20]">1</div>
                            <div className="w-8 h-0.5 bg-white/30" />
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-white/30 text-white">2</div>
                            <div className="w-8 h-0.5 bg-white/30" />
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-white/30 text-white">3</div>
                        </div>
                        <button onClick={handleClose} className="p-1.5 text-green-200 hover:text-white rounded-lg hover:bg-white/20 transition-colors ml-2">
                            <HiOutlineX className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="px-6 py-8">
                    <div
                        onClick={() => fileRef.current?.click()}
                        className="border-2 border-dashed border-green-300 rounded-xl p-12 text-center cursor-pointer hover:border-green-500 hover:bg-green-50/50 transition-all bg-green-50/20"
                    >
                        {file ? (
                            <div className="flex flex-col items-center gap-3">
                                <HiOutlineDocumentText className="w-16 h-16 text-green-500" />
                                <p className="text-sm font-semibold text-gray-800">{file.name}</p>
                                <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                    className="text-xs text-red-500 hover:text-red-700 underline"
                                >
                                    Remove file
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-3">
                                <HiOutlineUpload className="w-16 h-16 text-gray-300" />
                                <p className="text-sm font-semibold text-gray-500">Click to select PDF file</p>
                                <p className="text-xs text-gray-400">PDF only · max 50MB</p>
                            </div>
                        )}
                    </div>
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <button onClick={handleClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={!file || uploading}
                        className="inline-flex items-center gap-2 px-5 py-2 bg-[#1B5E20] text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        <HiOutlineUpload className="w-4 h-4" />
                        Upload & Extract
                    </button>
                </div>
            </div>
        </div>
    );
}
