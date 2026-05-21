import { FormEvent, useState } from 'react';
import { useFetchData } from '../../hooks/useFetchData';
import { DataTable } from '../DataTable/DataTable';
import { Sidebar } from '../Sidebar/Sidebar';
import './App.css';

export type UserRole = 'admin' | 'client';

function App() {
  const { data, dealAnalytics } = useFetchData();
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('dashboardUser') ?? '');
  const [userRole, setUserRole] = useState<UserRole>(
    () => (localStorage.getItem('dashboardRole') as UserRole | null) ?? 'admin'
  );
  const [email, setEmail] = useState('manager@raynet.cz');
  const [password, setPassword] = useState('demo');
  const [loginError, setLoginError] = useState('');

  const isAuthenticated = userEmail.length > 0;

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setLoginError('Vyplň e-mail i heslo.');
      return;
    }

    localStorage.setItem('dashboardUser', email.trim());
    localStorage.setItem('dashboardRole', userRole);
    setUserEmail(email.trim());
    setLoginError('');
  };

  const handleLogout = () => {
    localStorage.removeItem('dashboardUser');
    localStorage.removeItem('dashboardRole');
    setUserEmail('');
    setPassword('demo');
  };

  const loginPreviewSellers = data.slice(0, 3);
  const loginPreviewDeals = dealAnalytics.topDeals.slice(0, 2);

  if (!isAuthenticated) {
    return (
      <main className="login-page">
        <section className="login-panel">
          <div className="login-copy">
            <p>Sales performance dashboard</p>
            <h1>Přihlášení do přehledu obchodního týmu</h1>
            <span>Dashboard je schovaný za jednoduchou autorizací, aby působil jako skutečná interní aplikace.</span>

            <div className="login-preview">
              <div className="login-preview-header">
                <strong>CRM live preview</strong>
                <span>{dealAnalytics.activeDeals} aktivních obchodů</span>
              </div>

              <div className="login-avatar-row">
                {loginPreviewSellers.map((seller) => (
                  <div className="login-avatar-card" key={seller.id}>
                    <span>{seller.name.charAt(0)}</span>
                    <div>
                      <strong>{seller.name}</strong>
                      <small>{seller.casesCount} obchodů</small>
                    </div>
                  </div>
                ))}
              </div>

              <div className="login-deal-stack">
                {loginPreviewDeals.map((deal) => (
                  <article key={deal.id}>
                    <span>{deal.companyName.charAt(0)}</span>
                    <div>
                      <strong>{deal.companyName}</strong>
                      <small>{deal.phase} · {deal.probability} %</small>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <form className="login-card" onSubmit={handleLogin}>
            <div>
              <span className="login-card-kicker">Secure access</span>
              <h2>Vstup do dashboardu</h2>
            </div>

            <label>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="manager@raynet.cz"
              />
            </label>

            <label>
              Heslo
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Zadej libovolné heslo"
              />
            </label>

            <div className="role-switch" aria-label="Výběr role">
              <button
                className={userRole === 'admin' ? 'role-switch-button role-switch-button-active' : 'role-switch-button'}
                type="button"
                onClick={() => setUserRole('admin')}
              >
                Admin
                <span>Kompletní CRM a tým</span>
              </button>
              <button
                className={userRole === 'client' ? 'role-switch-button role-switch-button-active' : 'role-switch-button'}
                type="button"
                onClick={() => setUserRole('client')}
              >
                Klient
                <span>Přehled obchodů a výstupů</span>
              </button>
            </div>

            {loginError && <p className="login-error">{loginError}</p>}

            <button type="submit">Přihlásit se</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-container">
        <DataTable
          data={data}
          dealAnalytics={dealAnalytics}
          userEmail={userEmail}
          userRole={userRole}
          onLogout={handleLogout}
        />
      </div>
    </div>
  );
}

export default App;
