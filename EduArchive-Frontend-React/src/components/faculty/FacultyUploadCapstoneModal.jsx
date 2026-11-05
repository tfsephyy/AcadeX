import { createPortal } from 'react-dom';
import UploadFeedback from '../UploadFeedback';
import { useCapstoneUpload } from '../useCapstoneUpload';
import { useDialogFocus } from '../useDialogFocus';
import { validateCapstonePdf } from '../pdfUploadValidation';
import { useState, useRef } from 'react';
import { HiOutlineUpload, HiOutlineX, HiOutlineDocumentText } from 'react-icons/hi';
import { useNotification } from '../../components/useNotification';

export default function FacultyUploadCapstoneModal({ open, onClose }) {
    const notify   = useNotification();
    const fileRef  = useRef(null);

    const [file, setFile]           = useState(null);

    const { uploading, transfer, startUpload } = useCapstoneUpload('faculty', () => { setFile(null); onClose(); });
    const isBusy = uploading;
    const handleUpload = () => startUpload(file);

    const dialogRef = useDialogFocus(open, () => {
        if (!uploading) { setFile(null); onClose(); }
    });
    if (!open) return null;

    const handleClose = () => {
        if (uploading) return;
        setFile(null);
        onClose();
    };

    const handleFileSelect = (e) => {
        const selected = e.target.files[0];
        if (!selected) return;
        const error = validateCapstonePdf(selected);
        if (error) { notify.error(error); e.target.value = ''; return; }
        setFile(selected);
    };

    return (
        createPortal(<div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="fixed inset-0 ui-dialog-backdrop" onClick={handleClose} />
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Upload capstone PDF" tabIndex={-1} className="ui-dialog relative bg-white rounded-xl shadow-2xl max-w-lg w-full flex flex-col animate-scale-in overflow-hidden border border-green-100">

                {/* Header */}
                <div className="upload-heading flex items-start justify-between gap-4 px-6 py-4">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Upload Capstone PDF</h2>
                        <p className="text-green-200 text-xs mt-0.5">
                            {isBusy ? 'Sending your file securely…' : 'Select a PDF file to extract metadata automatically'}
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
                            aria-label="Close upload" onClick={handleClose}
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
                            <UploadFeedback transfer={transfer} />
                        </div>
                    ) : (
                        <div
                            role="button" tabIndex={0} aria-label={file ? 'Choose a different PDF' : 'Choose a capstone PDF'}
                            onKeyDown={e => { if (e.target === e.currentTarget && ['Enter', ' '].includes(e.key)) { e.preventDefault(); fileRef.current?.click(); } }}
                            onClick={() => fileRef.current?.click()}
                            className="upload-dropzone border border-dashed border-green-300 rounded-xl p-12 text-center cursor-pointer hover:border-green-500 hover:bg-green-50/50 transition-all bg-green-50/20"
                        >
                            {file ? (
                                <div className="flex flex-col items-center gap-3">
                                    <HiOutlineDocumentText className="w-16 h-16 text-green-500" />
                                    <p className="text-sm font-semibold text-gray-800">{file.name}</p>
                                    <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MiB</p>
                                    <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-xs text-red-500 hover:text-red-700 underline">
                                        Remove file
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-3">
                                    <HiOutlineUpload className="w-16 h-16 text-gray-300" />
                                    <p className="text-sm font-semibold text-gray-500">Click to select PDF file</p>
                                    <p className="text-xs text-gray-400">PDF only · Up to 128 MiB</p>
                                </div>
                            )}
                        </div>
                    )}
                    <input ref={fileRef} type="file" accept=".pdf,application/pdf" onChange={handleFileSelect} className="hidden" />
                </div>

                {/* Footer */}
                <div className="upload-footer flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-3 ml-auto">
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
        </div>, document.body)
    );
}
