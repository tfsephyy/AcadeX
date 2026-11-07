import { HiOutlineLibrary, HiOutlineBookOpen, HiOutlineClipboardCheck, HiOutlineViewGrid } from 'react-icons/hi';
import WorkspaceLayout from '../WorkspaceLayout';

const navItems = [
    { to: '/faculty/dashboard',        label: 'Dashboard',           icon: HiOutlineViewGrid },
    { to: '/faculty/assigned',         label: 'Assigned Capstones',  icon: HiOutlineClipboardCheck },
    { to: '/faculty/capstone-library', label: 'My Uploads',    icon: HiOutlineLibrary },
    { to: '/faculty/uploads',          label: 'Capstone Library',  icon: HiOutlineBookOpen },
    { to: '/faculty/approvals',        label: 'Pending Approvals',   icon: HiOutlineClipboardCheck },
];

export default function FacultyLayout({ children }) {
    return <WorkspaceLayout role="faculty" navItems={navItems}>{children}</WorkspaceLayout>;
}
