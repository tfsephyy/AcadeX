import { HiOutlineViewGrid, HiOutlineUsers, HiOutlineBookOpen, HiOutlineLibrary, HiOutlineClipboardList, HiOutlineClipboardCheck } from 'react-icons/hi';
import WorkspaceLayout from '../WorkspaceLayout';

const navItems = [
    { to: '/admin/dashboard',      label: 'Dashboard',          icon: HiOutlineViewGrid },
    { to: '/admin/users',          label: 'User Management',    icon: HiOutlineUsers },
    { to: '/admin/capstone-library',label: 'My Uploads',  icon: HiOutlineLibrary },
    { to: '/admin/published',      label: 'Capstone Library', icon: HiOutlineBookOpen },
    { to: '/admin/approvals',      label: 'Pending Approvals',  icon: HiOutlineClipboardCheck },
    { to: '/admin/activity-logs',  label: 'Logs',               icon: HiOutlineClipboardList },
];

export default function AdminLayout({ children }) {
    return <WorkspaceLayout role="admin" navItems={navItems}>{children}</WorkspaceLayout>;
}
