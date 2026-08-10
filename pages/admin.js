import { useState } from 'react';

const BLUE = '#019EE5';

export default function Admin() {
  const [secret, setSecret] = useState('');
  const [payments, setPayments] = useState([]);
  const [shops, setShops] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  async function login() {
    if (!secret) {
      setError('Entrez le mot de passe administrateur.');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');

    try {
      const headers = { 'x-admin-secret': secret };

      const [paymentsRes, shopsRes] = await Promise.all([
        fetch('/api/payments?status=pending', { headers }),
        fetch('/api/admin/shops', { headers }),
      ]);

      const paymentsData = await paymentsRes.json();
      const shopsData = await shopsRes.json();

      if (!paymentsRes.ok) {
        throw new Error(paymentsData.error || 'Accès refusé');
      }

      if (!shopsRes.ok) {
        throw new Error(shopsData.error || 'Impossible de charger les boutiques');
      }

      setPayments(paymentsData || []);
      setShops(shopsData || []);
      setAuthenticated(true);
      setNotice('Connexion administrateur réussie.');
    } catch (err) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }

  async function updateShop(shopId, action) {
    setLoading(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/admin/shops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': secret,
        },
        body: JSON.stringify({ shopId, action }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Action impossible');
      }

      setShops((items) =>
        items.map((shop) => (shop.id === shopId ? data.shop : shop))
      );

      setNotice(
        action === 'activate_free'
          ? 'Boutique ouverte gratuitement, sans expiration.'
          : 'Boutique désactivée.'
      );
    } catch (err) {
      setError(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  async function reviewPayment(id, action) {
    setLoading(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch(`/api/payments/${id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': secret,
        },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Validation impossible');
      }

      setPayments((items) => items.filter((payment) => payment.id !== id));
      setNotice('Paiement traité avec succès.');
    } catch (err) {
      setError(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setSecret('');
    setPayments([]);
    setShops([]);
    setAuthenticated(false);
    setError('');
    setNotice('');
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f5f7fa',
        padding: 24,
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <section style={{ maxWidth: 1000, margin: '0 auto' }}>
        <a href="/" style={{ color: BLUE }}>
          ← Retour
        </a>

        <h1 style={{ marginTop: 28 }}>Administration Wakh Reek</h1>

        {!authenticated ? (
          <div
            style={{
              background: 'white',
              padding: 24,
              borderRadius: 16,
              boxShadow: '0 2px 12px #0001',
            }}
          >
            <p>Entrez votre mot de passe pour accéder à la gestion complète.</p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <input
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && login()}
                placeholder="Mot de passe administrateur"
                style={{
                  flex: 1,
                  minWidth: 240,
                  padding: 14,
                  border: '1px solid #ddd',
                  borderRadius: 10,
                }}
              />

              <button
                onClick={login}
                disabled={loading}
                style={{
                  background: BLUE,
                  color: 'white',
                  border: 0,
                  borderRadius: 10,
                  padding: '14px 24px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                {loading ? 'Chargement...' : 'Connexion'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'center',
                background: '#e8f8ee',
                padding: 16,
                borderRadius: 12,
                marginBottom: 20,
              }}
            >
              <b>✓ Mode administrateur actif</b>

              <button
                onClick={logout}
                style={{
                  background: '#333',
                  color: 'white',
                  border: 0,
                  borderRadius: 8,
                  padding: '10px 14px',
                  cursor: 'pointer',
                }}
              >
                Déconnexion
              </button>
            </div>

            <section
              style={{
                background: 'white',
                padding: 24,
                borderRadius: 16,
                marginBottom: 20,
                boxShadow: '0 2px 12px #0001',
              }}
            >
              <h2>Boutiques</h2>
              <p>Vous pouvez ouvrir gratuitement une boutique sans limite de temps.</p>

              {shops.length === 0 ? (
                <p>Aucune boutique trouvée.</p>
              ) : (
                shops.map((shop) => (
                  <article
                    key={shop.id}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 16,
                      marginTop: 12,
                    }}
                  >
                    <b>{shop.name}</b>
                    <p style={{ margin: '8px 0' }}>
                      {shop.city} {shop.quartier ? `— ${shop.quartier}` : ''}
                    </p>
                    <p style={{ margin: '8px 0' }}>
                      Wave: {shop.wave_number || 'Non renseigné'}
                    </p>

                    <p style={{ margin: '8px 0' }}>
                      Statut:{' '}
                      <b style={{ color: shop.subscription_active ? '#07843a' : '#c2410c' }}>
                        {shop.subscription_active
                          ? 'Ouverte gratuitement — sans expiration'
                          : 'Fermée / abonnement non actif'}
                      </b>
                    </p>

                    <button
                      disabled={loading}
                      onClick={() =>
                        updateShop(
                          shop.id,
                          shop.subscription_active ? 'deactivate' : 'activate_free'
                        )
                      }
                      style={{
                        background: shop.subscription_active ? '#b91c1c' : BLUE,
                        color: 'white',
                        border: 0,
                        borderRadius: 8,
                        padding: '10px 14px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                    >
                      {shop.subscription_active
                        ? 'Désactiver la boutique'
                        : 'Ouvrir gratuitement sans expiration'}
                    </button>
                  </article>
                ))
              )}
            </section>

            <section
              style={{
                background: 'white',
                padding: 24,
                borderRadius: 16,
                boxShadow: '0 2px 12px #0001',
              }}
            >
              <h2>Paiements en attente</h2>

              {payments.length === 0 ? (
                <p>Aucun paiement en attente.</p>
              ) : (
                payments.map((payment) => (
                  <article
                    key={payment.id}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 16,
                      marginTop: 12,
                    }}
                  >
                    <b>{payment.type}</b>
                    <p>Reçu le {new Date(payment.created_at).toLocaleString('fr-FR')}</p>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        disabled={loading}
                        onClick={() => reviewPayment(payment.id, 'approve')}
                        style={{
                          background: '#07843a',
                          color: 'white',
                          border: 0,
                          borderRadius: 8,
                          padding: '10px 14px',
                          cursor: 'pointer',
                        }}
                      >
                        Approuver
                      </button>

                      <button
                        disabled={loading}
                        onClick={() => reviewPayment(payment.id, 'reject')}
                        style={{
                          background: '#b91c1c',
                          color: 'white',
                          border: 0,
                          borderRadius: 8,
                          padding: '10px 14px',
                          cursor: 'pointer',
                        }}
                      >
                        Refuser
                      </button>
                    </div>
                  </article>
                ))
              )}
            </section>
          </>
        )}

        {notice && <p style={{ color: '#07843a', marginTop: 16 }}>{notice}</p>}
        {error && <p style={{ color: '#b91c1c', marginTop: 16 }}>{error}</p>}
      </section>
    </main>
  );
}
