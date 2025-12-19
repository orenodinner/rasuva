import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'ホーム' },
  { to: '/import', label: 'インポート' },
  { to: '/preview', label: 'プレビュー' },
  { to: '/diff', label: '差分サマリー' },
  { to: '/gantt', label: 'ガント' },
  { to: '/members', label: '担当者' },
  { to: '/groups', label: 'グループ' },
  { to: '/unscheduled', label: '未確定' },
  { to: '/invalid', label: '不正日付' },
  { to: '/imports', label: '履歴' },
  { to: '/views', label: '保存ビュー' },
  { to: '/export', label: 'エクスポート' },
  { to: '/settings', label: '設定' }
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
      <div className="side-nav__footer">オフライン · ローカル専用</div>
    </aside>
  );
};

export default SideNav;
