import { useMemo, useState } from 'react';
import type { UserRole } from '../App/App';
import { DataRow, DealAnalytics, DealStat } from '../../hooks/useFetchData';
import {
  formatCompactCurrency,
  formatCurrency,
  getAverageDealValue,
  sortSellers,
} from '../../utils/salesAnalytics';
import type { SortDirection, SortKey } from '../../utils/salesAnalytics';
import './DataTable.css';

interface DataTableProps {
  data: DataRow[];
  dealAnalytics: DealAnalytics;
  userEmail: string;
  userRole: UserRole;
  onLogout: () => void;
}

type DashboardView = 'team' | 'deals';
type AdminPriority = 'standard' | 'watch' | 'vip';

interface AdminSellerSetting {
  priority: AdminPriority;
  note: string;
}

const sortLabels: Record<SortKey, string> = {
  weightedAmount: 'Vážená hodnota',
  totalAmount: 'Pipeline',
  casesCount: 'Počet obchodů',
  averageProbability: 'Pravděpodobnost',
  averageDealValue: 'Průměr dealu',
  winCount: 'Vyhrané obchody',
};

export function DataTable({ data, dealAnalytics, userEmail, userRole, onLogout }: DataTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('weightedAmount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedSeller, setSelectedSeller] = useState<DataRow | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeView, setActiveView] = useState<DashboardView>(userRole === 'client' ? 'deals' : 'team');
  const [adminSellerId, setAdminSellerId] = useState<number | null>(data[0]?.id ?? null);
  const [adminSettings, setAdminSettings] = useState<Record<number, AdminSellerSetting>>(() => {
    try {
      return JSON.parse(localStorage.getItem('adminSellerSettings') ?? '{}') as Record<number, AdminSellerSetting>;
    } catch {
      return {};
    }
  });

  const totals = useMemo(() => {
    const totalAmount = data.reduce((sum, row) => sum + row.totalAmount, 0);
    const weightedAmount = data.reduce((sum, row) => sum + row.weightedAmount, 0);
    const activeCount = data.reduce((sum, row) => sum + row.activeCount, 0);
    const winCount = data.reduce((sum, row) => sum + row.winCount, 0);
    const lostCount = data.reduce((sum, row) => sum + row.lostCount, 0);
    const averageProbability = data.length
      ? Math.round(data.reduce((sum, row) => sum + row.averageProbability, 0) / data.length)
      : 0;

    return {
      totalAmount,
      weightedAmount,
      activeCount,
      winCount,
      lostCount,
      averageProbability,
    };
  }, [data]);

  const rankedData = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filteredData = data
      .filter((row) =>
        `${row.name} ${row.email ?? ''}`.toLowerCase().includes(normalizedQuery)
      );

    return sortSellers(filteredData, sortKey, sortDirection);
  }, [data, searchQuery, sortDirection, sortKey]);

  const podium = useMemo(
    () => [...data].sort((a, b) => b.weightedAmount - a.weightedAmount).slice(0, 3),
    [data]
  );

  const weightedRankings = useMemo(
    () => [...data].sort((a, b) => b.weightedAmount - a.weightedAmount),
    [data]
  );

  const topSeller = podium[0];
  const managedSeller = data.find((seller) => seller.id === adminSellerId) ?? data[0];
  const managedSetting = managedSeller
    ? adminSettings[managedSeller.id] ?? { priority: 'standard' as AdminPriority, note: '' }
    : { priority: 'standard' as AdminPriority, note: '' };

  const handleSort = (nextSortKey: SortKey) => {
    if (nextSortKey === sortKey) {
      setSortDirection((currentDirection) => (currentDirection === 'desc' ? 'asc' : 'desc'));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection('desc');
  };

  const resetSorting = () => {
    setSortKey('weightedAmount');
    setSortDirection('desc');
  };

  const openSellerProfile = (seller: DataRow) => {
    setSelectedSeller(seller);
    window.requestAnimationFrame(() => setIsProfileOpen(true));
  };

  const closeSellerProfile = () => {
    setIsProfileOpen(false);
    window.setTimeout(() => setSelectedSeller(null), 260);
  };

  const getSortButtonClassName = (key: SortKey) =>
    key === sortKey ? 'sortable-header sortable-header-active' : 'sortable-header';

  const getSortIcon = (key: SortKey) => {
    if (key !== sortKey) {
      return '↕';
    }

    return sortDirection === 'desc' ? '↓' : '↑';
  };

  const getSellerRank = (seller: DataRow) =>
    weightedRankings.findIndex((row) => row.id === seller.id) + 1;

  const getWinRate = (seller: DataRow) => {
    const finishedDeals = seller.winCount + seller.lostCount;
    return finishedDeals > 0 ? Math.round((seller.winCount / finishedDeals) * 100) : 0;
  };

  const getSellerScore = (seller: DataRow) => {
    const maxWeightedAmount = Math.max(...data.map((row) => row.weightedAmount), 1);
    const weightedScore = (seller.weightedAmount / maxWeightedAmount) * 50;
    const probabilityScore = seller.averageProbability * 0.2;
    const winScore = getWinRate(seller) * 0.2;
    const activityScore = seller.activeCount > 0 ? 10 : 0;

    return Math.round(weightedScore + probabilityScore + winScore + activityScore);
  };

  const getSellerLabel = (seller: DataRow) => {
    if (seller.weightedAmount === topSeller?.weightedAmount) {
      return 'Tahoun týmu';
    }

    if (seller.totalAmount > seller.weightedAmount * 1.8) {
      return 'Velký potenciál';
    }

    if (seller.averageProbability >= totals.averageProbability) {
      return 'Stabilní výkon';
    }

    return 'Potřebuje follow-up';
  };

  const getAdminPriorityLabel = (priority: AdminPriority) => {
    if (priority === 'vip') {
      return 'VIP fokus';
    }

    if (priority === 'watch') {
      return 'Sledovat';
    }

    return 'Standard';
  };

  const updateManagedSetting = (setting: AdminSellerSetting) => {
    if (!managedSeller) {
      return;
    }

    const nextSettings = {
      ...adminSettings,
      [managedSeller.id]: setting,
    };

    setAdminSettings(nextSettings);
    localStorage.setItem('adminSellerSettings', JSON.stringify(nextSettings));
  };

  const getMaxWeightedAmount = (items: DealStat[]) =>
    Math.max(...items.map((item) => item.weightedAmount), 1);

  const renderStatBars = (items: DealStat[]) => {
    const maxValue = getMaxWeightedAmount(items);

    return (
      <div className="deal-bars">
        {items.map((item) => (
          <article key={item.name}>
            <div className="deal-bar-header">
              <strong>{item.name}</strong>
              <span>{item.count} obchodů</span>
            </div>
            <div className="deal-bar-track">
              <div style={{ width: `${Math.max((item.weightedAmount / maxValue) * 100, 6)}%` }} />
            </div>
            <div className="deal-bar-footer">
              <span title={formatCurrency(item.weightedAmount)}>{formatCompactCurrency(item.weightedAmount)}</span>
              <span>{item.averageProbability} %</span>
            </div>
          </article>
        ))}
      </div>
    );
  };

  return (
    <section className="leaderboard-page">
      <div className="leaderboard-header">
        <div>
          <p className="leaderboard-kicker">Sales performance dashboard</p>
          <h1 className="leaderboard-title">Výkonnost obchodního týmu</h1>
          <p className="leaderboard-description">
            Nejen kdo má největší pipeline, ale kdo má největší reálnou šanci přinést peníze.
          </p>
        </div>

        <div className="leaderboard-actions">
          <label className="control-field">
            <span>Hledat</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Jméno nebo e-mail"
            />
          </label>

          <label className="control-field">
            <span>Řadit podle</span>
            <select
              value={sortKey}
              onChange={(event) => {
                setSortKey(event.target.value as SortKey);
                setSortDirection('desc');
              }}
            >
              {Object.entries(sortLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <button className="reset-sort-button" type="button" onClick={resetSorting}>
            Reset
          </button>

          <div className="user-chip">
            <span>{userEmail.charAt(0).toUpperCase()}</span>
            <div>
              <small>{userRole === 'admin' ? 'Admin' : 'Klient'}</small>
              <strong>{userEmail}</strong>
            </div>
          </div>

          <button className="logout-button" type="button" onClick={onLogout}>
            Odhlásit
          </button>
        </div>
      </div>

      <div className="view-switch">
        <button
          className={activeView === 'team' ? 'view-switch-button view-switch-button-active' : 'view-switch-button'}
          type="button"
          onClick={() => setActiveView('team')}
        >
          Týmový dashboard
          <span>Žebříček obchodníků a profily</span>
        </button>
        <button
          className={activeView === 'deals' ? 'view-switch-button view-switch-button-active' : 'view-switch-button'}
          type="button"
          onClick={() => setActiveView('deals')}
        >
          Obchody
          <span>Pipeline, fáze, regiony a rizika</span>
        </button>
      </div>

      {activeView === 'team' && (
        <>
      <div className="stats-grid">
        <article className="stat-card stat-card-primary">
          <span>Celkový pipeline</span>
          <strong title={formatCurrency(totals.totalAmount)}>
            {formatCompactCurrency(totals.totalAmount)}
          </strong>
          <small>Všechny obchodní příležitosti v datech</small>
        </article>

        <article className="stat-card stat-card-success">
          <span>Vážený pipeline</span>
          <strong title={formatCurrency(totals.weightedAmount)}>
            {formatCompactCurrency(totals.weightedAmount)}
          </strong>
          <small>Hodnota započítaná pravděpodobností</small>
        </article>

        <article className="stat-card">
          <span>Aktivní příležitosti</span>
          <strong>{totals.activeCount}</strong>
          <small>Otevřené obchody, které čekají na posun</small>
        </article>

        <article className="stat-card">
          <span>Konverzní síla týmu</span>
          <strong>{totals.averageProbability} %</strong>
          <small>{totals.winCount} vyhraných / {totals.lostCount} prohraných</small>
        </article>
      </div>

      {userRole === 'admin' && managedSeller && (
        <section className="admin-management-card">
          <div className="section-heading">
            <span>Admin správa</span>
            <strong>Řízení obchodníků</strong>
          </div>

          <div className="admin-management-grid">
            <label className="control-field">
              <span>Obchodník</span>
              <select
                value={managedSeller.id}
                onChange={(event) => setAdminSellerId(Number(event.target.value))}
              >
                {data.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="control-field">
              <span>Priorita</span>
              <select
                value={managedSetting.priority}
                onChange={(event) =>
                  updateManagedSetting({
                    ...managedSetting,
                    priority: event.target.value as AdminPriority,
                  })
                }
              >
                <option value="standard">Standard</option>
                <option value="watch">Sledovat</option>
                <option value="vip">VIP fokus</option>
              </select>
            </label>

            <label className="admin-note-field">
              <span>Interní poznámka</span>
              <textarea
                value={managedSetting.note}
                onChange={(event) =>
                  updateManagedSetting({
                    ...managedSetting,
                    note: event.target.value,
                  })
                }
                placeholder="Například: zkontrolovat follow-up u velkých obchodů..."
              />
            </label>

            <div className="admin-managed-preview">
              <span className={`admin-priority-badge admin-priority-${managedSetting.priority}`}>
                {getAdminPriorityLabel(managedSetting.priority)}
              </span>
              <strong>{managedSeller.name}</strong>
              <small>{formatCompactCurrency(managedSeller.weightedAmount)} vážená hodnota</small>
            </div>
          </div>
        </section>
      )}

      {podium.length > 0 && (
        <div className="dashboard-grid">
          <div className="podium-card">
            <div className="section-heading">
              <span>Top 3</span>
              <strong>Podle vážené hodnoty</strong>
            </div>

            <div className="podium-list">
              {podium.map((seller, index) => (
                <article className={`podium-item podium-item-${index + 1}`} key={seller.id}>
                  <div className="podium-rank">{index + 1}</div>
                  <div className="seller-avatar seller-avatar-large">{seller.name.charAt(0)}</div>
                  <div className="podium-content">
                    <strong>{seller.name}</strong>
                    <span>{seller.casesCount} obchodů</span>
                    <div className="podium-metrics">
                      <b title={formatCurrency(seller.weightedAmount)}>
                        {formatCompactCurrency(seller.weightedAmount)}
                      </b>
                      <small>{seller.averageProbability} % šance</small>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="insight-card">
            <div className="section-heading">
              <span>Doporučení</span>
              <strong>Co řešit jako první</strong>
            </div>

            <div className="insight-list">
              <article>
                <span className="insight-dot insight-dot-green" />
                <div>
                  <strong>Držet fokus na lídra</strong>
                  <p>{topSeller?.name ?? 'Neznámý obchodník'} drží nejvyšší váženou hodnotu.</p>
                </div>
              </article>
              <article>
                <span className="insight-dot insight-dot-blue" />
                <div>
                  <strong>Kontrolovat rozdíl pipeline vs. realita</strong>
                  <p>Vážený pipeline ukazuje realistický odhad očekávaných peněz.</p>
                </div>
              </article>
              <article>
                <span className="insight-dot insight-dot-red" />
                <div>
                  <strong>Prověřit prohrané obchody</strong>
                  <p>{totals.lostCount} prohraných obchodů může ukázat slabá místa týmu.</p>
                </div>
              </article>
            </div>
          </div>
        </div>
      )}

      {rankedData.length > 0 && (
        <div className="table-card">
          <div className="table-toolbar">
            <div>
              <span>Žebříček</span>
              <strong>{rankedData.length} obchodníků</strong>
            </div>
            <p>
              Aktuálně řazeno podle: {sortLabels[sortKey]} {sortDirection === 'desc' ? 'sestupně' : 'vzestupně'}
            </p>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Pořadí</th>
                <th>Obchodník</th>
                <th className="numeric-cell">
                  <button
                    className={getSortButtonClassName('casesCount')}
                    type="button"
                    onClick={() => handleSort('casesCount')}
                  >
                    Případy <span>{getSortIcon('casesCount')}</span>
                  </button>
                </th>
                <th className="numeric-cell">
                  <button
                    className={getSortButtonClassName('totalAmount')}
                    type="button"
                    onClick={() => handleSort('totalAmount')}
                  >
                    Pipeline <span>{getSortIcon('totalAmount')}</span>
                  </button>
                </th>
                <th className="numeric-cell">
                  <button
                    className={getSortButtonClassName('weightedAmount')}
                    type="button"
                    onClick={() => handleSort('weightedAmount')}
                  >
                    Vážená hodnota <span>{getSortIcon('weightedAmount')}</span>
                  </button>
                </th>
                <th>
                  <button
                    className={getSortButtonClassName('averageProbability')}
                    type="button"
                    onClick={() => handleSort('averageProbability')}
                  >
                    Pravděpodobnost <span>{getSortIcon('averageProbability')}</span>
                  </button>
                </th>
                <th className="numeric-cell">
                  <button
                    className={getSortButtonClassName('averageDealValue')}
                    type="button"
                    onClick={() => handleSort('averageDealValue')}
                  >
                    Průměr dealu <span>{getSortIcon('averageDealValue')}</span>
                  </button>
                </th>
                <th>Stav</th>
              </tr>
            </thead>
            <tbody>
              {rankedData.map((row, index) => (
                <tr
                  className={selectedSeller?.id === row.id ? 'table-row table-row-active' : 'table-row'}
                  key={row.id}
                  onClick={() => openSellerProfile(row)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      openSellerProfile(row);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <td>
                    <span className="rank-badge">{index + 1}</span>
                  </td>
                  <td>
                    <div className="seller-cell">
                      <span className="seller-avatar">{row.name.charAt(0)}</span>
                      <div>
                        <strong>{row.name}</strong>
                        <small>{row.email ?? 'Bez e-mailu'}</small>
                      </div>
                      {userRole === 'admin' && adminSettings[row.id]?.priority && adminSettings[row.id].priority !== 'standard' && (
                        <span className={`admin-priority-badge admin-priority-${adminSettings[row.id].priority}`}>
                          {getAdminPriorityLabel(adminSettings[row.id].priority)}
                        </span>
                      )}
                      <button
                        className="seller-detail-button"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openSellerProfile(row);
                        }}
                      >
                        Detail
                      </button>
                    </div>
                  </td>
                  <td className="numeric-cell">{row.casesCount}</td>
                  <td className="numeric-cell" title={formatCurrency(row.totalAmount)}>
                    {formatCompactCurrency(row.totalAmount)}
                  </td>
                  <td className="numeric-cell amount-cell" title={formatCurrency(row.weightedAmount)}>
                    {formatCompactCurrency(row.weightedAmount)}
                  </td>
                  <td>
                    <div className="probability-cell">
                      <span>{row.averageProbability} %</span>
                      <div className="probability-track">
                        <div style={{ width: `${row.averageProbability}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="numeric-cell" title={formatCurrency(getAverageDealValue(row))}>
                    {formatCompactCurrency(getAverageDealValue(row))}
                  </td>
                  <td>
                    <div className="status-pills">
                      <span className="status-pill-active">{row.activeCount} aktivní</span>
                      <span className="status-pill-win">{row.winCount} vyhrané</span>
                      <span className="status-pill-lost">{row.lostCount} prohrané</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedSeller && (
        <div
          className={isProfileOpen ? 'profile-overlay profile-overlay-open' : 'profile-overlay'}
          onClick={closeSellerProfile}
        >
          <aside
            className={isProfileOpen ? 'profile-drawer profile-drawer-open' : 'profile-drawer'}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Detail obchodníka ${selectedSeller.name}`}
          >
            <div className="profile-drawer-header">
              <div className="profile-identity">
                <span className="profile-avatar">{selectedSeller.name.charAt(0)}</span>
                <div>
                  <p>Profil obchodníka</p>
                  <h2>{selectedSeller.name}</h2>
                  <small>{selectedSeller.email ?? 'Bez e-mailu'}</small>
                </div>
              </div>

              <button className="profile-close-button" type="button" onClick={closeSellerProfile} aria-label="Zavřít profil">
                ×
              </button>
            </div>

            <div className="profile-highlight">
              <div>
                <span>Pořadí</span>
                <strong>#{getSellerRank(selectedSeller)}</strong>
              </div>
              <div>
                <span>Skóre</span>
                <strong>{getSellerScore(selectedSeller)}/100</strong>
              </div>
              <div>
                <span>Štítek</span>
                <strong>{getSellerLabel(selectedSeller)}</strong>
              </div>
              {userRole === 'admin' && adminSettings[selectedSeller.id] && (
                <div>
                  <span>Admin priorita</span>
                  <strong>{getAdminPriorityLabel(adminSettings[selectedSeller.id].priority)}</strong>
                </div>
              )}
            </div>

            <div className="profile-kpi-grid">
              <article>
                <span>Pipeline</span>
                <strong title={formatCurrency(selectedSeller.totalAmount)}>
                  {formatCompactCurrency(selectedSeller.totalAmount)}
                </strong>
              </article>
              <article>
                <span>Vážená hodnota</span>
                <strong title={formatCurrency(selectedSeller.weightedAmount)}>
                  {formatCompactCurrency(selectedSeller.weightedAmount)}
                </strong>
              </article>
              <article>
                <span>Průměr dealu</span>
                <strong title={formatCurrency(getAverageDealValue(selectedSeller))}>
                  {formatCompactCurrency(getAverageDealValue(selectedSeller))}
                </strong>
              </article>
              <article>
                <span>Pravděpodobnost</span>
                <strong>{selectedSeller.averageProbability} %</strong>
              </article>
            </div>

            <section className="profile-section">
              <div className="section-heading">
                <span>Stav obchodů</span>
                <strong>{selectedSeller.casesCount} případů</strong>
              </div>

              <div className="profile-status-grid">
                <div>
                  <span className="status-pill-active">{selectedSeller.activeCount}</span>
                  <p>Aktivní</p>
                </div>
                <div>
                  <span className="status-pill-win">{selectedSeller.winCount}</span>
                  <p>Vyhrané</p>
                </div>
                <div>
                  <span className="status-pill-lost">{selectedSeller.lostCount}</span>
                  <p>Prohrané</p>
                </div>
              </div>
            </section>

            <section className="profile-section">
              <div className="section-heading">
                <span>Porovnání s týmem</span>
                <strong>{getWinRate(selectedSeller)} % win rate</strong>
              </div>

              <div className="comparison-list">
                <div>
                  <span>Pravděpodobnost</span>
                  <strong>{selectedSeller.averageProbability} % vs. tým {totals.averageProbability} %</strong>
                </div>
                <div>
                  <span>Podíl na váženém pipeline</span>
                  <strong>
                    {totals.weightedAmount > 0
                      ? Math.round((selectedSeller.weightedAmount / totals.weightedAmount) * 100)
                      : 0}{' '}
                    %
                  </strong>
                </div>
              </div>
            </section>

            {userRole === 'admin' && (
              <section className="profile-section">
                <div className="section-heading">
                  <span>Interní správa</span>
                  <strong>Poznámka admina</strong>
                </div>

                <p className="profile-admin-note">
                  {adminSettings[selectedSeller.id]?.note || 'Zatím není uložená žádná poznámka.'}
                </p>
              </section>
            )}

            <section className="profile-section">
              <div className="section-heading">
                <span>Doporučené akce</span>
                <strong>Další krok</strong>
              </div>

              <div className="profile-action-list">
                <article>
                  <span className="insight-dot insight-dot-blue" />
                  <p>Zkontrolovat největší otevřené příležitosti a posunout je do další fáze.</p>
                </article>
                <article>
                  <span className="insight-dot insight-dot-green" />
                  <p>Udržet obchody s vysokou pravděpodobností a hlídat další follow-up.</p>
                </article>
                <article>
                  <span className="insight-dot insight-dot-red" />
                  <p>Projít prohrané případy a najít opakující se důvod ztráty.</p>
                </article>
              </div>
            </section>
          </aside>
        </div>
      )}
        </>
      )}

      {activeView === 'deals' && (
        <div className="deals-page">
          <div className="deals-hero">
            <div>
              <p className="leaderboard-kicker">CRM obchodní pipeline</p>
              <h2>{userRole === 'admin' ? 'Obchodní přehled pro řízení týmu' : 'Klientský přehled obchodů'}</h2>
              <span>
                Fáze, regiony, zdroje leadů a rizikové případy na jednom místě, aby bylo vidět, kde pipeline roste a kde se zasekává.
              </span>
            </div>
            <div className="crm-visual-card">
              <div className="crm-visual-header">
                <span>CRM health</span>
                <strong>{dealAnalytics.averageProbability} %</strong>
              </div>
              <div className="crm-orbit">
                <span>Lead</span>
                <span>Offer</span>
                <span>Win</span>
              </div>
            </div>
          </div>

          <div className="deal-kpi-grid">
            <article className="stat-card stat-card-primary">
              <span>Aktivní pipeline</span>
              <strong title={formatCurrency(dealAnalytics.totalPipeline)}>
                {formatCompactCurrency(dealAnalytics.totalPipeline)}
              </strong>
              <small>{dealAnalytics.activeDeals} aktivních obchodů</small>
            </article>
            <article className="stat-card stat-card-success">
              <span>Vážená hodnota</span>
              <strong title={formatCurrency(dealAnalytics.weightedPipeline)}>
                {formatCompactCurrency(dealAnalytics.weightedPipeline)}
              </strong>
              <small>Realističtější očekávání podle šance</small>
            </article>
            <article className="stat-card">
              <span>Bez další aktivity</span>
              <strong>{dealAnalytics.withoutNextActivity}</strong>
              <small>Obchody, které potřebují follow-up</small>
            </article>
            <article className="stat-card">
              <span>Rizikové obchody</span>
              <strong>{dealAnalytics.riskyDeals.length}</strong>
              <small>{dealAnalytics.overdueScheduledEnd} po termínu · {dealAnalytics.highValueLowProbability} nízká šance</small>
            </article>
          </div>

          <div className="deal-analytics-grid">
            <section className="analytics-card">
              <div className="section-heading">
                <span>Fáze</span>
                <strong>Kde se pipeline nachází</strong>
              </div>
              {renderStatBars(dealAnalytics.phaseStats)}
            </section>

            <section className="analytics-card">
              <div className="section-heading">
                <span>Regiony</span>
                <strong>Výkon podle krajů</strong>
              </div>
              {renderStatBars(dealAnalytics.regionStats)}
            </section>

            <section className="analytics-card">
              <div className="section-heading">
                <span>Zdroje leadů</span>
                <strong>Kde vzniká hodnota</strong>
              </div>
              {renderStatBars(dealAnalytics.sourceStats)}
            </section>
          </div>

          <div className="deal-lists-grid">
            <section className="analytics-card">
              <div className="section-heading">
                <span>Top obchody</span>
                <strong>Nejvyšší vážená hodnota</strong>
              </div>
              <div className="deal-card-list">
                {dealAnalytics.topDeals.map((deal) => (
                  <article className="deal-card" key={deal.id}>
                    <span className="deal-logo">{deal.companyName.charAt(0)}</span>
                    <div>
                      <strong>{deal.name}</strong>
                      <small>{deal.companyName} · {deal.ownerName}</small>
                      <p>{deal.phase} · {deal.region} · {deal.source}</p>
                    </div>
                    <b title={formatCurrency(deal.weightedAmount)}>{formatCompactCurrency(deal.weightedAmount)}</b>
                  </article>
                ))}
              </div>
            </section>

            <section className="analytics-card">
              <div className="section-heading">
                <span>Rizika</span>
                <strong>Co řešit dál</strong>
              </div>
              <div className="deal-card-list">
                {dealAnalytics.riskyDeals.map((deal) => (
                  <article className="deal-card deal-card-risk" key={deal.id}>
                    <span className="deal-logo">{deal.ownerName.charAt(0)}</span>
                    <div>
                      <strong>{deal.name}</strong>
                      <small>{deal.companyName} · {deal.probability} % šance</small>
                      <p>{deal.nextActivity ? 'Aktivita naplánovaná' : 'Bez další aktivity'} · {deal.scheduledEnd ?? 'bez termínu'}</p>
                    </div>
                    <b title={formatCurrency(deal.totalAmount)}>{formatCompactCurrency(deal.totalAmount)}</b>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </section>
  );
}
