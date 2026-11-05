import { useEffect, useState } from 'react';
import { HiOutlineUserGroup } from 'react-icons/hi';
import { getAdvisers, setAdviserAvailability } from '../../api/admin';
import Loading from '../../components/Loading';
import Pagination from '../../components/Pagination';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useNotification } from '../../components/useNotification';
import { getApiErrorMessage } from '../../api/errors';

const PAGE_SIZE = 15;

export default function AdminAdvisers() {
    const notify = useNotification();
    const [items, setItems] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [pendingChange, setPendingChange] = useState(null);
    const [saving, setSaving] = useState(false);

    const load = async (targetPage = page) => {
        try {
            const res = await getAdvisers({ page: targetPage, per_page: PAGE_SIZE, include_archived: 1 });
            const data = res.data.data;
            setItems(Array.isArray(data) ? data : (data?.data || []));
            setPagination(Array.isArray(data) ? null : data);
        } catch (error) {
            notify.error(getApiErrorMessage(error, 'The adviser pool could not be loaded.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(page); }, [page]);

    const confirmChange = async () => {
        if (!pendingChange) return;
        setSaving(true);
        try {
            const res = await setAdviserAvailability(pendingChange.id, pendingChange.nextValue);
            const updated = res.data.data || {};
            setItems(prev => prev.map(item => item.id === updated.id ? { ...item, adviser_available: updated.adviser_available } : item));
            notify.success(res.data.message || 'Adviser availability updated.');
            setPendingChange(null);
        } catch (error) {
            notify.error(getApiErrorMessage(error, 'Adviser availability could not be updated.'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Loading text="Loading the adviser pool..." />;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Adviser Pool</h1>
                <p className="text-sm text-gray-500 mt-1">Manage which approved faculty members can be selected as advisers during submission.</p>
            </div>

            {!items.length ? (
                <EmptyState
                    icon={<HiOutlineUserGroup className="w-6 h-6" />}
                    title="No faculty accounts"
                    description="Approved faculty accounts will appear here when available."
                />
            ) : (
                <>
                    <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden" aria-label="Faculty adviser accounts">
                        <div className="table-scroll overflow-x-auto" role="region" aria-label="Scrollable adviser table" tabIndex={0}>
                            <table className="w-full text-sm min-w-[720px]">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50/70">
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Faculty</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Program</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Account</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Assigned</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Adviser availability</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {items.map(item => (
                                        <tr key={item.id} className="hover:bg-green-50/40">
                                            <td className="py-3 px-4">
                                                <p className="font-medium text-gray-800">{item.name}</p>
                                                <p className="text-xs text-gray-400 truncate">{item.email}</p>
                                            </td>
                                            <td className="py-3 px-4 text-gray-500">{item.faculty_program || '—'}</td>
                                            <td className="py-3 px-4 text-gray-500">
                                                {item.is_archived
                                                    ? 'Archived'
                                                    : item.is_approved ? 'Approved' : 'Pending approval'}
                                            </td>
                                            <td className="py-3 px-4 text-gray-500">{item.assigned_capstones_count ?? 0}</td>
                                            <td className="py-3 px-4">
                                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-gray-300 text-green-700 focus:ring-green-600"
                                                        checked={Boolean(item.adviser_available)}
                                                        disabled={saving || item.is_archived || !item.is_approved}
                                                        onChange={event => setPendingChange({ id: item.id, name: item.name, nextValue: event.target.checked })}
                                                        aria-label={`${item.adviser_available ? 'Disable' : 'Enable'} adviser availability for ${item.name}`}
                                                    />
                                                    <span className={`text-xs font-semibold ${item.adviser_available ? 'text-green-700' : 'text-gray-500'}`}>
                                                        {item.adviser_available ? 'Available' : 'Unavailable'}
                                                    </span>
                                                </label>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                    <Pagination paginationData={pagination} page={page} onPageChange={setPage} perPage={PAGE_SIZE} />
                </>
            )}

            <ConfirmDialog
                open={Boolean(pendingChange)}
                title={pendingChange?.nextValue ? 'Enable adviser?' : 'Disable adviser?'}
                message={pendingChange
                    ? `${pendingChange.name} will ${pendingChange.nextValue ? 'be offered' : 'stop being offered'} in adviser pickers. Existing assignments remain unchanged.`
                    : ''}
                confirmText={pendingChange?.nextValue ? 'Enable' : 'Disable'}
                cancelText="Cancel"
                variant={pendingChange?.nextValue ? 'success' : 'warning'}
                onConfirm={confirmChange}
                onCancel={() => { if (!saving) setPendingChange(null); }}
            />
        </div>
    );
}
