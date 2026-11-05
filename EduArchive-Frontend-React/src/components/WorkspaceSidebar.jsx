import { NavLink } from 'react-router-dom'
import { HiOutlineX, HiChevronLeft, HiChevronRight } from 'react-icons/hi'
import Brand from './Brand'
import { useDialogFocus } from './useDialogFocus'

/** One responsive navigation shell; role-specific routes and account actions stay with their layouts. */
export default function WorkspaceSidebar({ role, items, open, collapsed, onOpenChange, onCollapsedChange, children }) {
  const drawerRef = useDialogFocus(open, () => onOpenChange(false), { mobile: true })
  return <>
    {open && <div className="sidebar-backdrop" aria-hidden="true" onClick={() => onOpenChange(false)} />}
    <aside id="workspace-navigation" ref={drawerRef} aria-label={`${role} navigation`} tabIndex={-1}
      className={`panel-sidebar workspace-sidebar${open ? ' is-open' : ''}${collapsed ? ' is-collapsed' : ''}`}>
      <div className="sidebar-brand-row panel-logo-border">
        <div className="sidebar-brand-stack"><Brand variant="sidebar" className="sidebar-brand-logo" /><span className="sidebar-role">{role}</span></div>
        <button type="button" aria-label="Close navigation" className="sidebar-close panel-profile-btn" onClick={() => onOpenChange(false)}><HiOutlineX aria-hidden="true" /></button>
      </div>
      <nav aria-label={`${role} pages`} className="sidebar-links panel-scroll">
        {items.map(item => <NavLink key={item.to} to={item.to} aria-label={item.label} title={item.label}
          onClick={() => onOpenChange(false)}
          className={({ isActive }) => `sidebar-link ${isActive ? 'panel-nav-active' : 'panel-nav-item'}`}>
          <item.icon aria-hidden="true" className="sidebar-nav-icon" />
          <span className="sidebar-nav-label">{item.label}</span>
        </NavLink>)}
      </nav>
      {children}
    </aside>
    <button type="button" className={`sidebar-toggle panel-arrow-tab${collapsed ? ' is-collapsed' : ''}`}
      onClick={() => onCollapsedChange(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      aria-expanded={!collapsed} aria-controls="workspace-navigation" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
      {collapsed ? <HiChevronRight aria-hidden="true" /> : <HiChevronLeft aria-hidden="true" />}
    </button>
  </>
}
