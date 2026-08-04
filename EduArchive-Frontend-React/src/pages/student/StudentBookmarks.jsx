import { useState, useEffect } from 'react';
import { HiOutlineTrash, HiOutlineDownload } from 'react-icons/hi';
import Loading from '../../components/Loading';

export default function StudentBookmarks() {
    const [loading, setLoading] = useState(false);
    const [bookmarks, setBookmarks] = useState([]);

    useEffect(() => {
        fetchBookmarks();
    }, []);

    const fetchBookmarks = async () => {
        try {
            setLoading(true);
            // TODO: Replace with actual API call
            const mockBookmarks = [
                {
                    id: 1,
                    title: 'AI and Machine Learning in Healthcare',
                    author: 'Jane Smith',
                    year: 2024,
                    downloads: 234,
                    bookmarkedDate: '2024-03-15',
                    description: 'A comprehensive study on the applications of AI and ML in healthcare systems.',
                },
                {
                    id: 2,
                    title: 'Sustainable Energy Solutions',
                    author: 'John Doe',
                    year: 2023,
                    downloads: 567,
                    bookmarkedDate: '2024-03-10',
                    description: 'Exploring renewable energy sources and their implementation in urban areas.',
                },
            ];
            setBookmarks(mockBookmarks);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveBookmark = (id) => {
        setBookmarks(prev => prev.filter(b => b.id !== id));
    };

    if (loading) return <Loading />;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">My Bookmarks</h1>
                <p className="text-gray-600 mt-2">Your saved capstones for easy access.</p>
            </div>

            {/* Empty State */}
            {bookmarks.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                    <div className="text-gray-500 text-lg">No bookmarks yet</div>
                    <p className="text-gray-400 text-sm mt-2">Start bookmarking capstones to save them for later.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {bookmarks.map((bookmark) => (
                        <div key={bookmark.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition">
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900">{bookmark.title}</h3>
                                    <p className="text-sm text-gray-600 mt-1">By {bookmark.author}</p>
                                    <p className="text-gray-600 mt-2">{bookmark.description}</p>
                                    <div className="flex gap-4 mt-3 text-sm text-gray-500">
                                        <span>Year: {bookmark.year}</span>
                                        <span className="flex items-center gap-1">
                                            <HiOutlineDownload className="w-4 h-4" />
                                            {bookmark.downloads} downloads
                                        </span>
                                        <span>Bookmarked: {new Date(bookmark.bookmarkedDate).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button className="px-4 py-2 bg-[#1B5E20] text-white rounded-lg hover:bg-[#155a20] transition">
                                        View
                                    </button>
                                    <button
                                        onClick={() => handleRemoveBookmark(bookmark.id)}
                                        className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                                        title="Remove bookmark"
                                    >
                                        <HiOutlineTrash className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
