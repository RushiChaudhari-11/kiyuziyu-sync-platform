import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { getUserSession, adminSignOut, getIdToken, API_BASE, apiFetch } from './adminAuth';
import LogoImage from '../../assets/logoj2.png';
import TenantOrders from './TenantOrders';
import TenantAnalysisReports from './TenantAnalysisReports';

export default function TenantDashboard({ initialTab = 'dashboard' }) {
  const [user, setUser] = useState(null);
  const [tenantProfile, setTenantProfile] = useState(null);
  const tenantProfileRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab || 'dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Shopify Connection State
  const [shopifyConn, setShopifyConn] = useState(null);
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [shopifyDomain, setShopifyDomain] = useState('');
  const [shopifyError, setShopifyError] = useState('');
  const [shopifySuccess, setShopifySuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const navigate = useNavigate();

  const handleCopyText = (text, fieldName) => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (e) {
      console.error('Failed to copy to clipboard:', e);
    }
  };

  // Fetch Shopify Connection for current tenant with direct Firestore fallback
  const fetchShopifyConnection = useCallback(async (explicitTenantId) => {
    setShopifyLoading(true);
    setShopifyError('');
    const targetTenantId = explicitTenantId || tenantProfileRef.current?.tenantId;

    try {
      const token = await getIdToken();
      const res = await apiFetch(`${API_BASE}/api/v1/tenants/me/shopify-connection`, {
        headers: { 
          'Authorization': `Bearer ${token}`
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data && data.data.status === 'CONNECTED') {
          setShopifyConn(data.data);
          setShopifyLoading(false);
          return;
        } else if (data.success && !data.data) {
          setShopifyConn(null);
        }
      }
    } catch (err) {
      console.warn('Backend API connection fetch warning:', err);
    }

    // Direct Firestore check fallback
    if (targetTenantId) {
      try {
        const q = query(collection(db, 'apiShopifyConnections'), where('tenantId', '==', targetTenantId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const connData = snap.docs[0].data();
          if (connData && connData.status === 'CONNECTED') {
            setShopifyConn({
              connectionId: snap.docs[0].id,
              tenantId: connData.tenantId,
              storeId: connData.storeId,
              shopifyStoreDomain: connData.shopifyStoreDomain,
              shopifyStoreId: connData.shopifyStoreId,
              status: connData.status,
              connectedAt: connData.connectedAt,
              updatedAt: connData.updatedAt,
              hasAccessToken: !!(connData.accessToken && connData.accessToken.trim())
            });
            setShopifyLoading(false);
            return;
          }
        }
      } catch (fsErr) {
        // Ignored if client rules restrict direct read
      }
    }

    setShopifyLoading(false);
  }, []);

  // Handle query params on redirect back
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shopifyParam = params.get('shopify');
    const tabParam = params.get('tab');
    if (tabParam === 'shopify') {
      setActiveTab('shopify');
    } else if (tabParam === 'orders') {
      setActiveTab('orders');
    } else if (tabParam === 'account') {
      setActiveTab('account');
    } else if (tabParam === 'reports') {
      setActiveTab('reports');
    } else if (initialTab && initialTab !== 'dashboard') {
      setActiveTab(initialTab);
    }
    if (shopifyParam === 'connected') {
      setShopifySuccess('Shopify store successfully authorized via OAuth! Access token acquired.');
      // clear param from url without reloading
      window.history.replaceState({}, document.title, window.location.pathname + '?tab=shopify');
    } else if (shopifyParam === 'error') {
      const errMsg = params.get('message') || 'Failed to connect Shopify store or authorization was cancelled.';
      setShopifyError('Shopify OAuth Error: ' + errMsg);
      window.history.replaceState({}, document.title, window.location.pathname + '?tab=shopify');
    }
  }, []);

  // Protected route check and real-time shopify connection subscription
  useEffect(() => {
    let isMounted = true;
    let unsubConn = null;
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        if (isMounted) navigate('/admin/login', { replace: true });
        return;
      }
      if (isMounted) setUser(currentUser);
      try {
        const session = await getUserSession(currentUser.uid);
        if (!session) {
          if (isMounted) navigate('/admin/login', { replace: true });
          return;
        }

        // If user is an Admin, cross-redirect to /admin/dashboard
        if (session.type === 'ADMIN') {
          if (isMounted) navigate('/admin/dashboard', { replace: true });
          return;
        }

        tenantProfileRef.current = session.profile;
        if (isMounted) setTenantProfile(session.profile);
        const tId = session.profile?.tenantId;
        fetchShopifyConnection(tId);

        // Real-time listener on apiShopifyConnections for this tenant (if accessible)
        if (tId) {
          try {
            unsubConn = onSnapshot(query(collection(db, 'apiShopifyConnections'), where('tenantId', '==', tId)), (snap) => {
              if (!snap.empty && isMounted) {
                const connDoc = snap.docs[0];
                const connData = connDoc.data();
                if (connData && connData.status === 'CONNECTED') {
                  setShopifyConn({
                    connectionId: connDoc.id,
                    tenantId: connData.tenantId,
                    storeId: connData.storeId,
                    shopifyStoreDomain: connData.shopifyStoreDomain,
                    shopifyStoreId: connData.shopifyStoreId,
                    status: connData.status,
                    connectedAt: connData.connectedAt,
                    updatedAt: connData.updatedAt,
                    hasAccessToken: !!(connData.accessToken && connData.accessToken.trim())
                  });
                  setShopifyLoading(false);
                } else if (connData && connData.status === 'DISCONNECTED') {
                  setShopifyConn(null);
                }
              }
            }, (snapshotErr) => {
              console.warn('Real-time connection listener notice:', snapshotErr?.message || snapshotErr);
            });
          } catch (e) {
            console.warn('Could not establish onSnapshot for connections:', e);
          }
        }
      } catch (err) {
        console.error('Error verifying tenant session:', err);
        if (isMounted) navigate('/admin/login', { replace: true });
      } finally {
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsub();
      if (unsubConn) unsubConn();
    };
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await adminSignOut();
      navigate('/admin/login', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Domain Normalization & Validation (handles raw names, https, and admin.shopify.com urls)
  const validateAndNormalizeDomain = (inputDomain) => {
    if (!inputDomain || !inputDomain.trim()) {
      return { valid: false, message: 'Please enter your Shopify store URL or domain.' };
    }
    let clean = inputDomain.trim().toLowerCase();
    // Strip http:// or https://
    clean = clean.replace(/^https?:\/\//, '');
    // Strip trailing slash or path components
    clean = clean.replace(/\/.*$/, '');

    // Handle admin.shopify.com/store/xyz
    if (clean.includes('admin.shopify.com/store/')) {
      const match = clean.match(/admin\.shopify\.com\/store\/([a-zA-Z0-9-]+)/);
      if (match && match[1]) clean = match[1] + '.myshopify.com';
    }

    // Auto append .myshopify.com if single word entered
    if (!clean.includes('.')) {
      clean = clean + '.myshopify.com';
    }

    const shopifyDomainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
    if (!shopifyDomainRegex.test(clean)) {
      return { valid: false, message: 'Please enter a valid Shopify store domain (e.g. your-store.myshopify.com).' };
    }
    return { valid: true, domain: clean };
  };

  // Start Shopify OAuth Flow
  const handleStartOAuth = async (explicitDomain) => {
    const rawDomain = explicitDomain || shopifyDomain || shopifyConn?.shopifyStoreDomain;
    const validation = validateAndNormalizeDomain(rawDomain);
    if (!validation.valid) {
      setShopifyError(validation.message);
      return;
    }

    try {
      setAuthorizing(true);
      setShopifyError('');
      setShopifySuccess('');
      const token = await getIdToken();
      const origin = window.location.origin;
      const res = await apiFetch(`${API_BASE}/api/v1/shopify/oauth/start?shop=${encodeURIComponent(validation.domain)}&origin=${encodeURIComponent(origin)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.authUrl) {
        // Redirect browser to Shopify's official OAuth authorization screen
        window.location.href = data.authUrl;
      } else {
        setShopifyError(data.message || 'Failed to initiate Shopify OAuth authorization.');
        setAuthorizing(false);
      }
    } catch (err) {
      console.error('Error starting Shopify OAuth:', err);
      setShopifyError('Network error starting Shopify authorization.');
      setAuthorizing(false);
    }
  };

  // Handle Connect Shopify submit (Form trigger)
  const handleConnectShopify = async (e) => {
    e.preventDefault();
    handleStartOAuth(shopifyDomain);
  };

  // Handle Disconnect Shopify
  const handleConfirmDisconnect = async () => {
    setShowDisconnectConfirm(false);
    setSubmitting(true);
    setShopifyError('');
    setShopifySuccess('');

    try {
      const token = await getIdToken();
      const res = await apiFetch(`${API_BASE}/api/v1/tenants/me/shopify-connection`, {
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

  useEffect(() => {
    if (shopifyConn?.shopifyStoreDomain && !shopifyDomain) {
      setShopifyDomain(shopifyConn.shopifyStoreDomain);
    }
  }, [shopifyConn, shopifyDomain]);

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

  const isConnected = !!(shopifyConn && shopifyConn.status === 'CONNECTED' && shopifyConn.hasAccessToken === true);
  const shopifyStatusText = isConnected ? 'CONNECTED' : (shopifyConn?.status || 'NOT_CONNECTED');

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', functional: true, path: '/tenant/dashboard' },
    { id: 'reports', label: 'Analysis Reports', icon: 'bar-chart', functional: true, path: '/tenant/dashboard?tab=reports' },
    { id: 'orders', label: 'Orders', icon: 'shopping-cart', functional: true, path: '/tenant/dashboard?tab=orders' },
    { id: 'shopify', label: 'Shopify Store', icon: 'shopping-bag', functional: true, path: '/tenant/dashboard?tab=shopify' },
    { id: 'account', label: 'Account', icon: 'user', functional: true, path: '/tenant/dashboard?tab=account' },
    { id: 'products', label: 'Products', icon: 'package', functional: true, path: '/tenant/products' },
    { id: 'credentials', label: 'API Credentials', icon: 'key', functional: false },
  ];

  // Render Account Profile & System Details View
  const renderAccountView = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Account Profile Header Box */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #b89620 0%, #d4af37 100%)',
            color: '#fff',
            fontSize: '24px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(184, 150, 32, 0.25)'
          }}>
            {(userName.charAt(0) || 'T').toUpperCase()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
                {userName}
              </h2>
              <span style={{
                padding: '3px 10px',
                borderRadius: '12px',
                backgroundColor: '#fef3c7',
                color: '#b89620',
                border: '1px solid #fde68a',
                fontSize: '11px',
                fontWeight: '700',
                letterSpacing: '0.04em'
              }}>
                {roleLabel}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#64748b' }}>
              {userEmail}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '20px',
            backgroundColor: '#ecfdf5',
            color: '#059669',
            border: '1px solid #a7f3d0',
            fontSize: '12px',
            fontWeight: '700'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
            {tenantProfile?.status || 'ACTIVE'}
          </span>
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Information Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '20px' }}>
        {/* Card 1: Tenant Identity & Organization */}
        <div style={{ backgroundColor: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b89620" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
              Tenant Profile & Identity
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.04em' }}>Organization / Store</span>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a', marginTop: '2px' }}>{userName}</div>
            </div>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.04em' }}>Tenant Code</span>
              <div style={{ fontSize: '13.5px', color: '#0f172a', marginTop: '2px', fontFamily: 'monospace' }}>
                {tenantProfile?.code || 'N/A'}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.04em' }}>Assigned Tenant ID</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '2px' }}>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#0f172a', fontWeight: '600', wordBreak: 'break-all' }}>
                  {tenantId}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyText(tenantId, 'tenantId')}
                  style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#475569', cursor: 'pointer', flexShrink: 0 }}
                >
                  {copiedField === 'tenantId' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.04em' }}>Firebase User UID</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '2px' }}>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#475569', wordBreak: 'break-all' }}>
                  {user?.uid}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyText(user?.uid, 'uid')}
                  style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#475569', cursor: 'pointer', flexShrink: 0 }}
                >
                  {copiedField === 'uid' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Shopify Integration Details */}
        <div style={{ backgroundColor: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#95bf47" strokeWidth="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
              Shopify Store Integration
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.04em' }}>Connection Status</span>
              <div style={{ marginTop: '4px' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '700',
                  backgroundColor: isConnected ? '#ecfdf5' : '#fef2f2',
                  color: isConnected ? '#059669' : '#dc2626',
                  border: isConnected ? '1px solid #a7f3d0' : '1px solid #fecaca'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isConnected ? '#10b981' : '#dc2626' }}></span>
                  {isConnected ? 'STORE CONNECTED' : 'NOT CONNECTED'}
                </span>
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.04em' }}>Linked Shopify Domain</span>
              <div style={{ fontSize: '13.5px', color: '#0f172a', fontWeight: '600', marginTop: '2px', wordBreak: 'break-all' }}>
                {shopifyConn?.shopifyStoreDomain || shopifyConn?.shopDomain || 'No Shopify store linked'}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.04em' }}>Sync Scope / Permissions</span>
              <div style={{ fontSize: '12.5px', color: '#475569', marginTop: '2px' }}>
                {shopifyConn?.scope || (isConnected ? 'read_orders, write_orders, read_products' : 'None')}
              </div>
            </div>
            <div style={{ marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('shopify')}
                style={{
                  padding: '7px 14px',
                  fontSize: '12px',
                  fontWeight: '600',
                  borderRadius: '6px',
                  backgroundColor: '#f1f5f9',
                  color: '#1e293b',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer'
                }}
              >
                {isConnected ? 'Manage Shopify Store →' : 'Connect Shopify Store →'}
              </button>
            </div>
          </div>
        </div>

        {/* Card 3: Security & Session Details */}
        <div style={{ backgroundColor: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
              Security & Session Details
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.04em' }}>Auth Provider</span>
              <div style={{ fontSize: '13px', color: '#334155', marginTop: '2px', textTransform: 'capitalize' }}>
                {user?.providerData?.[0]?.providerId || 'password'} authentication
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.04em' }}>Account Created</span>
              <div style={{ fontSize: '13px', color: '#334155', marginTop: '2px' }}>
                {user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleString() : 'N/A'}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.04em' }}>Last Sign-in</span>
              <div style={{ fontSize: '13px', color: '#334155', marginTop: '2px' }}>
                {user?.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleString() : 'N/A'}
              </div>
            </div>
            <div style={{ marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                style={{
                  padding: '7px 14px',
                  fontSize: '12px',
                  fontWeight: '600',
                  borderRadius: '6px',
                  backgroundColor: '#f1f5f9',
                  color: '#1e293b',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer'
                }}
              >
                View Store Orders →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

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
              type="button"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span>Manage Store</span>
            </button>

            <button
              style={s.manageBtn}
              onClick={() => handleStartOAuth(shopifyConn?.shopifyStoreDomain)}
              disabled={authorizing}
              type="button"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2">
                <path d="M1 4v6h6" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              <span>{authorizing ? 'Connecting...' : 'Reconnect Store'}</span>
            </button>

            <button
              style={s.disconnectBtn}
              onClick={() => setShowDisconnectConfirm(true)}
              disabled={submitting}
              type="button"
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
                disabled={submitting || authorizing}
              />
            </div>
            <span style={s.hintText}>Example: example.myshopify.com or https://example.myshopify.com/</span>
          </div>

          <div style={s.formGroupRow}>
            <button
              type="submit"
              style={s.connectBtn}
              disabled={submitting || authorizing}
            >
              {authorizing ? (
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
      {/* Floating Tab to Open Sidebar (When Collapsed) */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          style={s.tabToOpenBtn}
          title="Open Menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
          <span style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '0.03em' }}>Tab to Open Menu</span>
        </button>
      )}

      {/* Sidebar */}
      <aside style={{
        ...s.sidebar,
        width: sidebarOpen ? '260px' : '0px',
        padding: sidebarOpen ? '24px 16px' : '0px',
        borderRight: sidebarOpen ? '1px solid #e2e8f0' : 'none',
        overflowY: sidebarOpen ? 'auto' : 'hidden',
        overflowX: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        visibility: sidebarOpen ? 'visible' : 'hidden',
        boxShadow: sidebarOpen ? '2px 0 8px rgba(0,0,0,0.03)' : 'none',
      }}>
        {/* Brand */}
        <div style={s.sidebarBrand}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
          {/* Collapse Button */}
          <button
            onClick={() => setSidebarOpen(false)}
            style={s.sidebarCloseBtn}
            title="Collapse Sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
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
        <div
          onClick={() => setActiveTab('account')}
          style={{
            ...s.userFooter,
            cursor: 'pointer',
            borderRadius: '10px',
            transition: 'background-color 0.15s, border-color 0.15s',
            backgroundColor: activeTab === 'account' ? '#f8fafc' : 'transparent',
            border: activeTab === 'account' ? '1px solid #d4af37' : '1px solid transparent',
            padding: '8px',
            marginBottom: '4px'
          }}
          title="Click to view Account details"
        >
          <div style={s.userInfo}>
            <div style={s.userAvatar}>
              {(userName.charAt(0) || 'T').toUpperCase()}
            </div>
            <div style={s.userTextGroup}>
              <div style={s.userNameText}>{userName}</div>
              <div style={s.userEmailText}>{userEmail}</div>
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); handleLogout(); }} style={s.logoutBtn} title="Sign Out">
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                style={s.headerMenuToggleBtn}
                title={sidebarOpen ? "Collapse Menu" : "Open Menu"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
                <span>{sidebarOpen ? 'Hide Menu' : 'Open Menu'}</span>
              </button>
              <div>
                <h1 style={s.pageTitle}>
                  {activeTab === 'shopify' ? 'Shopify Integration' : activeTab === 'orders' ? 'Store Orders' : activeTab === 'reports' ? 'Analysis Reports' : activeTab === 'account' ? 'My Account' : 'Tenant Dashboard'}
                </h1>
                <p style={s.pageSubtitle}>
                  {activeTab === 'reports'
                    ? 'Review real-time sales reports, daily collections, admin payable balances, and activity logs.'
                    : activeTab === 'account'
                    ? 'View your store account profile, tenant identifier, Shopify connection, and credentials.'
                    : <>Welcome back, <strong>{userName}</strong>. Manage your store tenant settings and API configurations.</>}
                </p>
              </div>
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
              <TenantOrders tenantId={tenantProfile?.tenantId || user?.uid} isAdmin={false} />
            </div>
          )}

          {/* ANALYSIS REPORTS TAB VIEW */}
          {activeTab === 'reports' && (
            <div style={{ padding: '4px 0' }}>
              <TenantAnalysisReports
                tenantId={tenantProfile?.tenantId || user?.uid}
                tenantProfile={tenantProfile}
              />
            </div>
          )}

          {/* ACCOUNT TAB VIEW */}
          {activeTab === 'account' && (
            <div style={{ padding: '4px 0' }}>
              {renderAccountView()}
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
    case 'bar-chart':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="20" x2="12" y2="10" />
          <line x1="18" y1="20" x2="18" y2="4" />
          <line x1="6" y1="20" x2="6" y2="16" />
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
    height: '100vh',
    maxHeight: '100vh',
    minHeight: '100vh',
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#0f172a',
  },
  sidebar: {
    width: '260px',
    height: '100vh',
    maxHeight: '100vh',
    position: 'sticky',
    top: 0,
    left: 0,
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 16px',
    boxSizing: 'border-box',
    flexShrink: 0,
    overflowY: 'auto',
  },
  sidebarBrand: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    paddingBottom: '20px',
    borderBottom: '1px solid #f1f5f9',
    marginBottom: '20px',
  },
  sidebarCloseBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
    color: '#64748b',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  tabToOpenBtn: {
    position: 'fixed',
    top: '24px',
    left: '0px',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px 10px 12px',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    border: '1px solid #334155',
    borderLeft: 'none',
    borderRadius: '0 10px 10px 0',
    boxShadow: '0 4px 16px rgba(15, 23, 42, 0.25)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '0.04em',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  headerMenuToggleBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    color: '#334155',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    transition: 'all 0.15s ease',
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
    height: '100vh',
    maxHeight: '100vh',
    overflowY: 'auto',
    padding: '24px 28px',
    boxSizing: 'border-box',
    minWidth: 0,
    width: '100%',
  },
  container: {
    maxWidth: '100%',
    width: '100%',
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

