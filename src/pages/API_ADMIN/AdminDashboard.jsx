import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { getUserSession, adminSignOut, getIdToken, API_BASE, apiFetch } from './adminAuth';
import LogoImage from '../../assets/logoj2.png';
import TenantOrders from './TenantOrders';
import AdminAnalysisReports from './AdminAnalysisReports';
import { ROLE_CONFIG } from '../../config/roles';
import {
  formatLocalDateTimeForInput,
  calculateSubscriptionEndDate,
  validateDateTimeRange,
  formatDisplayDateTime,
  toUtcIsoString
} from '../../utils/dateTimeValidation';

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Tenant state
  const [tenants, setTenants] = useState([]);
  const [totalCount, setTotalCount] = useState(null);
  const [loadingTenants, setLoadingTenants] = useState(false);

  // Create Tenant Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(Object.keys(ROLE_CONFIG)[0]);
  const [subscriptionType, setSubscriptionType] = useState('MONTHLY');
  const [subscriptionStartDate, setSubscriptionStartDate] = useState('');
  const [subscriptionEndDate, setSubscriptionEndDate] = useState('');
  const [subscriptionAmount, setSubscriptionAmount] = useState('999');
  const [dateRangeError, setDateRangeError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyNotice, setApiKeyNotice] = useState('');
  const [formNotice, setFormNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const navigate = useNavigate();

  const handleCopyText = (text, fieldName) => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  // Check URL query parameters for active tab
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'reports') {
      setActiveTab('reports');
    } else if (tabParam === 'orders') {
      setActiveTab('orders');
    } else if (tabParam === 'tenants') {
      setActiveTab('tenants');
    } else if (tabParam === 'account') {
      setActiveTab('account');
    }
  }, []);

  const fetchTenants = async () => {
    setLoadingTenants(true);
    try {
      // 1. Direct Firestore fetch to guarantee immediate display
      const usersSnap = await getDocs(collection(db, 'apiUsers'));
      const userMap = {};
      usersSnap.forEach((d) => {
        userMap[d.id] = d.data();
      });

      const tenantsSnap = await getDocs(collection(db, 'apiTenants'));
      const list = tenantsSnap.docs.map((docSnap) => {
        const data = docSnap.data();
        const owner = userMap[data.ownerUserId] || {};
        const createdDate = data.createdAt?.toDate 
          ? data.createdAt.toDate().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
          : (data.createdAt ? String(data.createdAt).substring(0, 10) : '—');
        return {
          id: docSnap.id,
          tenantId: docSnap.id,
          name: data.businessName || data.name || owner.name || 'Tenant',
          businessName: data.businessName || data.name || 'Tenant',
          fullName: data.fullName || owner.name || '—',
          code: data.code || '—',
          ownerUserId: data.ownerUserId,
          ownerEmail: owner.email || data.ownerEmail || '—',
          status: data.status || 'ACTIVE',
          subscriptionType: data.subscriptionType || 'MONTHLY',
          subscriptionStartDate: data.subscriptionStartDate?.toDate ? data.subscriptionStartDate.toDate().toISOString() : data.subscriptionStartDate,
          subscriptionEndDate: data.subscriptionEndDate?.toDate ? data.subscriptionEndDate.toDate().toISOString() : data.subscriptionEndDate,
          subscriptionAmount: data.subscriptionAmount != null ? data.subscriptionAmount : (data.amount != null ? data.amount : null),
          createdAt: createdDate
        };
      });

      if (list.length > 0) {
        setTenants(list);
        setTotalCount(list.length);
      }

      // 2. Also query backend API if token is valid
      try {
        const token = await getIdToken();
        const res = await apiFetch(`${API_BASE}/api/v1/admin/tenants`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            const apiMapped = json.data.map(item => ({
              id: item.tenantId || item.id,
              tenantId: item.tenantId || item.id,
              name: item.businessName || item.name || 'Tenant',
              businessName: item.businessName || item.name || 'Tenant',
              fullName: item.fullName || userMap[item.ownerUserId]?.name || '—',
              code: item.code || '—',
              ownerUserId: item.ownerUserId,
              ownerEmail: item.ownerEmail || userMap[item.ownerUserId]?.email || '—',
              status: item.status || 'ACTIVE',
              subscriptionType: item.subscriptionType || 'MONTHLY',
              subscriptionStartDate: item.subscriptionStartDate,
              subscriptionEndDate: item.subscriptionEndDate,
              subscriptionAmount: item.subscriptionAmount != null ? item.subscriptionAmount : item.amount,
              createdAt: item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
            }));
            setTenants(apiMapped);
            setTotalCount(json.totalCount !== undefined ? json.totalCount : apiMapped.length);
          }
        }
      } catch (apiErr) {
        console.warn('Backend API fetch optional warning:', apiErr.message);
      }
    } catch (err) {
      console.error('Error fetching tenant list:', err);
    } finally {
      setLoadingTenants(false);
    }
  };

  // Load Auth & Profile with Real-time Tenants Subscription
  useEffect(() => {
    let unsubTenants = null;
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

        // If tenant user attempts to access /admin/dashboard, redirect to /tenant/dashboard
        if (session.type === 'TENANT') {
          navigate('/tenant/dashboard', { replace: true });
          return;
        }

        setProfile(session.profile);

        if (session.profile.role === 'SUPER_ADMIN' || session.profile.role === 'ADMIN') {
          fetchTenants();

          // Real-time listener on apiTenants collection
          unsubTenants = onSnapshot(collection(db, 'apiTenants'), async (snap) => {
            try {
              const usersSnap = await getDocs(collection(db, 'apiUsers'));
              const userMap = {};
              usersSnap.forEach((d) => {
                userMap[d.id] = d.data();
              });

              const list = snap.docs.map((docSnap) => {
                const data = docSnap.data();
                const owner = userMap[data.ownerUserId] || {};
                const createdDate = data.createdAt?.toDate 
                  ? data.createdAt.toDate().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
                  : (data.createdAt ? String(data.createdAt).substring(0, 10) : '—');
                return {
                  id: docSnap.id,
                  tenantId: docSnap.id,
                  name: data.businessName || data.name || owner.name || 'Tenant',
                  businessName: data.businessName || data.name || 'Tenant',
                  fullName: data.fullName || owner.name || '—',
                  code: data.code || '—',
                  ownerUserId: data.ownerUserId,
                  ownerEmail: owner.email || data.ownerEmail || '—',
                  status: data.status || 'ACTIVE',
                  subscriptionType: data.subscriptionType || 'MONTHLY',
                  subscriptionStartDate: data.subscriptionStartDate?.toDate ? data.subscriptionStartDate.toDate().toISOString() : data.subscriptionStartDate,
                  subscriptionEndDate: data.subscriptionEndDate?.toDate ? data.subscriptionEndDate.toDate().toISOString() : data.subscriptionEndDate,
                  subscriptionAmount: data.subscriptionAmount != null ? data.subscriptionAmount : (data.amount != null ? data.amount : null),
                  createdAt: createdDate
                };
              });

              setTenants(list);
              setTotalCount(list.length);
            } catch (snapErr) {
              console.warn('Real-time tenant snapshot processing error:', snapErr);
            }
          });
        }
      } catch (err) {
        console.error('Error fetching admin profile:', err);
        navigate('/admin/login', { replace: true });
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsub();
      if (unsubTenants) unsubTenants();
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

  const openCreateTenantModal = () => {
    const nowStr = formatLocalDateTimeForInput(new Date());
    setBusinessName('');
    setFullName('');
    setEmail('');
    setPassword('');
    setRole(Object.keys(ROLE_CONFIG)[0]);
    setSubscriptionType('MONTHLY');
    setSubscriptionStartDate(nowStr);
    setSubscriptionEndDate(calculateSubscriptionEndDate(nowStr, 'MONTHLY'));
    setSubscriptionAmount('999');
    setApiKey('');
    setShowApiKey(false);
    setDateRangeError('');
    setApiKeyNotice('');
    setFormNotice('');
    setIsModalOpen(true);
  };

  const handleSubscriptionTypeChange = (e) => {
    const newType = e.target.value;
    setSubscriptionType(newType);
    const newEnd = calculateSubscriptionEndDate(subscriptionStartDate || new Date(), newType);
    setSubscriptionEndDate(newEnd);
    if (newType === 'YEARLY' && (subscriptionAmount === '999' || !subscriptionAmount)) {
      setSubscriptionAmount('9999');
    } else if (newType === 'MONTHLY' && (subscriptionAmount === '9999' || !subscriptionAmount)) {
      setSubscriptionAmount('999');
    }
    const val = validateDateTimeRange(subscriptionStartDate, newEnd);
    setDateRangeError(val.isValid ? '' : val.error);
  };

  const handleStartDateChange = (e) => {
    const val = e.target.value;
    setSubscriptionStartDate(val);
    const check = validateDateTimeRange(val, subscriptionEndDate);
    setDateRangeError(check.isValid ? '' : check.error);
  };

  const handleEndDateChange = (e) => {
    const val = e.target.value;
    setSubscriptionEndDate(val);
    const check = validateDateTimeRange(subscriptionStartDate, val);
    setDateRangeError(check.isValid ? '' : check.error);
  };

  const handleAutoCalculateEndDate = () => {
    const newEnd = calculateSubscriptionEndDate(subscriptionStartDate || new Date(), subscriptionType);
    setSubscriptionEndDate(newEnd);
    const check = validateDateTimeRange(subscriptionStartDate, newEnd);
    setDateRangeError(check.isValid ? '' : check.error);
  };

  const handleGenerateApiKey = () => {
    setApiKeyNotice('API key will be generated securely by the backend during tenant creation.');
  };

  const handleCreateTenantSubmit = async (e) => {
    e.preventDefault();
    setFormNotice('');

    // Global Date & Time Range Validation
    const dateValidation = validateDateTimeRange(subscriptionStartDate, subscriptionEndDate);
    if (!dateValidation.isValid) {
      setDateRangeError(dateValidation.error);
      setFormNotice(dateValidation.error);
      return;
    }

    if (!businessName.trim()) {
      setFormNotice('Business / Store Name is required');
      return;
    }
    if (!fullName.trim()) {
      setFormNotice('Full Name is required');
      return;
    }

    const amtNum = subscriptionAmount !== '' ? Number(subscriptionAmount) : 0;
    if (isNaN(amtNum) || amtNum < 0) {
      setFormNotice('Subscription amount must be a valid positive number');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getIdToken();
      const res = await apiFetch(`${API_BASE}/api/v1/admin/tenants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          businessName: businessName.trim(),
          fullName: fullName.trim(),
          name: businessName.trim(),
          email: email.trim(),
          password: password,
          role: role,
          subscriptionType: subscriptionType,
          subscriptionStartDate: toUtcIsoString(subscriptionStartDate),
          subscriptionEndDate: toUtcIsoString(subscriptionEndDate),
          subscriptionAmount: amtNum,
          createApiClient: true,
          apiKey: apiKey.trim() || null,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setIsModalOpen(false);
        setBusinessName('');
        setFullName('');
        setEmail('');
        setPassword('');
        setRole(Object.keys(ROLE_CONFIG)[0]);
        setApiKey('');
        setFormNotice('');
        fetchTenants();
      } else {
        setFormNotice(json.message || 'Failed to create tenant.');
      }
    } catch (err) {
      setFormNotice(err.message || 'Network error creating tenant.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={s.loadingContainer}>
        <div style={s.spinnerLarge} />
        <p style={s.loadingText}>Verifying Super Admin Authorization...</p>
      </div>
    );
  }

  // Role Access Check: Must be SUPER_ADMIN
  if (!profile || profile.role !== 'SUPER_ADMIN') {
    return (
      <div style={s.deniedPage}>
        <div style={s.deniedCard}>
          <div style={s.lockBadge}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 style={s.deniedTitle}>Access Denied</h1>
          <p style={s.deniedDesc}>
            Super Admin privileges are required to access tenant management controls.
          </p>
          <div style={s.userInfoBox}>
            <span style={s.userLabel}>Signed in as:</span>
            <span style={s.userEmail}>{user?.email || 'Unknown'}</span>
            <span style={s.roleBadge}>{profile?.role || 'NO_ROLE'}</span>
          </div>
          <button onClick={handleLogout} style={s.logoutBtnDenied}>
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.dashboardLayout}>
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

      {/* SIDEBAR */}
      <aside style={{
        ...s.sidebar,
        width: sidebarOpen ? '260px' : '0px',
        padding: sidebarOpen ? '24px 16px' : '0px',
        borderRight: sidebarOpen ? '1px solid #e2e8f0' : 'none',
        overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        visibility: sidebarOpen ? 'visible' : 'hidden',
        boxShadow: sidebarOpen ? '2px 0 8px rgba(0,0,0,0.03)' : 'none',
      }}>
        {/* Brand */}
        <div style={s.sidebarBrand}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={s.brandBadge}>
                <img
                  src={LogoImage}
                  alt="Kiyuziyu"
                  style={s.brandLogoImg}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
              <div>
                <h2 style={s.brandName}>KIYUZIYU</h2>
                <span style={s.superAdminTag}>SUPER ADMIN</span>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              style={s.sidebarCloseBtn}
              title="Collapse Menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
          </div>
        </div>

        {/* Nav Links */}
        <nav style={s.navGroup}>
          <button
            onClick={() => setActiveTab('dashboard')}
            style={{
              ...s.navItem,
              ...(activeTab === 'dashboard' ? s.navItemActive : {}),
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Dashboard
          </button>

          <button
            onClick={() => setActiveTab('tenants')}
            style={{
              ...s.navItem,
              ...(activeTab === 'tenants' ? s.navItemActive : {}),
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Tenants
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            style={{
              ...s.navItem,
              ...(activeTab === 'reports' ? s.navItemActive : {}),
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="20" x2="12" y2="10" />
              <line x1="18" y1="20" x2="18" y2="4" />
              <line x1="6" y1="20" x2="6" y2="16" />
            </svg>
            Analysis Reports
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            style={{
              ...s.navItem,
              ...(activeTab === 'orders' ? s.navItemActive : {}),
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            Orders
          </button>

          <button
            onClick={() => setActiveTab('account')}
            style={{
              ...s.navItem,
              ...(activeTab === 'account' ? s.navItemActive : {}),
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Account
          </button>

          <div style={s.navDivider} />

          {/* Disabled Modules */}
          <div style={s.navItemDisabled}>
            <span>Products</span>
            <span style={s.soonBadge}>Soon</span>
          </div>
          <div style={s.navItemDisabled}>
            <span>Shopify</span>
            <span style={s.soonBadge}>Soon</span>
          </div>
          <div style={s.navItemDisabled}>
            <span>Sync Jobs</span>
            <span style={s.soonBadge}>Soon</span>
          </div>
          <div style={s.navItemDisabled}>
            <span>Inventory</span>
            <span style={s.soonBadge}>Soon</span>
          </div>
        </nav>

        {/* Sidebar Footer / Profile */}
        <div style={s.sidebarFooter}>
          <div
            onClick={() => setActiveTab('account')}
            style={{ ...s.adminProfile, cursor: 'pointer' }}
            title="View Account Details"
          >
            <div style={s.avatarCircle}>
              {(profile?.name || user?.email || 'A')[0].toUpperCase()}
            </div>
            <div style={s.profileInfo}>
              <span style={s.profileName}>{profile?.name || 'Super Admin'}</span>
              <span style={s.profileEmail}>{user?.email}</span>
            </div>
          </div>
          <button onClick={handleLogout} style={s.logoutBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main style={s.mainContent}>
        {/* Header */}
        <header style={s.mainHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={s.headerMenuToggleBtn}
              title={sidebarOpen ? "Hide Menu" : "Open Menu"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
              <span>{sidebarOpen ? 'Hide Menu' : 'Open Menu'}</span>
            </button>
            <div>
              <h1 style={s.headerTitle}>
                {activeTab === 'reports' ? 'Admin Analysis Reports' : activeTab === 'orders' ? 'All Tenant Orders' : activeTab === 'account' ? 'Admin Account' : 'Super Admin Dashboard'}
              </h1>
              <p style={s.headerSubtitle}>
                {activeTab === 'reports'
                  ? 'Platform-wide analytics, tenant revenue breakdowns, payment settlements, and top purchased products.'
                  : activeTab === 'orders'
                  ? 'Manage and track live customer orders across all active platform tenants.'
                  : 'Manage tenants, API access and platform configuration.'}
              </p>
            </div>
          </div>
          <button onClick={openCreateTenantModal} style={s.primaryBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create Tenant
          </button>
        </header>

        {(activeTab === 'dashboard' || activeTab === 'tenants') && (
          <>
            {/* Summary Card */}
            <section style={s.summaryGrid}>
          <div style={s.summaryCard}>
            <div style={s.summaryHeader}>
              <span style={s.summaryLabel}>Total Tenants</span>
              <div style={s.summaryIconWrap}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
            </div>
            <div style={s.summaryValue}>{totalCount !== null ? totalCount : tenants.length}</div>
            <p style={s.summaryNote}>
              {tenants.length > 0 ? `${tenants.length} active registered platform tenants.` : 'Active registered platform tenants.'}
            </p>
          </div>
        </section>

        {/* Tenants Section */}
        <section style={s.section}>
          <div style={s.sectionHeader}>
            <h2 style={s.sectionTitle}>Tenants</h2>
            <span style={s.badgeCount}>{tenants.length} Total</span>
          </div>

          {tenants.length === 0 ? (
            <div style={s.emptyState}>
              <div style={s.emptyIconWrap}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
              </div>
              <h3 style={s.emptyTitle}>No tenant data available</h3>
              <p style={s.emptySub}>
                Tenant management API will be connected in the next phase.
              </p>
              <button onClick={openCreateTenantModal} style={s.secondaryBtn}>
                Create Tenant
              </button>
            </div>
          ) : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Tenant ID</th>
                    <th style={s.th}>Business & Contact</th>
                    <th style={s.th}>Tenant Code</th>
                    <th style={s.th}>Subscription</th>
                    <th style={s.th}>Validity Period</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t, i) => {
                    const isYearly = t.subscriptionType === 'YEARLY';
                    return (
                      <tr key={t.tenantId || t.id || i} style={s.tr}>
                        <td style={s.td}>
                          <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#1e293b', fontSize: '13px' }}>
                            {t.tenantId || t.id}
                          </span>
                        </td>
                        <td style={s.td}>
                          <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px' }}>
                            {t.businessName || t.name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            {t.fullName ? t.fullName : ''} {t.ownerEmail || t.email ? `• ${t.ownerEmail || t.email}` : ''}
                          </div>
                        </td>
                        <td style={s.td}>
                          <span style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '11.5px', fontWeight: '700', color: '#334155', letterSpacing: '0.02em' }}>
                            {t.code}
                          </span>
                        </td>
                        <td style={s.td}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700',
                              width: 'fit-content',
                              backgroundColor: isYearly ? '#eff6ff' : '#f0fdf4',
                              color: isYearly ? '#2563eb' : '#16a34a',
                              border: `1px solid ${isYearly ? '#bfdbfe' : '#bbf7d0'}`
                            }}>
                              {isYearly ? 'Yearly' : 'Monthly'}
                            </span>
                            {t.subscriptionAmount != null && (
                              <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>
                                ₹{Number(t.subscriptionAmount).toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={s.td}>
                          <div style={{ fontSize: '12px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span>{formatDisplayDateTime(t.subscriptionStartDate || t.createdAt)}</span>
                            <span style={{ color: '#94a3b8', fontSize: '10.5px' }}>to</span>
                            <span style={{ fontWeight: '600' }}>
                              {t.subscriptionEndDate ? formatDisplayDateTime(t.subscriptionEndDate) : '—'}
                            </span>
                          </div>
                        </td>
                        <td style={s.td}>
                          <span style={s.statusActive}>{t.status || 'ACTIVE'}</span>
                        </td>
                        <td style={s.td}>
                          <span style={{ ...s.statusActive, background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0', fontSize: '11px', padding: '3px 10px' }}>Connected</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
          </>
        )}

        {activeTab === 'orders' && (
          <div style={{ padding: '20px 0', width: '100%' }}>
            <TenantOrders isAdmin={true} tenants={tenants} />
          </div>
        )}

        {activeTab === 'reports' && (
          <div style={{ padding: '10px 0 32px', width: '100%' }}>
            <AdminAnalysisReports tenants={tenants} />
          </div>
        )}

        {activeTab === 'account' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px', width: '100%', padding: '12px 0 32px' }}>
            {/* Top Profile Banner */}
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '24px 28px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                  border: '1.5px solid #d4af37',
                  color: '#b89620',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: '800',
                  boxShadow: '0 4px 12px rgba(212,175,55,0.18)'
                }}>
                  {(profile?.name || user?.email || 'A')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
                      {profile?.name || 'Super Admin'}
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
                      {profile?.role || 'SUPER_ADMIN'}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#64748b' }}>
                    {user?.email}
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
                  Platform Administrator
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

            {/* Information Grid Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '20px' }}>
              {/* Card 1: Identity & Authorization */}
              <div style={{ backgroundColor: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                    Admin Credentials & Access
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.04em' }}>Admin Full Name</span>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a', marginTop: '2px' }}>{profile?.name || 'Super Admin'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.04em' }}>Admin Email</span>
                    <div style={{ fontSize: '13.5px', color: '#0f172a', marginTop: '2px' }}>{user?.email}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.04em' }}>Firebase UID</span>
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
                  <div>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.04em' }}>Access Level</span>
                    <div style={{ fontSize: '13px', color: '#b89620', fontWeight: '700', marginTop: '2px' }}>
                      {profile?.role || 'SUPER_ADMIN'} (Root Administration Scope)
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Platform Scope & Statistics */}
              <div style={{ backgroundColor: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                    Platform Scope & Resources
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.04em' }}>Total Managed Tenants</span>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                      {totalCount !== null ? totalCount : tenants.length} Registered Tenants
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.04em' }}>Backend REST Services</span>
                    <div style={{ fontSize: '13px', color: '#334155', marginTop: '2px' }}>
                      Spring Boot Java API (`/api/v1/admin`)
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.04em' }}>Administrative Privileges</span>
                    <div style={{ fontSize: '12.5px', color: '#059669', fontWeight: '600', marginTop: '2px', lineHeight: 1.4 }}>
                      ✓ Create & provision Tenants<br />
                      ✓ Generate API Client credentials<br />
                      ✓ Real-time multi-tenant Orders oversight
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: Security & Session Metadata */}
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
                    <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '600', marginTop: '2px' }}>
                      Firebase Authentication (ID Token Bearer)
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.04em' }}>Account Created</span>
                    <div style={{ fontSize: '12.5px', color: '#475569', marginTop: '2px' }}>
                      {user?.metadata?.creationTime || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.04em' }}>Last Sign-In</span>
                    <div style={{ fontSize: '12.5px', color: '#475569', marginTop: '2px' }}>
                      {user?.metadata?.lastSignInTime || 'Active Session'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* CREATE TENANT MODAL */}
      {isModalOpen && (
        <div style={s.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div style={s.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>Create New Tenant</h2>
                <p style={s.modalSub}>Provision a tenant account, subscription, and API access.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={s.closeBtn}>
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateTenantSubmit} style={s.form}>
              {/* Business Name & Full Name */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div style={s.field}>
                  <label style={s.label}>Business / Store Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Jewelry"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    style={s.input}
                  />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Owner Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    style={s.input}
                  />
                </div>
              </div>

              {/* Email & Password */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div style={s.field}>
                  <label style={s.label}>Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="owner@store.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={s.input}
                  />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={s.input}
                  />
                </div>
              </div>

              {/* Subscription Type & Amount */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div style={s.field}>
                  <label style={s.label}>Subscription Type *</label>
                  <select
                    value={subscriptionType}
                    onChange={handleSubscriptionTypeChange}
                    style={s.select}
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Subscription Amount (₹) *</label>
                  <div style={s.inputWrap}>
                    <span style={{ position: 'absolute', left: '12px', color: '#64748b', fontWeight: '700', fontSize: '14px', zIndex: 1 }}>₹</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      placeholder="e.g. 999"
                      value={subscriptionAmount}
                      onChange={(e) => setSubscriptionAmount(e.target.value)}
                      style={{ ...s.input, paddingLeft: '28px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Start Date & End Date with Global Validation */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div style={s.field}>
                  <div style={s.labelRow}>
                    <label style={s.label}>Start Date & Time *</label>
                  </div>
                  <input
                    type="datetime-local"
                    required
                    value={subscriptionStartDate}
                    onChange={handleStartDateChange}
                    style={{ ...s.input, borderColor: dateRangeError ? '#ef4444' : '#cbd5e1' }}
                  />
                </div>
                <div style={s.field}>
                  <div style={s.labelRow}>
                    <label style={s.label}>End Date & Time *</label>
                    <button
                      type="button"
                      onClick={handleAutoCalculateEndDate}
                      style={s.genBtn}
                      title="Auto calculate end date based on selected subscription type"
                    >
                      Auto Set
                    </button>
                  </div>
                  <input
                    type="datetime-local"
                    required
                    value={subscriptionEndDate}
                    onChange={handleEndDateChange}
                    style={{ ...s.input, borderColor: dateRangeError ? '#ef4444' : '#cbd5e1' }}
                  />
                </div>
              </div>

              {dateRangeError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontSize: '12px', fontWeight: '600', padding: '8px 12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{dateRangeError}</span>
                </div>
              )}

              {/* Role Dropdown */}
              <div style={s.field}>
                <label style={s.label}>Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={s.select}
                >
                  {Object.keys(ROLE_CONFIG).map((roleKey) => (
                    <option key={roleKey} value={roleKey}>
                      {ROLE_CONFIG[roleKey].label} ({roleKey.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {/* API Key Generation */}
              <div style={s.field}>
                <div style={s.labelRow}>
                  <label style={s.label}>API Key</label>
                  <button
                    type="button"
                    onClick={handleGenerateApiKey}
                    style={s.genBtn}
                  >
                    Generate API Key
                  </button>
                </div>
                <div style={s.inputWrap}>
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="Enter API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    style={s.input}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((v) => !v)}
                    style={s.eyeBtn}
                  >
                    {showApiKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                {apiKeyNotice && (
                  <p style={s.noticeText}>{apiKeyNotice}</p>
                )}
              </div>

              {/* Form Notice Alert */}
              {formNotice && (
                <div style={s.alertBox}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{formNotice}</span>
                </div>
              )}

              {/* Actions */}
              <div style={s.modalActions}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={s.cancelBtn}
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting || !!dateRangeError} style={{ ...s.submitBtn, opacity: (isSubmitting || !!dateRangeError) ? 0.7 : 1 }}>
                  {isSubmitting ? 'Creating...' : 'Create Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes adminSpin { to { transform: rotate(360deg); } }
        input::placeholder {
          color: #94a3b8;
        }
        input:focus, select:focus {
          border-color: #d4af37 !important;
          box-shadow: 0 0 0 3px rgba(212,175,55,0.15) !important;
          outline: none !important;
        }
      `}</style>
    </div>
  );
}

const s = {
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontFamily: "'Inter', sans-serif",
  },
  spinnerLarge: {
    width: '36px',
    height: '36px',
    border: '3px solid rgba(212,175,55,0.25)',
    borderTop: '3px solid #d4af37',
    borderRadius: '50%',
    animation: 'adminSpin 0.75s linear infinite',
    marginBottom: '16px',
  },
  loadingText: {
    fontSize: '14px',
    color: '#64748b',
    letterSpacing: '0.04em',
    fontWeight: '500',
  },
  deniedPage: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    padding: '24px',
    fontFamily: "'Inter', sans-serif",
  },
  deniedCard: {
    maxWidth: '420px',
    width: '100%',
    backgroundColor: '#ffffff',
    border: '1px solid #fecaca',
    borderRadius: '20px',
    padding: '40px 32px',
    textAlign: 'center',
    boxShadow: '0 20px 40px -15px rgba(220,38,38,0.08)',
  },
  lockBadge: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
  },
  deniedTitle: {
    color: '#dc2626',
    fontSize: '24px',
    margin: '0 0 8px',
    fontWeight: '700',
  },
  deniedDesc: {
    color: '#64748b',
    fontSize: '14px',
    lineHeight: '1.6',
    margin: '0 0 24px',
  },
  userInfoBox: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '12px 16px',
    marginBottom: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    alignItems: 'center',
  },
  userLabel: {
    fontSize: '11px',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  userEmail: {
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: '600',
  },
  roleBadge: {
    display: 'inline-block',
    marginTop: '4px',
    padding: '2px 8px',
    borderRadius: '6px',
    backgroundColor: '#fef3c7',
    color: '#b89620',
    fontSize: '11px',
    fontWeight: '600',
    border: '1px solid #fde68a',
  },
  logoutBtnDenied: {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    backgroundColor: '#dc2626',
    color: '#ffffff',
    border: 'none',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(220,38,38,0.2)',
  },
  dashboardLayout: {
    display: 'flex',
    height: '100vh',
    maxHeight: '100vh',
    minHeight: '100vh',
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
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
    boxShadow: '4px 0 24px rgba(15,23,42,0.02)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '24px 16px',
    boxSizing: 'border-box',
    flexShrink: 0,
    overflowY: 'auto',
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
  sidebarBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '32px',
    paddingLeft: '8px',
  },
  sidebarCloseBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.15s ease',
  },
  headerMenuToggleBtn: {
    display: 'flex',
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
  brandBadge: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(212,175,55,0.12)',
  },
  brandLogoImg: {
    width: '28px',
    height: '28px',
    objectFit: 'contain',
  },
  brandName: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '700',
    letterSpacing: '0.12em',
    color: '#0f172a',
  },
  superAdminTag: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#b89620',
    letterSpacing: '0.12em',
  },
  navGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '11px 14px',
    borderRadius: '10px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#64748b',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s',
  },
  navItemActive: {
    backgroundColor: '#fefce8',
    color: '#b89620',
    fontWeight: '600',
    boxShadow: 'inset 3px 0 0 #d4af37',
  },
  navDivider: {
    height: '1px',
    backgroundColor: '#e2e8f0',
    margin: '12px 0',
  },
  navItemDisabled: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    color: '#94a3b8',
    fontSize: '14px',
    cursor: 'not-allowed',
  },
  soonBadge: {
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: '#f1f5f9',
    color: '#64748b',
  },
  sidebarFooter: {
    borderTop: '1px solid #e2e8f0',
    paddingTop: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  adminProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  avatarCircle: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#fef3c7',
    border: '1px solid #fde68a',
    color: '#b89620',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
  },
  profileInfo: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  profileName: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#0f172a',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  profileEmail: {
    fontSize: '11px',
    color: '#64748b',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '9px',
    borderRadius: '8px',
    border: '1px solid #fecaca',
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    width: '100%',
    transition: 'background-color 0.15s',
  },
  mainContent: {
    flex: 1,
    height: '100vh',
    padding: '28px 36px',
    overflowY: 'auto',
    minWidth: 0,
    width: '100%',
    boxSizing: 'border-box',
  },
  mainHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '32px',
  },
  headerTitle: {
    fontSize: '26px',
    fontWeight: '700',
    color: '#0f172a',
    margin: '0 0 6px',
  },
  headerSubtitle: {
    fontSize: '14px',
    color: '#64748b',
    margin: 0,
  },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '11px 20px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #d4af37 0%, #b89620 100%)',
    color: '#ffffff',
    border: 'none',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(212,175,55,0.35)',
  },
  secondaryBtn: {
    padding: '10px 18px',
    borderRadius: '8px',
    backgroundColor: '#fffbeb',
    color: '#b89620',
    border: '1px solid #fde68a',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 320px))',
    gap: '20px',
    marginBottom: '36px',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 10px 25px -5px rgba(15,23,42,0.04)',
  },
  summaryHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  summaryLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  summaryIconWrap: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '8px',
  },
  summaryNote: {
    fontSize: '12px',
    color: '#64748b',
    margin: 0,
  },
  section: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 10px 25px -5px rgba(15,23,42,0.04)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#0f172a',
    margin: 0,
  },
  badgeCount: {
    fontSize: '12px',
    padding: '4px 10px',
    borderRadius: '20px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    fontWeight: '500',
  },
  emptyState: {
    padding: '48px 24px',
    textAlign: 'center',
  },
  emptyIconWrap: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#0f172a',
    margin: '0 0 6px',
  },
  emptySub: {
    fontSize: '13px',
    color: '#64748b',
    margin: '0 0 20px',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  th: {
    padding: '12px 16px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#475569',
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '14px 16px',
    fontSize: '13px',
    color: '#334155',
  },
  statusActive: {
    color: '#15803d',
    backgroundColor: '#dcfce7',
    border: '1px solid #bbf7d0',
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '600',
  },
  actionDisabled: {
    color: '#94a3b8',
    fontSize: '12px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    padding: '24px',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '20px',
    padding: '30px',
    maxWidth: '560px',
    width: '100%',
    maxHeight: '92vh',
    overflowY: 'auto',
    boxShadow: '0 25px 50px -12px rgba(15,23,42,0.18)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '24px',
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#0f172a',
    margin: '0 0 4px',
  },
  modalSub: {
    fontSize: '13px',
    color: '#64748b',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0 4px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: '10px',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    color: '#0f172a',
    fontSize: '14px',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  select: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: '10px',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    color: '#0f172a',
    fontSize: '14px',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  inputWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  eyeBtn: {
    position: 'absolute',
    right: '12px',
    background: 'none',
    border: 'none',
    color: '#64748b',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  genBtn: {
    background: 'none',
    border: 'none',
    color: '#b89620',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    padding: 0,
  },
  noticeText: {
    fontSize: '12px',
    color: '#854d0e',
    margin: '4px 0 0',
  },
  alertBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#fefce8',
    border: '1px solid #fef08a',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '13px',
    color: '#854d0e',
  },
  modalActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '12px',
  },
  cancelBtn: {
    padding: '10px 16px',
    borderRadius: '8px',
    backgroundColor: '#f1f5f9',
    border: '1px solid #e2e8f0',
    color: '#475569',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  submitBtn: {
    padding: '10px 18px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #d4af37 0%, #b89620 100%)',
    border: 'none',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(212,175,55,0.3)',
  },
};

