import { NavLink, useNavigate } from 'react-router-dom';
import { useAppStore } from '../state/store';

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
  const navigate = useNavigate();
  const schedules = useAppStore((state) => state.schedules);
  const currentScheduleId = useAppStore((state) => state.currentScheduleId);
  const switchSchedule = useAppStore((state) => state.switchSchedule);
  return (
    <aside className="side-nav">
      <div className="side-nav__brand">
        <div className="brand-mark">R</div>
        <div>
          <div className="brand-title">Rasuva</div>
          <div className="brand-subtitle">Gantt Ops</div>
        </div>
      </div>
      <div className="schedule-switcher">
        <div className="schedule-switcher__label">スケジュール</div>
        <select
          className="schedule-switcher__select"
          value={currentScheduleId ?? ''}
          onChange={(event) => {
            const nextId = Number(event.target.value);
            if (nextId) {
              switchSchedule(nextId);
            }
          }}
        >
          {schedules.length === 0 ? (
            <option value="">未選択</option>
          ) : (
            schedules.map((schedule) => (
              <option key={schedule.id} value={schedule.id}>
                {schedule.name}
              </option>
            ))
          )}
        </select>
        <button
          className="schedule-switcher__manage"
          type="button"
          onClick={() => navigate('/schedules')}
        >
          管理
        </button>
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
