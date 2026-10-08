import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserSession, adminSignOut, getIdToken } from './adminAuth';
import LogoImage from '../../assets/logoj2.png';
import TenantOrders from './TenantOrders';

export default function TenantDashboard() {
  const [user, setUser] = useState(null);
  const [tenantProfile, setTenantProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Shopify Connection State
  const [shopifyConn, setShopifyConn] = useState(null);
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [shopifyDomain, setShopifyDomain] = useState('');
  const [shopifyError, setShopifyError] = useState('');
  const [shopifySuccess, setShopifySuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const navigate = useNavigate();

  // Fetch Shopify Connection for current tenant
  const fetchShopifyConnection = useCallback(async () => {
    setShopifyLoading(true);
    setShopifyError('');
    try {
      const token = await getIdToken();
      const API_BASE = "https://kiyuziyu-api-703805908757.asia-south1.run.app";
      const res = await fetch(`${API_BASE}/api/v1/tenants/me/shopify-connection`, {
        headers: { 
          'Authorization': `Bearer ${token}`
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setShopifyConn(data.data);
        } else {
          setShopifyConn(null);
        }
      } else if (res.status === 404) {
        setShopifyConn(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        setShopifyError(errData.message || 'Failed to load Shopify connection details.');
      }
    } catch (err) {
      console.error('Error fetching shopify connection:', err);
      // Silently set no connection if server error or offline
      setShopifyConn(null);
    } finally {
      setShopifyLoading(false);
    }
  }, []);

  // Handle query params on redirect back
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shopifyParam = params.get('shopify');
    const tabParam = params.get('tab');
    if (tabParam === 'shopify') {
      setActiveTab('shopify');
    }
    if (shopifyParam === 'connected') {
      setShopifySuccess('Shopify store connected successfully!');
      // clear param from url without reloading
      window.history.replaceState({}, document.title, window.location.pathname + '?tab=shopify');
    } else if (shopifyParam === 'error') {
      setShopifyError('Failed to connect Shopify store or authorization was cancelled.');
      window.history.replaceState({}, document.title, window.location.pathname + '?tab=shopify');
    }
  }, []);

  // Protected route check
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate('/admin/login', { replace: true });
        return;
      }
      setUser(currentUser);
      try {
        const session = await getUserSession(currentUser.uid);
        if (!session) {
          navigate('/admin/login', { replace: true });
          return;
        }

        // If user is an Admin, cross-redirect to /admin/dashboard
        if (session.type === 'ADMIN') {
          navigate('/admin/dashboard', { replace: true });
          return;
        }

        setTenantProfile(session.profile);
        fetchShopifyConnection();
      } catch (err) {
        console.error('Error verifying tenant session:', err);
        navigate('/admin/login', { replace: true });
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [navigate, fetchShopifyConnection]);

  const handleLogout = async () => {
    try {
      await adminSignOut();
      navigate('/admin/login', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Domain Normalization & Validation
  const validateAndNormalizeDomain = (inputDomain) => {
    if (!inputDomain || !inputDomain.trim()) {
      return { valid: false, message: 'Please enter a valid Shopify store domain.' };
    }
    let clean = inputDomain.trim().toLowerCase();
    // Strip http:// or https://
    clean = clean.replace(/^https?:\/\//, '');
    // Strip trailing slash or path components
    clean = clean.replace(/\/.*$/, '');

    const shopifyDomainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
    if (!shopifyDomainRegex.test(clean)) {
      return { valid: false, message: 'Please enter a valid Shopify store domain.' };
    }
    return { valid: true, domain: clean };
  };

  // Handle Connect Shopify submit
  const handleConnectShopify = async (e) => {
    e.preventDefault();
    setShopifyError('');
    setShopifySuccess('');

    const validation = validateAndNormalizeDomain(shopifyDomain);
    if (!validation.valid) {
      setShopifyError(validation.message);
      return;
    }

    try {
      setSubmitting(true);
      const token = await getIdToken();
      
      const API_BASE = "https://kiyuziyu-api-703805908757.asia-south1.run.app";
      const res = await fetch(`${API_BASE}/api/v1/shopify/oauth/start?shop=${validation.domain}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setShopifyError(data.message || 'Failed to start Shopify authorization.');
        setSubmitting(false);
      }
    } catch (err) {
      console.error('Error starting shopify oauth:', err);
      setShopifyError('Network error. Failed to start Shopify connection.');
      setSubmitting(false);
    }
  };

  // Handle Disconnect Shopify
  const handleConfirmDisconnect = async () => {
    setShowDisconnectConfirm(false);
    setSubmitting(true);
    setShopifyError('');
    setShopifySuccess('');

    try {
      const token = await getIdToken();
      const API_BASE = "https://kiyuziyu-api-703805908757.asia-south1.run.app";
      const res = await fetch(`${API_BASE}/api/v1/tenants/me/shopify-connection`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        },
      });

      let data = {};
      try {
        data = await res.json();
      } catch (e) {
        console.error("Non-JSON response from server");
      }
      if (!res.ok || !data.success) {
        setShopifyError(data.message || 'Failed to disconnect Shopify store.');
        return;
      }

      setShopifyConn(null);
      setShopifySuccess('Shopify store disconnected successfully.');
    } catch (err) {
      console.error('Error disconnecting shopify store:', err);
      setShopifyError('Network error. Failed to disconnect Shopify store.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={s.loadingPage}>
        <div style={s.spinWrapper}>
          <div style={s.spinner} />
          <p style={s.loadingText}>Loading Tenant Portal...</p>
        </div>
      </div>
    );
  }

  const roleLabel = tenantProfile?.role || 'TENANT_USER';
  const tenantId = tenantProfile?.tenantId || '—';
  const userEmail = tenantProfile?.email || user?.email || '—';
  const userName = tenantProfile?.name || 'Store Tenant';

  const isConnected = shopifyConn && shopifyConn.status === 'CONNECTED';
  const shopifyStatusText = shopifyConn?.status || 'NOT_CONNECTED';

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', functional: true, path: '/tenant/dashboard' },
    { id: 'shopify', label: 'Shopify Store', icon: 'shopping-bag', functional: true, path: '/tenant/dashboard?tab=shopify' },
    { id: 'products', label: 'Products', icon: 'package', functional: true, path: '/tenant/products' },
    { id: 'credentials', label: 'API Credentials', icon: 'key', functional: false },
    { id: 'orders', label: 'Orders', icon: 'shopping-cart', functional: true, path: '/tenant/dashboard?tab=orders' },
    { id: 'profile', label: 'Profile', icon: 'user', functional: false },
  ];

  // Render Shopify Store Card Component
  const renderShopifyCard = () => (
    <div style={s.detailCard}>
      <div style={s.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={s.shopifyIconBadge}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#95bf47" strokeWidth="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <div>
            <h3 style={s.cardTitle}>Shopify Store</h3>
            <p style={s.cardSubtitle}>
              {isConnected
                ? 'Your Shopify store is linked and authorized.'
                : 'Connect your Shopify store to sync products and manage your catalog.'}
            </p>
          </div>
        </div>

        {isConnected ? (
          <span style={s.connectedBadge}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Connected
          </span>
        ) : (
          <span style={s.notConnectedBadge}>Not Connected</span>
        )}
      </div>

      {shopifyError && (
        <div style={s.alertError}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{shopifyError}</span>
        </div>
      )}

      {shopifySuccess && (
        <div style={s.alertSuccess}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>{shopifySuccess}</span>
        </div>
      )}

      {shopifyLoading ? (
        <div style={{ padding: '20px 0', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
          Checking Shopify connection status...
        </div>
      ) : isConnected ? (
        /* CONNECTED STATE */
        <div style={s.connectedContainer}>
          <div style={s.detailsGrid}>
            <div style={s.detailRow}>
              <span style={s.detailLabel}>Store:</span>
              <span style={s.detailValueCode}>{shopifyConn?.shopifyStoreDomain || '—'}</span>
            </div>
            <div style={s.detailRow}>
              <span style={s.detailLabel}>Status:</span>
              <span style={s.statusPillConnected}>{shopifyStatusText}</span>
            </div>
            {shopifyConn?.updatedAt && (
              <div style={s.detailRow}>
                <span style={s.detailLabel}>Last Connected:</span>
                <span style={s.detailValue}>
                  {new Date(shopifyConn.updatedAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <div style={s.btnGroup}>
            <button
              style={s.manageBtn}
              onClick={() => {
                const domain = shopifyConn?.shopifyStoreDomain;
                if (domain) window.open(`https://${domain}/admin`, '_blank');
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span>Manage Store</span>
            </button>

            <button
              style={s.disconnectBtn}
              onClick={() => setShowDisconnectConfirm(true)}
              disabled={submitting}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span>Disconnect</span>
            </button>
          </div>
        </div>
      ) : (
        /* NOT CONNECTED STATE */
        <form onSubmit={handleConnectShopify} style={s.connectForm}>
          <div style={s.formGroup}>
            <label style={s.label}>Store URL</label>
            <div style={s.inputWrap}>
              <input
                type="text"
                placeholder="your-store.myshopify.com"
                value={shopifyDomain}
                onChange={(e) => setShopifyDomain(e.target.value)}
                style={s.input}
                disabled={submitting}
              />
            </div>
            <span style={s.hintText}>Example: example.myshopify.com or https://example.myshopify.com/</span>
          </div>



          <div style={s.formGroupRow}>
            <button type="submit" style={s.connectBtn} disabled={submitting}>
              {submitting ? (
                <>
                  <div style={s.btnSpinner} />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  <span>Connect Shopify</span>
                </>
              )}
            </button>

            <div style={s.statusTextWrapper}>
              <span style={s.statusLabel}>Status:</span>
              <span style={s.statusValueNotConnected}>Not Connected</span>
            </div>
          </div>
        </form>
      )}
    </div>
  );

  return (
    <div style={s.appLayout}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        {/* Brand */}
        <div style={s.sidebarBrand}>
          <div style={s.logoBadge}>
            <img
              src={LogoImage}
              alt="Kiyuziyu"
              style={s.logoImg}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <div>
            <h2 style={s.brandName}>KIYUZIYU</h2>
            <span style={s.roleBadge}>{roleLabel}</span>
          </div>
        </div>

        {/* Navigation */}
        <nav style={s.nav}>
          {sidebarItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (!item.functional) return;
                  if (item.path) {
                    if (item.path.includes('?tab=')) {
                      setActiveTab(item.id);
                    } else if (item.path === '/tenant/dashboard') {
                      setActiveTab('dashboard');
                    } else {
                      navigate(item.path);
                    }
                  } else {
                    setActiveTab(item.id);
                  }
                }}
                style={{
                  ...s.navItem,
                  ...(isActive ? s.navItemActive : {}),
                  opacity: item.functional ? 1 : 0.65,
                  cursor: item.functional ? 'pointer' : 'default',
                }}
              >
                <div style={s.navItemLeft}>
                  {renderIcon(item.icon, isActive)}
                  <span>{item.label}</span>
                </div>
                {!item.functional && <span style={s.soonBadge}>Soon</span>}
              </button>
            );
          })}
        </nav>

        {/* User Footer */}
        <div style={s.userFooter}>
          <div style={s.userInfo}>
            <div style={s.userAvatar}>
              {(userName.charAt(0) || 'T').toUpperCase()}
            </div>
            <div style={s.userTextGroup}>
              <div style={s.userNameText}>{userName}</div>
              <div style={s.userEmailText}>{userEmail}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={s.logoutBtn} title="Sign Out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={s.mainContent}>
        <div style={s.container}>
          {/* Header */}
          <header style={s.header}>
            <div>
              <h1 style={s.pageTitle}>
                {activeTab === 'shopify' ? 'Shopify Integration' : 'Tenant Dashboard'}
              </h1>
              <p style={s.pageSubtitle}>
                Welcome back, <strong>{userName}</strong>. Manage your store tenant settings and API configurations.
              </p>
            </div>
            <div style={s.headerBadge}>
              <span style={s.statusDot} />
              <span>Tenant Active</span>
            </div>
          </header>

          {/* DASHBOARD TAB VIEW */}
          {activeTab === 'dashboard' && (
            <>
              {/* Top Overview Cards */}
              <div style={s.gridStats}>
                {/* Card 1: Tenant Information */}
                <div style={s.statCard}>
                  <div style={s.statHeader}>
                    <span style={s.statTitle}>TENANT IDENTITY</span>
                    <div style={s.statIconWrap}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b89620" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                  </div>
                  <div style={s.tenantIdValue}>{tenantId}</div>
                  <div style={s.statSub}>Assigned Tenant Identifier</div>
                </div>

                {/* Card 2: User Role */}
                <div style={s.statCard}>
                  <div style={s.statHeader}>
                    <span style={s.statTitle}>USER ROLE</span>
                    <div style={s.statIconWrap}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b89620" strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </div>
                  </div>
                  <div style={s.statValue}>{roleLabel}</div>
                  <div style={s.statSub}>Authorized Access Level</div>
                </div>

                {/* Card 3: Account Status */}
                <div style={s.statCard}>
                  <div style={s.statHeader}>
                    <span style={s.statTitle}>ACCOUNT STATUS</span>
                    <div style={s.statIconWrap}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    </div>
                  </div>
                  <div style={{ ...s.statValue, color: '#059669' }}>
                    {tenantProfile?.status || 'ACTIVE'}
                  </div>
                  <div style={s.statSub}>Firebase Verified Account</div>
                </div>
              </div>

              {/* Shopify Store Connection Card */}
              {renderShopifyCard()}

              {/* Profile & Security Details Card */}
              <div style={s.detailCard}>
                <div style={s.cardHeader}>
                  <h3 style={s.cardTitle}>Tenant Profile Details</h3>
                  <span style={s.cardTag}>Scope: Single Tenant</span>
                </div>

                <div style={s.detailsGrid}>
                  <div style={s.detailRow}>
                    <span style={s.detailLabel}>Tenant ID:</span>
                    <span style={s.detailValueCode}>{tenantId}</span>
                  </div>
                  <div style={s.detailRow}>
                    <span style={s.detailLabel}>User UID:</span>
                    <span style={s.detailValueCode}>{user?.uid || '—'}</span>
                  </div>
                  <div style={s.detailRow}>
                    <span style={s.detailLabel}>Email Address:</span>
                    <span style={s.detailValue}>{userEmail}</span>
                  </div>
                  <div style={s.detailRow}>
                    <span style={s.detailLabel}>Account Role:</span>
                    <span style={s.rolePill}>{roleLabel}</span>
                  </div>
                  <div style={s.detailRow}>
                    <span style={s.detailLabel}>Tenant Status:</span>
                    <span style={s.statusPill}>{tenantProfile?.status || 'ACTIVE'}</span>
                  </div>
                </div>
              </div>

              {/* Modules Grid (Coming Soon) */}
              <div style={s.modulesSection}>
                <h3 style={s.sectionTitle}>Tenant Platform Modules</h3>
                <div style={s.modulesGrid}>
                  <div style={s.moduleBox}>
                    <div style={s.moduleIcon}>📦</div>
                    <h4 style={s.moduleTitle}>Product Catalog</h4>
                    <p style={s.moduleDesc}>Manage store products, pricing overrides, and collection mapping.</p>
                    <span style={s.moduleBadge}>Coming Soon</span>
                  </div>

                  <div style={s.moduleBox}>
                    <div style={s.moduleIcon}>🔑</div>
                    <h4 style={s.moduleTitle}>API Credentials</h4>
                    <p style={s.moduleDesc}>Generate and manage API keys for external integration access.</p>
                    <span style={s.moduleBadge}>Coming Soon</span>
                  </div>

                  <div style={{ ...s.moduleBox, cursor: 'pointer', border: '1px solid #fde68a', backgroundColor: '#fffbeb' }} onClick={() => setActiveTab('shopify')}>
                    <div style={s.moduleIcon}>🛍️</div>
                    <h4 style={s.moduleTitle}>Shopify Store</h4>
                    <p style={s.moduleDesc}>Connect and sync products directly with your Shopify store.</p>
                    <span style={{ ...s.moduleBadge, backgroundColor: '#fef3c7', color: '#b89620' }}>Active Module</span>
                  </div>

                  <div style={s.moduleBox}>
                    <div style={s.moduleIcon}>🛒</div>
                    <h4 style={s.moduleTitle}>Order Management</h4>
                    <p style={s.moduleDesc}>Track customer orders, idempotency keys, and fulfillment status.</p>
                    <span style={s.moduleBadge}>Coming Soon</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* SHOPIFY TAB VIEW */}
          {activeTab === 'shopify' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {renderShopifyCard()}
            </div>
          )}

          {/* ORDERS TAB VIEW */}
          {activeTab === 'orders' && (
            <div style={{ padding: '20px 0' }}>
              <TenantOrders tenantId={user?.uid} isAdmin={false} />
            </div>
          )}
        </div>
      </main>

      {/* DISCONNECT CONFIRMATION MODAL */}
      {showDisconnectConfirm && (
        <div style={s.modalOverlay}>
          <div style={s.modalCard}>
            <div style={s.modalHeader}>
              <div style={s.modalIconWrap}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h3 style={s.modalTitle}>Disconnect Shopify Store</h3>
                <p style={s.modalSubtitle}>Confirm action for current tenant</p>
              </div>
            </div>

            <p style={s.modalMessage}>
              Are you sure you want to disconnect this Shopify store?
            </p>

            <div style={s.modalActions}>
              <button
                style={s.modalCancelBtn}
                onClick={() => setShowDisconnectConfirm(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                style={s.modalConfirmBtn}
                onClick={handleConfirmDisconnect}
                disabled={submitting}
              >
                {submitting ? 'Disconnecting...' : 'Disconnect Store'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function renderIcon(iconType, isActive) {
  const color = isActive ? '#b89620' : '#64748b';
  switch (iconType) {
    case 'grid':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      );
    case 'package':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    case 'key':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.778-7.778zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </svg>
      );
    case 'shopping-bag':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      );
    case 'shopping-cart':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      );
    case 'user':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    default:
      return null;
  }
}

const s = {
  loadingPage: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    fontFamily: "'Inter', sans-serif",
  },
  spinWrapper: {
    textAlign: 'center',
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '3px solid #e2e8f0',
    borderTop: '3px solid #d4af37',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto 16px',
  },
  loadingText: {
    color: '#64748b',
    fontSize: '14px',
    fontWeight: '500',
  },
  appLayout: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#0f172a',
  },
  sidebar: {
    width: '260px',
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 16px',
    boxSizing: 'border-box',
    flexShrink: 0,
  },
  sidebarBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingBottom: '24px',
    borderBottom: '1px solid #f1f5f9',
    marginBottom: '20px',
  },
  logoBadge: {
    width: '42px',
    height: '42px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    border: '1px solid #fde68a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImg: {
    width: '28px',
    height: '28px',
    objectFit: 'contain',
  },
  brandName: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '700',
    letterSpacing: '0.1em',
    color: '#0f172a',
  },
  roleBadge: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#b89620',
    letterSpacing: '0.08em',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: 1,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#475569',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'all 0.15s ease',
    width: '100%',
    textAlign: 'left',
  },
  navItemActive: {
    backgroundColor: '#fffbeb',
    color: '#b89620',
    fontWeight: '600',
    border: '1px solid #fde68a',
  },
  navItemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  soonBadge: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#94a3b8',
    backgroundColor: '#f1f5f9',
    padding: '2px 6px',
    borderRadius: '6px',
  },
  userFooter: {
    paddingTop: '16px',
    borderTop: '1px solid #f1f5f9',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  userAvatar: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    backgroundColor: '#fef3c7',
    border: '1px solid #fde68a',
    color: '#b89620',
    fontWeight: '700',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userTextGroup: {
    overflow: 'hidden',
  },
  userNameText: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#0f172a',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userEmailText: {
    fontSize: '11px',
    color: '#64748b',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '8px',
    borderRadius: '8px',
    border: '1px solid #fee2e2',
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  mainContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '36px',
    boxSizing: 'border-box',
  },
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '28px',
  },
  pageTitle: {
    margin: '0 0 6px',
    fontSize: '26px',
    fontWeight: '700',
    color: '#0f172a',
  },
  pageSubtitle: {
    margin: 0,
    fontSize: '14px',
    color: '#64748b',
  },
  headerBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#ecfdf5',
    border: '1px solid #a7f3d0',
    color: '#047857',
    fontSize: '12px',
    fontWeight: '600',
    padding: '6px 14px',
    borderRadius: '20px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
  },
  gridStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
    marginBottom: '32px',
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    padding: '24px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)',
  },
  statHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '14px',
  },
  statTitle: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: '0.06em',
  },
  statIconWrap: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tenantIdValue: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#0f172a',
    fontFamily: 'monospace',
    marginBottom: '4px',
  },
  statValue: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '4px',
  },
  statSub: {
    fontSize: '12px',
    color: '#64748b',
  },
  detailCard: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    padding: '28px',
    marginBottom: '32px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid #f1f5f9',
  },
  cardTitle: {
    margin: '0 0 4px',
    fontSize: '17px',
    fontWeight: '700',
    color: '#0f172a',
  },
  cardSubtitle: {
    margin: 0,
    fontSize: '13px',
    color: '#64748b',
  },
  shopifyIconBadge: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    backgroundColor: '#f6f9f0',
    border: '1px solid #d9e8b8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  connectedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: '700',
    color: '#059669',
    backgroundColor: '#d1fae5',
    border: '1px solid #a7f3d0',
    padding: '5px 12px',
    borderRadius: '20px',
  },
  notConnectedBadge: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    border: '1px solid #e2e8f0',
    padding: '5px 12px',
    borderRadius: '20px',
  },
  alertError: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    fontSize: '13px',
    fontWeight: '500',
    padding: '12px 16px',
    borderRadius: '10px',
    marginBottom: '20px',
  },
  alertSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#ecfdf5',
    border: '1px solid #a7f3d0',
    color: '#047857',
    fontSize: '13px',
    fontWeight: '500',
    padding: '12px 16px',
    borderRadius: '10px',
    marginBottom: '20px',
  },
  connectForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#334155',
  },
  inputWrap: {
    width: '100%',
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    fontSize: '14px',
    color: '#0f172a',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: "'Inter', sans-serif",
    transition: 'border-color 0.15s',
  },
  hintText: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  formGroupRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '8px',
  },
  connectBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '11px 22px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#b89620',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.15s, transform 0.1s',
  },
  btnSpinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.4)',
    borderTop: '2px solid #ffffff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  statusTextWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusLabel: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#64748b',
  },
  statusValueNotConnected: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    padding: '3px 10px',
    borderRadius: '6px',
  },
  connectedContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  statusPillConnected: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#059669',
    backgroundColor: '#d1fae5',
    padding: '3px 10px',
    borderRadius: '12px',
    letterSpacing: '0.04em',
  },
  btnGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #f1f5f9',
  },
  manageBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 18px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  disconnectBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 18px',
    borderRadius: '10px',
    border: '1px solid #fee2e2',
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalCard: {
    width: '100%',
    maxWidth: '440px',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    padding: '24px',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  modalIconWrap: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fee2e2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  modalTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '700',
    color: '#0f172a',
  },
  modalSubtitle: {
    margin: 0,
    fontSize: '12px',
    color: '#64748b',
  },
  modalMessage: {
    fontSize: '14px',
    color: '#334155',
    lineHeight: '1.5',
    marginBottom: '24px',
  },
  modalActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  modalCancelBtn: {
    padding: '9px 16px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#475569',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  modalConfirmBtn: {
    padding: '9px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#dc2626',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  cardTag: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#b89620',
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
    padding: '4px 10px',
    borderRadius: '6px',
  },
  detailsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px dashed #f1f5f9',
  },
  detailLabel: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#64748b',
  },
  detailValue: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#0f172a',
  },
  detailValueCode: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#0f172a',
    fontFamily: 'monospace',
    backgroundColor: '#f1f5f9',
    padding: '3px 8px',
    borderRadius: '6px',
  },
  rolePill: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#b89620',
    backgroundColor: '#fef3c7',
    padding: '3px 10px',
    borderRadius: '12px',
  },
  statusPill: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#059669',
    backgroundColor: '#d1fae5',
    padding: '3px 10px',
    borderRadius: '12px',
  },
  modulesSection: {
    marginTop: '12px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '16px',
  },
  modulesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  moduleBox: {
    backgroundColor: '#ffffff',
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '8px',
  },
  moduleIcon: {
    fontSize: '24px',
  },
  moduleTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: '600',
    color: '#0f172a',
  },
  moduleDesc: {
    margin: 0,
    fontSize: '12px',
    color: '#64748b',
    lineHeight: '1.4',
  },
  moduleBadge: {
    marginTop: '8px',
    fontSize: '10px',
    fontWeight: '600',
    color: '#94a3b8',
    backgroundColor: '#f1f5f9',
    padding: '3px 8px',
    borderRadius: '6px',
  },
};

