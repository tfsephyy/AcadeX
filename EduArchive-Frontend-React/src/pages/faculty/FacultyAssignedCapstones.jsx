import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFacultyAssignedCapstones } from '../../api/admin';
import Loading from '../../components/Loading';
import Pagination from '../../components/Pagination';
import EmptyState from '../../components/EmptyState';
import { HiOutlineClipboardCheck, HiOutlineUser } from 'react-icons/hi';

const PAGE_SIZE = 12;

export default function FacultyAssignedCapstones() {
    const [items, setItems] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        getFacultyAssignedCapstones({ page, per_page: PAGE_SIZE })
            .then(res => {
                if (cancelled) return;
                const data = res.data.data;
                setItems(Array.isArray(data) ? data : (data?.data || []));
                setPagination(Array.isArray(data) ? null : data);
            })
            .catch(() => { if (!cancelled) setItems([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [page]);

    const changePage = (nextPage) => {
        if (nextPage === page) return;
        setLoading(true);
        setPage(nextPage);
    };

    if (loading) return <Loading text="Loading your assigned capstones..." />;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Assigned Capstones</h1>
                <p className="text-sm text-gray-500 mt-1">Submissions where you are listed as the advising faculty member.</p>
            </div>

            {!items.length ? (
                <EmptyState
                    icon={<HiOutlineClipboardCheck className="w-6 h-6" />}
                    title="No assigned capstones"
                    description="Assigned submissions will appear here once a student selects you as adviser."
                />
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {items.map(item => (
                            <article key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <Link to={`/faculty/capstones/${item.slug || item.id}`} className="font-semibold text-gray-900 hover:text-green-700 line-clamp-2">
                                            {item.title}
                                        </Link>
                                        <p className="text-sm text-gray-500 mt-1 truncate">{item.author}</p>
                                    </div>
                                    <span className="flex-shrink-0 px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-50 border border-gray-200 text-gray-600 capitalize">
                                        {item.approval_status}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-400 mt-3 line-clamp-3">{item.abstract || 'No abstract provided.'}</p>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
                                    <span className="inline-flex items-center gap-1.5"><HiOutlineUser className="w-3.5 h-3.5" /> Uploaded by {item.uploader?.name || 'Unknown'}</span>
                                    {item.year && <span>{item.year}</span>}
                                    {item.program && <span>{item.program}</span>}
                                </div>
                            </article>
                        ))}
                    </div>
                    <Pagination paginationData={pagination} page={page} onPageChange={changePage} perPage={PAGE_SIZE} />
                </>
            )}
        </div>
    );
}
