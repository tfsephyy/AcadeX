import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    HiOutlineSearch,
    HiOutlineFilter,
    HiOutlineCheck,
    HiOutlineX,
    HiOutlineEye,
    HiOutlineDocument,
    HiOutlineUser,
    HiOutlineCalendar,
    HiOutlineAcademicCap,
} from 'react-icons/hi';
import { useNotification } from '../../components/Notification';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import CapstoneModal from '../../components/admin/CapstoneModal';
import Pagination from '../../components/Pagination';
import { getFacultyPendingCapstones, approveFacultyCapstone, rejectFacultyCapstone } from '../../api/faculty';

export default function FacultyCapstoneApproval() {
    const navigate = useNavigate();
    const notify = useNotification();

    // State
    const [capstones, setCapstones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCapstone, setSelectedCapstone] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);

    // Search & filters
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filters, setFilters] = useState({ year: '', program: '' });
    const [showFilters, setShowFilters] = useState(false);
    const searchTimer = useRef(null);

    // Pagination
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 });

    // Filter options
    const [years, setYears] = useState([]);
    const [programs, setPrograms] = useState(['BSIT', 'BSCpE']);

    // Confirm dialog
    const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null, variant: 'success' });

    // Debounce search
    useEffect(() => {
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 350);
        return () => clearTimeout(searchTimer.current);
    }, [search]);

    // Fetch capstones
    useEffect(() => {
        fetchPendingCapstones();
    }, [page, debouncedSearch, filters]);

    const fetchPendingCapstones = useCallback(async () => {
        try {
            setLoading(true);
            const params = { page, per_page: 15 };
            if (debouncedSearch) params.search = debouncedSearch;
            if (filters.year) params.year = filters.year;
            if (filters.program) params.program = filters.program;

            const res = await getFacultyPendingCapstones(params);
            const data = res.data.data;

            setCapstones(data.data || []);
            setPagination({
                current_page: data.current_page || 1,
                last_page: data.last_page || 1,
                total: data.total || 0,
                from: data.from || 0,
                to: data.to || 0,
            });
        } catch (err) {
            notify.error('Failed to load pending capstones.');
        } finally {
            setLoading(false);
        }
    }, [page, debouncedSearch, filters, notify]);

    const handleApprove = (capstone) => {
        setConfirm({
            open: true,
            title: 'Approve Capstone',
            message: `Are you sure you want to approve "${capstone.title}"? It will be published and visible to everyone.`,
            variant: 'success',
            action: async () => {
                try {
                    await approveFacultyCapstone(capstone.id);
                    notify.success('Capstone approved successfully!');
                    fetchPendingCapstones();
                } catch (err) {
                    notify.error(err.response?.data?.message || 'Failed to approve capstone.');
                }
                setConfirm(prev => ({ ...prev, open: false }));
            },
        });
    };

    const handleReject = (capstone) => {
        setConfirm({
            open: true,
            title: 'Reject Capstone',
            message: `Are you sure you want to reject "${capstone.title}"? It will be moved to the archive.`,
            variant: 'danger',
            action: async () => {
                try {
                    await rejectFacultyCapstone(capstone.id);
                    notify.success('Capstone rejected and archived.');
                    fetchPendingCapstones();
                } catch (err) {
                    notify.error(err.response?.data?.message || 'Failed to reject capstone.');
                }
                setConfirm(prev => ({ ...prev, open: false }));
            },
        });
    };

    const handleView = (capstone) => {
        setSelectedCapstone(capstone);
        setShowViewModal(true);
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const clearFilters = () => {
        setFilters({ year: '', program: '' });
        setPage(1);
    };

    const hasActiveFilters = filters.year || filters.program;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
                <p className="text-sm text-gray-500 mt-1">Review and approve capstones where you are the adviser</p>
            </div>

            {/* Search & Filters */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by title, student name, or year..."
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                            showFilters || hasActiveFilters
                                ? 'bg-green-50 text-green-700 border-green-300'
                                : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        <HiOutlineFilter className="w-4 h-4" />
                        Filters
                        {hasActiveFilters && <span className="w-2 h-2 bg-green-500 rounded-full" />}
                    </button>
                </div>

                {showFilters && (
                    <div className="pt-3 border-t border-gray-100">
                        <div className="flex flex-wrap items-end gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
                                <select
                                    value={filters.year}
                                    onChange={(e) => handleFilterChange('year', e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none min-w-[120px]"
                                >
                                    <option value="">All Years</option>
                                    {years.map((y) => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Program</label>
                                <select
                                    value={filters.program}
                                    onChange={(e) => handleFilterChange('program', e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none min-w-[120px]"
                                >
                                    <option value="">All Programs</option>
                                    {programs.map((p) => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                            {hasActiveFilters && (
                                <button
                                    onClick={clearFilters}
                                    className="px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    Clear All
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Content */}
            {loading ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                    <Loading text="Loading pending capstones..." />
                </div>
            ) : capstones.length === 0 ? (
                <EmptyState
                    title="No pending approvals"
                    description={
                        debouncedSearch || hasActiveFilters
                            ? 'Try adjusting your search or filters.'
                            : 'All capstones have been reviewed. New uploads from your advisees will appear here.'
                    }
                    icon={<HiOutlineDocument className="w-12 h-12" />}
                />
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                        {capstones.map((cap) => (
                            <div
                                key={cap.id}
                                className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <HiOutlineDocument className="w-8 h-8 text-green-600" />
                                    <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
                                        Pending
                                    </span>
                                </div>

                                <h3 className="text-base font-semibold text-gray-900 line-clamp-2 mb-2">
                                    {cap.title}
                                </h3>

                                <div className="space-y-1.5 text-sm text-gray-600 mb-4">
                                    <div className="flex items-center gap-2">
                                        <HiOutlineUser className="w-4 h-4 text-gray-400" />
                                        <span>{cap.student?.name || 'Unknown'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <HiOutlineAcademicCap className="w-4 h-4 text-gray-400" />
                                        <span>{cap.student?.program || 'N/A'} - Year {cap.student?.year || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <HiOutlineCalendar className="w-4 h-4 text-gray-400" />
                                        <span>{cap.year || 'N/A'}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleView(cap)}
                                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                        <HiOutlineEye className="w-4 h-4" />
                                        View
                                    </button>
                                    <button
                                        onClick={() => handleApprove(cap)}
                                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                                    >
                                        <HiOutlineCheck className="w-4 h-4" />
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => handleReject(cap)}
                                        className="inline-flex items-center justify-center p-2 text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                                        title="Reject"
                                    >
                                        <HiOutlineX className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <Pagination 
                        paginationData={pagination}
                        page={page}
                        onPageChange={setPage}
                        perPage={15}
                    />
                </div>
            )}

            {/* View Modal */}
            {selectedCapstone && (
                <CapstoneModal
                    capstone={selectedCapstone}
                    open={showViewModal}
                    onClose={() => {
                        setShowViewModal(false);
                        setSelectedCapstone(null);
                    }}
                />
            )}

            {/* Confirm Dialog */}
            <ConfirmDialog
                open={confirm.open}
                title={confirm.title}
                message={confirm.message}
                variant={confirm.variant}
                onConfirm={confirm.action}
                onCancel={() => setConfirm(prev => ({ ...prev, open: false }))}
            />
        </div>
    );
}
