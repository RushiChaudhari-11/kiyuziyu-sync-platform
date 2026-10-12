import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserSession, adminSignOut, getIdToken, API_BASE } from './adminAuth';
import LogoImage from '../../assets/logoj2.png';

export default function TenantProducts() {
  const [user, setUser] = useState(null);
  const [tenantProfile, setTenantProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Shopify Connection
  const [shopifyConn, setShopifyConn] = useState(null);
  const [shopifyLoading, setShopifyLoading] = useState(true);

  // Products Data
  const [products, setProducts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [syncStatuses, setSyncStatuses] = useState({});
  const [productsLoading, setProductsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  // Filters & Pagination
  const [selectedCollection, setSelectedCollection] = useState('');
  const [selectedSubcollection, setSelectedSubcollection] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedSyncStatus, setSelectedSyncStatus] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('DEFAULT');
  const [selectedRole, setSelectedRole] = useState('retail');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalBackendProducts, setTotalBackendProducts] = useState(0);
  const itemsPerPage = 50;

  const [selectedProductIds, setSelectedProductIds] = useState(new Set());
  
  // Pricing
  const [localSellingPrices, setLocalSellingPrices] = useState({});
  const [bulkUpdateAmount, setBulkUpdateAmount] = useState('');
  const [bulkUpdateType, setBulkUpdateType] = useState('percent'); // 'percent' or 'flat'

  const navigate = useNavigate();

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, selectedCollection, selectedSubcollection, selectedSyncStatus, sortOrder, selectedRole]);

  useEffect(() => {
    setSelectedSubcollection('');
  }, [selectedCollection]);

  const fetchShopifyConnection = useCallback(async () => {
    try {
      const token = await getIdToken();
      const res = await fetch(`${API_BASE}/api/v1/tenants/me/shopify-connection`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setShopifyConn(data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching shopify connection:', err);
    } finally {
      setShopifyLoading(false);
    }
  }, []);

  const fetchCollections = useCallback(async () => {
    try {
      const token = await getIdToken();
      const res = await fetch(`${API_BASE}/api/v1/tenants/me/products/collections`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCollections(data.data || []);
        }
      }
    } catch (err) {
      console.error('Error fetching collections:', err);
    }
  }, []);

  const fetchSyncStatus = useCallback(async () => {
    try {
      const token = await getIdToken();
      const res = await fetch(`${API_BASE}/api/v1/tenants/me/products/sync-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          const statusMap = {};
          data.data.forEach(item => {
            statusMap[item.productId] = item.status;
          });
          setSyncStatuses(statusMap);
        }
      }
    } catch (err) {
      console.error('Error fetching sync status:', err);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const token = await getIdToken();
      let url = `${API_BASE}/api/v1/tenants/me/products?limit=${itemsPerPage}&page=${currentPage}`;
      if (selectedCollection) {
        url += `&collectionId=${encodeURIComponent(selectedCollection)}`;
      }
      if (debouncedSearchQuery && debouncedSearchQuery.trim().length > 0) {
        url += `&search=${encodeURIComponent(debouncedSearchQuery.trim())}`;
      }
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setProducts(data.data || []);
          setTotalBackendProducts(data.totalCount || (data.data && data.data.length) || 0);
        }
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setProductsLoading(false);
    }
  }, [selectedCollection, currentPage, debouncedSearchQuery]);

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

        if (session.type === 'ADMIN') {
          navigate('/admin/dashboard', { replace: true });
          return;
        }

        setTenantProfile(session.profile);
        await Promise.all([
          fetchShopifyConnection(),
          fetchCollections(),
          fetchSyncStatus()
        ]);
        fetchProducts();
      } catch (err) {
        console.error('Error verifying tenant session:', err);
        navigate('/admin/login', { replace: true });
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [navigate, fetchShopifyConnection, fetchCollections, fetchSyncStatus, fetchProducts]);

  const handleLogout = async () => {
    try {
      await adminSignOut();
      navigate('/admin/login', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleSyncSelected = async () => {
    if (selectedProductIds.size === 0) return;
    setSyncing(true);
    const syncedIds = Array.from(selectedProductIds);
    try {
      const token = await getIdToken();
      const res = await fetch(`${API_BASE}/api/v1/tenants/me/products/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productIds: syncedIds }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSelectedProductIds(new Set());
          // Immediately update syncing products to SYNCING state optimistically
          setSyncStatuses(prev => {
            const updated = { ...prev };
            syncedIds.forEach(id => { updated[id] = 'SYNCING'; });
            return updated;
          });
          // Poll sync-status every 3s until no product is still SYNCING (max 60s)
          const startTime = Date.now();
          const poll = async () => {
            if (Date.now() - startTime > 60000) {
              setSyncing(false);
              return;
            }
            const t = await getIdToken();
            const sr = await fetch(`${API_BASE}/api/v1/tenants/me/products/sync-status`, {
              headers: { Authorization: `Bearer ${t}` },
            });
            if (sr.ok) {
              const sd = await sr.json();
              if (sd.success && sd.data) {
                const statusMap = {};
                sd.data.forEach(item => { statusMap[item.productId] = item.status; });
                setSyncStatuses(statusMap);
                // Check if any of the synced products are still in SYNCING state
                const stillSyncing = syncedIds.some(id => statusMap[id] === 'SYNCING');
                if (stillSyncing) {
                  setTimeout(poll, 3000);
                  return;
                }
              }
            }
            setSyncing(false);
          };
          setTimeout(poll, 3000);
        } else {
          setSyncing(false);
          alert(data.message || 'Failed to queue sync job.');
        }
      } else {
        setSyncing(false);
        const errData = await res.json().catch(() => ({}));
        alert(errData.message || 'Failed to queue sync job.');
      }
    } catch (err) {
      setSyncing(false);
      console.error('Error syncing products:', err);
      alert('Error triggering sync.');
    }
  };

  const toggleSelectAll = () => {
    const pageIds = paginatedProducts.map(p => p.productId);
    const allSelected = pageIds.length > 0 && pageIds.every(id => selectedProductIds.has(id));
    if (allSelected) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(pageIds));
    }
  };

  const toggleSelect = (id) => {
    const newSet = new Set(selectedProductIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedProductIds(newSet);
  };

  const handlePriceChange = (productId, val) => {
    setLocalSellingPrices(prev => ({...prev, [productId]: val}));
  };

  const savePriceToBackend = async (productCode, newPrice) => {
    try {
      const token = await getIdToken();
      await fetch(`${API_BASE}/api/v1/tenants/me/products/${encodeURIComponent(productCode)}/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sellingPrice: newPrice })
      });
    } catch(err) {
      console.error('Failed to save price:', err);
    }
  };

  const applyBulkUpdate = () => {
    if (!bulkUpdateAmount) return;
    const amount = parseFloat(bulkUpdateAmount);
    if (isNaN(amount)) return;

    if (selectedProductIds.size === 0) {
      alert("Please select at least one product first.");
      return;
    }

    const newPrices = {...localSellingPrices};
    products.forEach(p => {
      if (selectedProductIds.has(p.productId)) {
        const base = getPriceForRole(p, selectedRole);
        let newP = base;
        if (bulkUpdateType === 'percent') {
          newP = base + (base * (amount / 100));
        } else {
          newP = base + amount;
        }
        // Round to 2 decimal places to avoid long floating point numbers
        newP = Math.round(newP * 100) / 100;
        
        newPrices[p.productId] = newP;
        savePriceToBackend(p.productCode, newP);
      }
    });
    setLocalSellingPrices(newPrices);
    alert('Bulk price update applied to selected products and saving in background!');
  };

  if (loading) {
    return (
      <div style={s.loadingPage}>
        <div style={s.spinWrapper}>
          <div style={s.spinner} />
          <p style={s.loadingText}>Loading Products Module...</p>
        </div>
      </div>
    );
  }

  const roleLabel = tenantProfile?.role || 'TENANT_USER';
  const userEmail = tenantProfile?.email || user?.email || '—';
  const userName = tenantProfile?.name || 'Store Tenant';

  const isConnected = shopifyConn && shopifyConn.status === 'CONNECTED';

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', functional: true, path: '/tenant/dashboard' },
    { id: 'shopify', label: 'Shopify Store', icon: 'shopping-bag', functional: true, path: '/tenant/dashboard?tab=shopify' },
    { id: 'products', label: 'Products', icon: 'package', functional: true, path: '/tenant/products' },
    { id: 'credentials', label: 'API Credentials', icon: 'key', functional: false },
    { id: 'orders', label: 'Orders', icon: 'shopping-cart', functional: true, path: '/tenant/dashboard?tab=orders' },
    { id: 'profile', label: 'Profile', icon: 'user', functional: false },
  ];

  // Stats
  const totalProducts = totalBackendProducts;
  const syncedProducts = Object.values(syncStatuses).filter(st => st === 'SYNCED').length;
  const pendingProducts = Object.values(syncStatuses).filter(st => st === 'PENDING' || st === 'SYNCING').length;

  // Derived Data
  let availableSubcollections = [];
  if (selectedCollection) {
    const coll = collections.find(c => c.id === selectedCollection || c.documentId === selectedCollection);
    if (coll && coll.subcollections) {
      availableSubcollections = Array.from(new Set(coll.subcollections.map(sub => sub.title || sub.name || sub.id).filter(Boolean)));
    }
  } else {
    const allSubs = [];
    collections.forEach(c => {
      if (c.subcollections) {
        c.subcollections.forEach(sub => {
          const subName = sub.title || sub.name || sub.id;
          if (subName) allSubs.push(subName);
        });
      }
    });
    availableSubcollections = Array.from(new Set(allSubs));
  }

  // Filter, Sort, Paginate
  let filteredProducts = products.filter(p => {
    if (!p.stock || p.stock <= 0) return false; // Hide 0 stock products
    
    const status = syncStatuses[p.productId] || 'NOT_SYNCED';
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = (p.productName || '').toLowerCase();
      const code = (p.productCode || '').toLowerCase();
      if (!name.includes(q) && !code.includes(q)) return false;
    }
    
    if (selectedSubcollection) {
      const sub = p.subcollectionData?.title || p.subcollectionData?.name || p.subcollectionId || '';
      if (sub !== selectedSubcollection) return false;
    }

    if (selectedSyncStatus !== 'ALL') {
       if (selectedSyncStatus === 'AVAILABLE_TO_SYNC') {
           if (status !== 'NOT_SYNCED' && status !== 'FAILED') return false;
       } else if (status !== selectedSyncStatus) {
           return false;
       }
    }
    return true;
  });

  const getPriceForRole = (p, role) => {
    const tieredPricing = p.subcollectionData?.tieredPricing;
    if (tieredPricing && tieredPricing[role] && tieredPricing[role].length > 0) {
      const priceVal = tieredPricing[role][0].price;
      return typeof priceVal === 'string' ? parseFloat(priceVal) : priceVal;
    }
    return p.sellingPrice || p.basePrice || 0;
  };

  if (sortOrder === 'PRICE_ASC') {
    filteredProducts.sort((a, b) => getPriceForRole(a, selectedRole) - getPriceForRole(b, selectedRole));
  } else if (sortOrder === 'PRICE_DESC') {
    filteredProducts.sort((a, b) => getPriceForRole(b, selectedRole) - getPriceForRole(a, selectedRole));
  }

  const totalPages = Math.max(1, Math.ceil(totalBackendProducts / itemsPerPage));
  const paginatedProducts = filteredProducts;

  return (
    <div style={s.appLayout}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
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

        <nav style={s.nav}>
          {sidebarItems.map((item) => {
            const isActive = item.id === 'products';
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (!item.functional) return;
                  if (item.path) {
                    navigate(item.path);
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

        <div style={s.userFooter}>
          <div style={s.userInfo}>
            <div style={s.userAvatar}>{(userName.charAt(0) || 'T').toUpperCase()}</div>
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
          <header style={s.header}>
            <div>
              <h1 style={s.pageTitle}>Tenant Products</h1>
              <p style={s.pageSubtitle}>
                Select products to sync with your connected Shopify store.
              </p>
            </div>
          </header>

          {!shopifyLoading && !isConnected ? (
            <div style={s.emptyStateBox}>
              <div style={s.emptyIconBadge}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h3 style={s.emptyTitle}>Shopify Store Not Connected</h3>
              <p style={s.emptySubtitle}>
                Please connect your Shopify store before syncing products.
              </p>
              <button
                onClick={() => navigate('/tenant/dashboard?tab=shopify')}
                style={s.primaryActionBtn}
              >
                Go to Dashboard
              </button>
            </div>
          ) : (
            <>
              {/* Top Stats */}
              <div style={s.gridStats}>
                <div style={s.statCard}>
                  <div style={s.statHeader}>
                    <span style={s.statTitle}>TOTAL PRODUCTS</span>
                  </div>
                  <div style={s.statValue}>{totalProducts}</div>
                  <div style={s.statSub}>Available to Sync</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statHeader}>
                    <span style={s.statTitle}>SYNC PENDING</span>
                  </div>
                  <div style={{...s.statValue, color: '#f59e0b'}}>{pendingProducts}</div>
                  <div style={s.statSub}>Currently Queued</div>
                </div>
                <div style={s.statCard}>
                  <div style={s.statHeader}>
                    <span style={s.statTitle}>SYNCED PRODUCTS</span>
                  </div>
                  <div style={{...s.statValue, color: '#10b981'}}>{syncedProducts}</div>
                  <div style={s.statSub}>Successfully Synced</div>
                </div>
              </div>

              {/* Filters */}
              <div style={s.filterRowWrap}>
                <div style={s.filterGroup}>
                  <label style={s.filterLabel}>Search</label>
                  <input
                    type="text"
                    placeholder="Search name or code..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={s.textInput}
                  />
                </div>

                <div style={s.filterGroup}>
                  <label style={s.filterLabel}>Collection</label>
                  <select 
                    value={selectedCollection} 
                    onChange={e => setSelectedCollection(e.target.value)}
                    style={s.selectInput}
                  >
                    <option value="">All Collections</option>
                    {collections.map(c => (
                      <option key={c.id || c.documentId} value={c.id || c.documentId}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div style={s.filterGroup}>
                  <label style={s.filterLabel}>Subcollection</label>
                  <select 
                    value={selectedSubcollection} 
                    onChange={e => setSelectedSubcollection(e.target.value)}
                    style={s.selectInput}
                  >
                    <option value="">All Subcollections</option>
                    {availableSubcollections.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
                
                <div style={s.filterGroup}>
                  <label style={s.filterLabel}>Sync Status</label>
                  <select 
                    value={selectedSyncStatus} 
                    onChange={e => setSelectedSyncStatus(e.target.value)}
                    style={s.selectInput}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="SYNCED">Synced</option>
                    <option value="NOT_SYNCED">Not Synced</option>
                    <option value="PENDING">Pending</option>
                    <option value="FAILED">Failed</option>
                    <option value="AVAILABLE_TO_SYNC">Available to Sync</option>
                  </select>
                </div>
                
                <div style={s.filterGroup}>
                  <label style={s.filterLabel}>Role</label>
                  <select 
                    value={selectedRole} 
                    onChange={e => setSelectedRole(e.target.value)}
                    style={s.selectInput}
                  >
                    <option value="retail">Retail</option>
                    <option value="dropshipping">Dropshipping</option>
                    <option value="wholesale">Wholesale</option>
                    <option value="dealer">Dealer</option>
                    <option value="vip">VIP</option>
                    <option value="distributor">Distributor</option>
                  </select>
                </div>

                <div style={s.filterGroup}>
                  <label style={s.filterLabel}>Sort By</label>
                  <select 
                    value={sortOrder} 
                    onChange={e => setSortOrder(e.target.value)}
                    style={s.selectInput}
                  >
                    <option value="DEFAULT">Default</option>
                    <option value="PRICE_ASC">Price: Low to High</option>
                    <option value="PRICE_DESC">Price: High to Low</option>
                  </select>
                </div>
              </div>

              {/* Bulk Update Row */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 24px', 
                backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                marginBottom: '20px'
              }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>Bulk Price Update:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select 
                    value={bulkUpdateType} 
                    onChange={e => setBulkUpdateType(e.target.value)}
                    style={{...s.selectInput, width: '120px'}}
                  >
                    <option value="percent">Percent (+%)</option>
                    <option value="flat">Flat (+₹)</option>
                  </select>
                  <input
                    type="number"
                    placeholder="e.g. 10"
                    value={bulkUpdateAmount}
                    onChange={e => setBulkUpdateAmount(e.target.value)}
                    style={{...s.textInput, width: '100px'}}
                  />
                  <button onClick={applyBulkUpdate} style={s.secondaryActionBtn}>
                    Apply to Selected
                  </button>
                </div>
              </div>

              {/* Products Table */}
              <div style={s.tableCard}>
                {productsLoading ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    Loading products...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    No products found matching your criteria.
                  </div>
                ) : (
                  <div style={s.tableWrapper}>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          <th style={s.thCheckbox}>
                            <input 
                              type="checkbox" 
                              checked={paginatedProducts.length > 0 && paginatedProducts.every(p => selectedProductIds.has(p.productId))}
                              onChange={toggleSelectAll}
                            />
                          </th>
                          <th style={s.th}>Product</th>
                          <th style={s.th}>Code</th>
                          <th style={s.th}>Category</th>
                          <th style={s.th}>Stock &amp; Variants</th>
                          <th style={s.th}>Base Price</th>
                          <th style={s.th}>Selling Price</th>
                          <th style={s.th}>Sync Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedProducts.map(p => {
                          const pId = p.productId;
                          const isSelected = selectedProductIds.has(pId);
                          const status = syncStatuses[pId] || 'NOT_SYNCED';
                          const currentBase = getPriceForRole(p, selectedRole);
                          const selling = localSellingPrices[pId] !== undefined ? localSellingPrices[pId] : (p.sellingPrice || currentBase);
                          
                          let statusColor = '#64748b';
                          let statusBg = '#f1f5f9';
                          if (status === 'SYNCED') {
                            statusColor = '#059669'; statusBg = '#d1fae5';
                          } else if (status === 'SYNCING') {
                            statusColor = '#2563eb'; statusBg = '#dbeafe';
                          } else if (status === 'PENDING') {
                            statusColor = '#d97706'; statusBg = '#fef3c7';
                          } else if (status === 'FAILED') {
                            statusColor = '#dc2626'; statusBg = '#fee2e2';
                          } else if (status === 'PARTIAL') {
                            statusColor = '#9333ea'; statusBg = '#f3e8ff';
                          }

                          const categoryName = p.collectionData?.title || p.collectionId || '—';

                          const isOutOfStock = !p.stock || p.stock <= 0;
                          
                          return (
                            <tr key={pId} style={{...(isSelected ? s.trSelected : s.tr), opacity: isOutOfStock ? 0.75 : 1}}>
                              <td style={s.tdCheckbox}>
                                <input 
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelect(pId)}
                                />
                              </td>
                              <td style={s.td}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  {p.image ? (
                                    <img src={p.image} alt={p.productName} style={s.productImg} />
                                  ) : (
                                    <div style={s.productImgPlaceholder} />
                                  )}
                                  <span style={s.productName}>{p.productName || '—'}</span>
                                </div>
                              </td>
                              <td style={s.td}>{p.productCode || '—'}</td>
                              <td style={s.td}>{categoryName}</td>
                              <td style={s.td}>
                                {p.variations && p.variations.length > 0 ? (
                                  <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {p.variations.map((v, i) => {
                                      const parts = [];
                                      if (v.color && String(v.color).trim()) parts.push(String(v.color).trim());
                                      if (v.size && String(v.size).trim()) parts.push(String(v.size).trim());
                                      if (parts.length === 0 && (v.name || v.title)) parts.push(String(v.name || v.title).trim());
                                      const varName = parts.length > 0 ? parts.join(' - ') : `Variant ${i + 1}`;
                                      
                                      let qty = 0;
                                      if (v.quantity !== undefined && v.quantity !== null && String(v.quantity).trim() !== '') {
                                        qty = Number(v.quantity);
                                      } else if (v.initialQuantity !== undefined && v.initialQuantity !== null && String(v.initialQuantity).trim() !== '') {
                                        qty = Number(v.initialQuantity);
                                      }
                                      
                                      return (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span style={{ color: '#475569', fontWeight: '500' }}>{varName}:</span>
                                          <span style={{ fontWeight: '600', color: '#0f172a' }}>{qty}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div style={{ fontWeight: '600', color: '#0f172a' }}>
                                    Total: {p.quantity !== undefined && p.quantity !== null && String(p.quantity).trim() !== '' ? Number(p.quantity) : (p.stock !== undefined && p.stock !== null ? p.stock : 0)}
                                  </div>
                                )}
                              </td>
                              <td style={s.td}>₹{currentBase}</td>
                              <td style={s.td}>
                                <input 
                                  type="number"
                                  value={selling}
                                  onChange={e => handlePriceChange(pId, e.target.value)}
                                  onBlur={e => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) savePriceToBackend(p.productCode, val);
                                  }}
                                  style={{...s.textInput, width: '90px', padding: '6px 8px'}}
                                />
                              </td>
                              <td style={s.td}>
                                <span style={{...s.statusBadge, color: statusColor, backgroundColor: statusBg}}>
                                  {status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {/* Footer Action & Pagination */}
                <div style={s.tableFooter}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={s.selectionText}>
                      {selectedProductIds.size} products selected overall
                    </span>
                    <button
                      onClick={toggleSelectAll}
                      style={s.secondaryActionBtn}
                    >
                      {paginatedProducts.length > 0 && paginatedProducts.every(p => selectedProductIds.has(p.productId)) ? 'Deselect Page' : 'Select Page'}
                    </button>
                    <button 
                      onClick={handleSyncSelected} 
                      disabled={selectedProductIds.size === 0 || syncing}
                      style={{...s.primaryActionBtn, opacity: selectedProductIds.size === 0 ? 0.5 : 1}}
                    >
                      {syncing ? 'Syncing...' : 'Sync Selected'}
                    </button>
                  </div>
                  
                  {totalPages > 1 && (
                    <div style={s.pagination}>
                      <button 
                        style={s.pageBtn} 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      >
                        Previous
                      </button>
                      <span style={s.pageText}>
                        Page {currentPage} of {totalPages}
                      </span>
                      <button 
                        style={s.pageBtn} 
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

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
  spinWrapper: { textAlign: 'center' },
  spinner: {
    width: '36px', height: '36px', border: '3px solid #e2e8f0',
    borderTop: '3px solid #d4af37', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
  },
  loadingText: { color: '#64748b', fontSize: '14px', fontWeight: '500' },
  appLayout: {
    display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", color: '#0f172a',
  },
  sidebar: {
    width: '260px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0',
    display: 'flex', flexDirection: 'column', padding: '24px 16px', boxSizing: 'border-box', flexShrink: 0,
  },
  sidebarBrand: {
    display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '24px',
    borderBottom: '1px solid #f1f5f9', marginBottom: '20px',
  },
  logoBadge: {
    width: '42px', height: '42px', borderRadius: '10px',
    background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoImg: { width: '28px', height: '28px', objectFit: 'contain' },
  brandName: { margin: 0, fontSize: '16px', fontWeight: '700', letterSpacing: '0.1em', color: '#0f172a' },
  roleBadge: { fontSize: '10px', fontWeight: '700', color: '#b89620', letterSpacing: '0.08em' },
  nav: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 },
  navItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px', borderRadius: '10px', border: 'none', backgroundColor: 'transparent',
    fontSize: '14px', fontWeight: '500', color: '#64748b', transition: 'all 0.2s', width: '100%',
  },
  navItemActive: { backgroundColor: '#fef3c7', color: '#b89620' },
  navItemLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  soonBadge: {
    fontSize: '10px', fontWeight: '600', backgroundColor: '#f1f5f9',
    color: '#94a3b8', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase',
  },
  userFooter: {
    paddingTop: '20px', borderTop: '1px solid #e2e8f0', display: 'flex',
    alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto',
  },
  userInfo: { display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' },
  userAvatar: {
    width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#fef3c7',
    color: '#b89620', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: '600', fontSize: '14px', flexShrink: 0,
  },
  userTextGroup: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  userNameText: { fontSize: '13px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userEmailText: { fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  logoutBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px',
    backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
    color: '#dc2626', cursor: 'pointer', flexShrink: 0,
  },
  mainContent: { flex: 1, padding: '32px 48px', overflowY: 'auto' },
  container: { maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700', color: '#0f172a' },
  pageSubtitle: { margin: 0, fontSize: '14px', color: '#64748b' },
  gridStats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' },
  statCard: { backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column' },
  statHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  statTitle: { fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  statValue: { fontSize: '28px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' },
  statSub: { fontSize: '12px', color: '#94a3b8' },
  filterRowWrap: { display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  filterLabel: { fontSize: '13px', fontWeight: '500', color: '#64748b' },
  textInput: { padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', backgroundColor: '#fff', minWidth: '220px' },
  selectInput: { padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', backgroundColor: '#fff', minWidth: '160px' },
  tableCard: { backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' },
  tableWrapper: { overflowX: 'auto', overflowY: 'auto', maxHeight: '450px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  thCheckbox: { padding: '16px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', width: '40px' },
  tdCheckbox: { padding: '16px', borderBottom: '1px solid #f1f5f9' },
  th: { padding: '16px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', textAlign: 'left', fontWeight: '600', color: '#475569' },
  td: { padding: '16px', borderBottom: '1px solid #f1f5f9', color: '#1e293b' },
  tr: { backgroundColor: '#ffffff', transition: 'background-color 0.15s' },
  trSelected: { backgroundColor: '#fef9c3' },
  productImg: { width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' },
  productImgPlaceholder: { width: '40px', height: '40px', borderRadius: '6px', backgroundColor: '#e2e8f0' },
  productName: { fontWeight: '500' },
  statusBadge: { display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '600' },
  tableFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' },
  selectionText: { fontSize: '14px', color: '#64748b', fontWeight: '500' },
  primaryActionBtn: { padding: '10px 20px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
  secondaryActionBtn: { padding: '10px 16px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' },
  emptyStateBox: { backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' },
  emptyIconBadge: { width: '64px', height: '64px', borderRadius: '16px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' },
  emptyTitle: { fontSize: '18px', fontWeight: '600', color: '#0f172a', margin: '0 0 8px 0' },
  emptySubtitle: { fontSize: '14px', color: '#64748b', marginBottom: '24px', maxWidth: '400px' },
  pagination: { display: 'flex', alignItems: 'center', gap: '12px' },
  pageBtn: { padding: '8px 12px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', fontWeight: '500', color: '#475569', cursor: 'pointer' },
  pageText: { fontSize: '13px', color: '#64748b', fontWeight: '500' }
};
