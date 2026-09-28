import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineUpload, HiOutlineX, HiOutlineDocumentText, HiOutlineArrowRight } from 'react-icons/hi';
import axios from '../../api/axios';
import { useNotification } from '../Notification';

export default function StudentUploadCapstoneModal({ open, onClose }) {
    const notify   = useNotification();
    const navigate = useNavigate();
    const fileRef  = useRef(null);
    const abortRef = useRef(null);

    const [uploading, setUploading] = useState(false);
    const [skipping,  setSkipping]  = useState(false);
    const [file, setFile]           = useState(null);

    if (!open) return null;

    const handleClose = () => {
        if (uploading || skipping) return;
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

    const handleSkip = async () => {
        if (!file || skipping) return;
        abortRef.current?.abort();
        setSkipping(true);
        try {
            const fd = new FormData();
            fd.append('pdf', file);
            fd.append('skip_extraction', '1');
            const res  = await axios.post('/student/capstones/upload', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const data = res.data.data;
            onClose();
            navigate('/student/capstone-library/review-data', {
                state: {
                    pdfInfo: { pdf_path: data.pdf_path, pdf_original_name: data.pdf_original_name },
                    extracted: {},
                    skipped: true,
                },
            });
        } catch (err) {
            notify.error(err.response?.data?.message || 'Upload failed. Please try again.');
            setSkipping(false);
            setUploading(false);
        }
    };

    const handleUpload = async () => {
        if (!file) { notify.error('Please select a PDF file.'); return; }
        const controller = new AbortController();
        abortRef.current = controller;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('pdf', file);
            const res  = await axios.post('/student/capstones/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                signal: controller.signal,
            });
            const data = res.data.data;
            onClose();
            navigate('/student/capstone-library/review-data', {
                state: {
                    pdfInfo: { pdf_path: data.pdf_path, pdf_original_name: data.pdf_original_name },
                    extracted: data.extracted || {},
                    skipped: false,
                },
            });
        } catch (err) {
            if (axios.isCancel?.(err) || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
            notify.error(err.response?.data?.message || 'Upload failed.');
            setUploading(false);
        }
    };

    const isBusy = uploading || skipping;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
            <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full flex flex-col animate-scale-in overflow-hidden border border-green-100">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#1B5E20] to-[#2E7D32]">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Upload Capstone PDF</h2>
                        <p className="text-green-200 text-xs mt-0.5">
                            {isBusy ? 'Processing your file…' : 'Select a PDF file to extract metadata automatically'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-white text-[#1B5E20]">1</div>
                            <div className="w-8 h-0.5 bg-white/30" />
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-white/30 text-white">2</div>
                            <div className="w-8 h-0.5 bg-white/30" />
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-white/30 text-white">3</div>
                        </div>
                        <button
                            onClick={handleClose}
                            disabled={isBusy}
                            className="p-1.5 text-green-200 hover:text-white rounded-lg hover:bg-white/20 transition-colors ml-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <HiOutlineX className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="px-6 py-8">
                    {isBusy ? (
                        <div className="flex flex-col items-center gap-5 py-4">
                            <div className="relative w-20 h-20">
                                <svg className="animate-spin w-20 h-20 text-green-600" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                <HiOutlineDocumentText className="absolute inset-0 m-auto w-8 h-8 text-green-600" />
                            </div>
                            <div className="text-center">
                                {skipping ? (
                                    <>
                                        <p className="text-sm font-semibold text-gray-800">Uploading file…</p>
                                        <p className="text-xs text-gray-400 mt-1">Skipping extraction — almost done.</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm font-semibold text-gray-800">Uploading &amp; Extracting Data…</p>
                                        <p className="text-xs text-gray-400 mt-1">This may take a moment for scanned PDFs.</p>
                                    </>
                                )}
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full animate-pulse" style={{ width: '70%' }} />
                            </div>
                        </div>
                    ) : (
                        <div
                            onClick={() => fileRef.current?.click()}
                            className="border-2 border-dashed border-green-300 rounded-xl p-12 text-center cursor-pointer hover:border-green-500 hover:bg-green-50/50 transition-all bg-green-50/20"
                        >
                            {file ? (
                                <div className="flex flex-col items-center gap-3">
                                    <HiOutlineDocumentText className="w-16 h-16 text-green-500" />
                                    <p className="text-sm font-semibold text-gray-800">{file.name}</p>
                                    <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                    <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-xs text-red-500 hover:text-red-700 underline">
                                        Remove file
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-3">
                                    <HiOutlineUpload className="w-16 h-16 text-gray-300" />
                                    <p className="text-sm font-semibold text-gray-500">Click to select PDF file</p>
                                    <p className="text-xs text-gray-400">PDF only</p>
                                </div>
                            )}
                        </div>
                    )}
                    <input ref={fileRef} type="file" accept=".pdf,application/pdf" onChange={handleFileSelect} className="hidden" />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <div>
                        {uploading && !skipping && (
                            <button
                                id="student-skip-extraction-btn"
                                onClick={handleSkip}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-300 rounded-lg hover:bg-amber-100 active:scale-95 transition-all"
                            >
                                <HiOutlineArrowRight className="w-4 h-4" />
                                Skip &amp; Enter Manually
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {!isBusy && (
                            <>
                                <button onClick={handleClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpload}
                                    disabled={!file}
                                    className="inline-flex items-center gap-2 px-5 py-2 bg-[#1B5E20] text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                >
                                    <HiOutlineUpload className="w-4 h-4" />
                                    Upload &amp; Extract
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
