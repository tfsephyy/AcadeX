import { useState, useRef } from 'react';
import { HiOutlineUpload, HiOutlineX, HiOutlinePlus, HiOutlineDocumentText } from 'react-icons/hi';
import { uploadCapstone, storeCapstone } from '../../api/admin';
import { useNotification } from '../../components/Notification';
import { LoadingOverlay } from '../../components/Loading';
import CategoryCombobox from '../../components/CategoryCombobox';

export default function UploadCapstoneModal({ open, onClose, onSuccess }) {
    const notify = useNotification();
    const fileRef = useRef(null);
    const [step, setStep] = useState(1); // 1=upload, 2=edit extracted
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [file, setFile] = useState(null);
    const [pdfInfo, setPdfInfo] = useState(null);
    const [form, setForm] = useState({
        title: '', year: '', author: '', program: '', category: '', abstract: '', keywords: [],
    });
    const [newKeyword, setNewKeyword] = useState('');

    if (!open) return null;

    const resetState = () => {
        setStep(1);
        setFile(null);
        setPdfInfo(null);
        setForm({ title: '', year: '', author: '', program: '', category: '', abstract: '', keywords: [] });
        setNewKeyword('');
    };

    const handleClose = () => {
        resetState();
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
        if (!file) {
            notify.error('Please select a PDF file.');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('pdf', file);
            const res = await uploadCapstone(formData);
            const data = res.data.data;

            setPdfInfo({
                pdf_path: data.pdf_path,
                pdf_original_name: data.pdf_original_name,
            });

            setForm({
                title: data.extracted?.title || '',
                year: data.extracted?.year || '',
                author: data.extracted?.author || '',
                program: data.extracted?.program || '',
                category: data.extracted?.category || '',
                abstract: data.extracted?.abstract || '',
                keywords: data.extracted?.keywords || [],
            });

            setStep(2);
            notify.success('PDF uploaded and data extracted!');
        } catch (err) {
            notify.error(err.response?.data?.message || 'Upload failed.');
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (!form.title.trim()) {
            notify.error('Title is required.');
            return;
        }
        if (!form.author.trim()) {
            notify.error('Author is required.');
            return;
        }

        setSaving(true);
        try {
            await storeCapstone({
                ...form,
                pdf_path: pdfInfo.pdf_path,
                pdf_original_name: pdfInfo.pdf_original_name,
            });
            notify.success('Capstone saved successfully!');
            resetState();
            onSuccess();
        } catch (err) {
            notify.error(err.response?.data?.message || 'Failed to save capstone.');
        } finally {
            setSaving(false);
        }
    };

    const addKeyword = () => {
        const kw = newKeyword.trim().toLowerCase();
        if (kw && !form.keywords.includes(kw)) {
            setForm(prev => ({ ...prev, keywords: [...prev.keywords, kw] }));
            setNewKeyword('');
        }
    };

    const removeKeyword = (idx) => {
        setForm(prev => ({
            ...prev,
            keywords: prev.keywords.filter((_, i) => i !== idx),
        }));
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
            <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col animate-scale-in">
                {(uploading || saving) && <LoadingOverlay text={uploading ? 'Uploading & extracting...' : 'Saving...'} />}

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#1B5E20] to-[#2E7D32] rounded-t-xl">
                    <div>
                        <h2 className="text-lg font-semibold text-white">
                            {step === 1 ? 'Upload Capstone PDF' : 'Review Extracted Data'}
                        </h2>
                        <p className="text-green-200 text-xs mt-0.5">
                            {step === 1 ? 'Select a PDF file to extract metadata' : 'Verify and edit the extracted information'}
                        </p>
                    </div>
                    <button onClick={handleClose} className="p-1.5 text-green-200 hover:text-white rounded-lg hover:bg-white/20 transition-colors">
                        <HiOutlineX className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {step === 1 ? (
                        /* Step 1: File Upload */
                        <div className="space-y-4">
                            <div
                                onClick={() => fileRef.current?.click()}
                                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-green-400 hover:bg-green-50/30 transition-all"
                            >
                                {file ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <HiOutlineDocumentText className="w-12 h-12 text-green-500" />
                                        <p className="text-sm font-medium text-gray-700">{file.name}</p>
                                        <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                            className="text-xs text-red-500 hover:text-red-700"
                                        >
                                            Remove file
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <HiOutlineUpload className="w-12 h-12 text-gray-300" />
                                        <p className="text-sm font-medium text-gray-500">Click to select PDF file</p>
                                        <p className="text-xs text-gray-400">PDF only, max 50MB</p>
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
                    ) : (
                        /* Step 2: Edit Extracted Data */
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Title *</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Year</label>
                                    <input
                                        type="number"
                                        value={form.year}
                                        onChange={(e) => setForm(prev => ({ ...prev, year: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                        min="2000"
                                        max="2099"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Program</label>
                                    <select
                                        value={form.program}
                                        onChange={(e) => setForm(prev => ({ ...prev, program: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                    >
                                        <option value="">Select program</option>
                                        <option value="BSIT">BSIT</option>
                                        <option value="BSCpE">BSCpE</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                                    <CategoryCombobox
                                        value={form.category}
                                        onChange={(v) => setForm(prev => ({ ...prev, category: v }))}
                                        className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Author *</label>
                                <input
                                    type="text"
                                    value={form.author}
                                    onChange={(e) => setForm(prev => ({ ...prev, author: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Abstract</label>
                                <textarea
                                    value={form.abstract}
                                    onChange={(e) => setForm(prev => ({ ...prev, abstract: e.target.value }))}
                                    rows={4}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none resize-y"
                                />
                            </div>

                            {/* Keywords */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-2">Keywords</label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {form.keywords.map((kw, idx) => (
                                        <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-full border border-green-200">
                                            {kw}
                                            <button onClick={() => removeKeyword(idx)} className="text-green-500 hover:text-red-500 transition-colors">
                                                <HiOutlineX className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newKeyword}
                                        onChange={(e) => setNewKeyword(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                                        placeholder="Add keyword..."
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                    />
                                    <button
                                        onClick={addKeyword}
                                        className="inline-flex items-center gap-1 px-3 py-2 bg-green-50 text-green-700 text-sm font-medium rounded-lg border border-green-200 hover:bg-green-100 transition-colors"
                                    >
                                        <HiOutlinePlus className="w-4 h-4" /> Add
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                    {step === 1 ? (
                        <>
                            <button onClick={handleClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                                Cancel
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={!file || uploading}
                                className="inline-flex items-center gap-2 px-5 py-2 bg-[#1B5E20] text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50"
                            >
                                <HiOutlineUpload className="w-4 h-4" />
                                Upload & Extract
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-5 py-2 bg-[#1B5E20] text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save Capstone'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
