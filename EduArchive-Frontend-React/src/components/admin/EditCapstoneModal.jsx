import { useState, useEffect } from 'react';
import { HiOutlineX } from 'react-icons/hi';
import { updateCapstone } from '../../api/admin';
import { useNotification } from '../../components/Notification';
import { LoadingOverlay } from '../../components/Loading';
import CategoryCombobox from '../../components/CategoryCombobox';

export default function EditCapstoneModal({ capstone, onClose, onSuccess, updateFn }) {
    const actualUpdate = updateFn || updateCapstone;
    const notify = useNotification();
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        title: '',
        year: '',
        author: '',
        program: '',
        category: '',
        abstract: '',
        keywords: [],
    });
    const [newKeyword, setNewKeyword] = useState('');

    useEffect(() => {
        setForm({
            title: capstone.title || '',
            year: capstone.year || '',
            author: capstone.author || '',
            program: capstone.program || '',
            category: capstone.category || '',
            abstract: capstone.abstract || '',
            keywords: capstone.keywords?.map(k => k.name) || [],
        });
    }, [capstone]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleAddKeyword = () => {
        if (newKeyword.trim() && !form.keywords.includes(newKeyword.trim())) {
            setForm(prev => ({
                ...prev,
                keywords: [...prev.keywords, newKeyword.trim()]
            }));
            setNewKeyword('');
        }
    };

    const handleRemoveKeyword = (keyword) => {
        setForm(prev => ({
            ...prev,
            keywords: prev.keywords.filter(k => k !== keyword)
        }));
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
            await actualUpdate(capstone.id, form);
            notify.success('Capstone updated successfully!');
            onSuccess();
        } catch (err) {
            notify.error(err.response?.data?.message || 'Failed to update capstone.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
            {saving && <LoadingOverlay />}
            <div className="bg-white w-full sm:w-full sm:max-w-2xl rounded-t-2xl sm:rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                {/* Header */}
                <div className="sticky top-0 flex items-center justify-between gap-3 p-6 border-b border-gray-200 bg-white">
                    <h2 className="text-xl font-bold text-gray-900">Edit Capstone</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
                    >
                        <HiOutlineX className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <div className="p-6 space-y-4">
                    {/* Title */}
                    <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-1">Title *</label>
                        <input
                            type="text"
                            name="title"
                            value={form.title}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        />
                    </div>

                    {/* Author */}
                    <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-1">Author *</label>
                        <input
                            type="text"
                            name="author"
                            value={form.author}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        />
                    </div>

                    {/* Year, Program, Category */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-sm font-semibold text-gray-700 block mb-1">Year</label>
                            <input
                                type="number"
                                name="year"
                                value={form.year}
                                onChange={handleChange}
                                min="2000"
                                max="2099"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-gray-700 block mb-1">Program</label>
                            <select
                                name="program"
                                value={form.program}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                            >
                                <option value="">Select Program</option>
                                <option value="BSIT">BSIT</option>
                                <option value="BSCpE">BSCpE</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-gray-700 block mb-1">Category</label>
                            <CategoryCombobox
                                value={form.category}
                                onChange={(v) => setForm(prev => ({ ...prev, category: v }))}
                                className="w-full px-4 py-2 pr-8 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                            />
                        </div>
                    </div>

                    {/* Abstract */}
                    <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-1">Abstract</label>
                        <textarea
                            name="abstract"
                            value={form.abstract}
                            onChange={handleChange}
                            rows="3"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        />
                    </div>

                    {/* Keywords */}
                    <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-1">Keywords</label>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="text"
                                value={newKeyword}
                                onChange={(e) => setNewKeyword(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddKeyword()}
                                placeholder="Add keyword and press Enter"
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                            />
                            <button
                                onClick={handleAddKeyword}
                                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                            >
                                Add
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {form.keywords.map((keyword) => (
                                <div
                                    key={keyword}
                                    className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full flex items-center gap-2"
                                >
                                    {keyword}
                                    <button
                                        onClick={() => handleRemoveKeyword(keyword)}
                                        className="text-green-700 hover:text-green-900"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="sticky bottom-0 flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
