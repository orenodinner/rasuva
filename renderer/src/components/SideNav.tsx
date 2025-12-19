import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/import', label: 'Import' },
  { to: '/preview', label: 'Preview' },
  { to: '/diff', label: 'Diff Summary' },
  { to: '/gantt', label: 'Gantt' },
  { to: '/members', label: 'Members' },
  { to: '/groups', label: 'Groups' },
  { to: '/unscheduled', label: 'Unscheduled' },
  { to: '/invalid', label: 'Invalid' },
  { to: '/imports', label: 'Imports' },
  { to: '/views', label: 'Views' },
  { to: '/export', label: 'Export' },
  { to: '/settings', label: 'Settings' }
];

const SideNav = () => {
  return (
    <aside className="side-nav">
      <div className="side-nav__brand">
        <div className="brand-mark">R</div>
        <div>
          <div className="brand-title">Rasuva</div>
          <div className="brand-subtitle">Gantt Ops</div>
        </div>
      </div>
      <nav className="side-nav__links">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? 'side-nav__link side-nav__link--active' : 'side-nav__link'
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="side-nav__footer">Offline ÅE Local only</div>
    </aside>
  );
};

export default SideNav;
