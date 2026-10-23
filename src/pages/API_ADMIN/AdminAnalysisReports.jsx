import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../../firebase';
import { collection, query, getDocs, onSnapshot } from 'firebase/firestore';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function AdminAnalysisReports({ tenants = [] }) {
  const [orders, setOrders] = useState([]);
  const [adminPayments, setAdminPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Filters
  const [dateRangePreset, setDateRangePreset] = useState('all'); // 'all', 'today', 'week', 'month', 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTabSection, setActiveTabSection] = useState('all'); // 'all', 'tenants', 'products', 'payments', 'transactions'

  // Map tenants for lookup
  const tenantInfoMap = useMemo(() => {
    const map = {};
    (tenants || []).forEach((t) => {
      const id = t.id || t.tenantId;
      if (id) {
        map[id] = {
          name: t.name || t.fullName || 'Tenant',
          code: t.code || t.tenantCode || '',
          email: t.email || t.ownerEmail || ''
        };
      }
    });
    // Add known defaults
    if (!map['g0usC1NMyehaoSKJRhOqUUhZAO62']) {
      map['g0usC1NMyehaoSKJRhOqUUhZAO62'] = {
        name: 'Test Store',
        code: 'TEST-STORE',
        email: 'teststore@gmail.com'
      };
    }
    if (!map['tenant_7802bd5e01fb']) {
      map['tenant_7802bd5e01fb'] = {
        name: 'Rushiiii',
        code: 'RUSHI-TENANT',
        email: 'Tenant@gmail.com'
      };
    }
    return map;
  }, [tenants]);

  // Compute effective date range strings
  const { startDateStr, endDateStr } = useMemo(() => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (dateRangePreset === 'today') {
      const todayStr = toYMD(now);
      return { startDateStr: todayStr, endDateStr: todayStr };
    }
    if (dateRangePreset === 'week') {
      const past = new Date(now);
      past.setDate(past.getDate() - 6);
      return { startDateStr: toYMD(past), endDateStr: toYMD(now) };
    }
    if (dateRangePreset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDateStr: toYMD(firstDay), endDateStr: toYMD(now) };
    }
    if (dateRangePreset === 'custom') {
      return { startDateStr: customStartDate || '', endDateStr: customEndDate || '' };
    }
    return { startDateStr: '', endDateStr: '' };
  }, [dateRangePreset, customStartDate, customEndDate]);

  // Real-time listener for orders & payments
  const fetchAllData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Fetch Orders
      const ordersQ = query(collection(db, 'apiTenantOrders'));
      const ordersSnap = await getDocs(ordersQ);
      const fetchedOrders = [];
      ordersSnap.forEach((d) => fetchedOrders.push({ id: d.id, ...d.data() }));

      // 2. Fetch Admin Payments
      const paymentsQ = query(collection(db, 'adminPayments'));
      const paymentsSnap = await getDocs(paymentsQ);
      const fetchedPayments = [];
      paymentsSnap.forEach((d) => fetchedPayments.push({ id: d.id, ...d.data() }));

      setOrders(fetchedOrders);
      setAdminPayments(fetchedPayments);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching admin analysis data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();

    // Attach real-time snapshot listener
    let unsubOrders;
    try {
      unsubOrders = onSnapshot(collection(db, 'apiTenantOrders'), () => {
        fetchAllData(true);
      });
    } catch (e) {
      console.warn('Orders snapshot skipped:', e);
    }

    return () => {
      if (unsubOrders) unsubOrders();
    };
  }, [fetchAllData]);

  // Format currency helper (INR)
  const formatCurrency = (val) => {
    const num = Number(val || 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  // Safe helper to parse any date / Firestore Timestamp / millis / string into 'YYYY-MM-DD'
  const parseToDateString = (val) => {
    if (!val) return '';
    try {
      if (typeof val === 'string') {
        return val.length >= 10 ? val.slice(0, 10) : val;
      }
      if (typeof val.toDate === 'function') {
        const d = val.toDate();
        if (!isNaN(d.getTime())) {
          const pad = (n) => String(n).padStart(2, '0');
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        }
      }
      if (val.seconds !== undefined && typeof val.seconds === 'number') {
        const d = new Date(val.seconds * 1000);
        if (!isNaN(d.getTime())) {
          const pad = (n) => String(n).padStart(2, '0');
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        }
      }
      if (typeof val.toMillis === 'function') {
        const d = new Date(val.toMillis());
        if (!isNaN(d.getTime())) {
          const pad = (n) => String(n).padStart(2, '0');
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        }
      }
      if (val instanceof Date && !isNaN(val.getTime())) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())}`;
      }
      if (typeof val === 'number') {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          const pad = (n) => String(n).padStart(2, '0');
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        }
      }
      const str = String(val);
      return str.length >= 10 ? str.slice(0, 10) : str;
    } catch {
      return '';
    }
  };

  // Safe helper to format any date / Firestore Timestamp for UI display
  const formatDisplayDate = (val) => {
    if (!val) return '—';
    try {
      let d = null;
      if (typeof val === 'string') {
        d = new Date(val);
      } else if (typeof val.toDate === 'function') {
        d = val.toDate();
      } else if (val.seconds !== undefined && typeof val.seconds === 'number') {
        d = new Date(val.seconds * 1000);
      } else if (typeof val.toMillis === 'function') {
        d = new Date(val.toMillis());
      } else if (val instanceof Date) {
        d = val;
      } else if (typeof val === 'number') {
        d = new Date(val);
      }
      if (d && !isNaN(d.getTime())) {
        return d.toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }
      return String(val);
    } catch {
      return String(val);
    }
  };

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!startDateStr && !endDateStr) return true;
      const dStr = parseToDateString(o.createdAt || o.orderDate);
      if (!dStr) return true;
      if (startDateStr && dStr < startDateStr) return false;
      if (endDateStr && dStr > endDateStr) return false;
      return true;
    });
  }, [orders, startDateStr, endDateStr]);

  // Filter payments by date range
  const filteredPayments = useMemo(() => {
    return adminPayments.filter((p) => {
      if (!startDateStr && !endDateStr) return true;
      const dStr = parseToDateString(p.createdAt || p.date);
      if (!dStr) return true;
      if (startDateStr && dStr < startDateStr) return false;
      if (endDateStr && dStr > endDateStr) return false;
      return true;
    });
  }, [adminPayments, startDateStr, endDateStr]);

  // =========================================================================
  // FINANCIAL CALCULATIONS & TENANT BREAKDOWNS (Requirement 3, 4, 6)
  // =========================================================================
  const analysis = useMemo(() => {
    let totalPlatformGrossSales = 0;
    let totalPlatformBaseCost = 0;
    let totalPlatformSupplierPurchaseCost = 0;
    let totalPlatformAdminProfit = 0; // "Apla Profit"
    let totalActiveOrdersCount = 0;
    let totalCancelledOrdersCount = 0;
    let totalCancelledExcludedAmount = 0;
    const cancelledOrdersList = [];
    const restoredInventoryList = [];

    // Tenant-wise aggregation maps
    const tenantMap = {};

    // Product purchases map ("Requirement 2: how is most parches")
    const productPurchasesMap = {};

    // 1. Process Orders
    filteredOrders.forEach((o) => {
      const tId = o.tenantId || 'UNKNOWN';
      const status = (o.status || 'Pending Payment').trim();
      const isCancelled = status.toLowerCase().includes('cancel') || status.toLowerCase().includes('fail');

      const selling = Number(o.totalSellingPrice || o.totalAmount || 0);
      const base = Number(o.totalBasePrice || 0);
      const purchase = Number(o.totalPurchasePrice || 0);
      const adminProfit = Number(o.totalAdminProfit || (base - purchase));

      // Init tenant map item
      if (!tenantMap[tId]) {
        const info = tenantInfoMap[tId] || {};
        tenantMap[tId] = {
          tenantId: tId,
          name: o.tenantName || info.name || (tId.length > 8 ? `${tId.substring(0, 8)}...` : tId),
          code: o.tenantCode || info.code || '',
          totalOrders: 0,
          activeOrders: 0,
          cancelledOrders: 0,
          grossSales: 0,
          basePricePayable: 0,
          purchaseCost: 0,
          adminProfit: 0,
          amountPaid: 0
        };
      }

      tenantMap[tId].totalOrders += 1;

      if (isCancelled) {
        totalCancelledOrdersCount += 1;
        totalCancelledExcludedAmount += selling;
        tenantMap[tId].cancelledOrders += 1;
        cancelledOrdersList.push(o);

        // Collect restored inventory items for Category 7
        if (o.items && Array.isArray(o.items)) {
          o.items.forEach((item) => {
            restoredInventoryList.push({
              orderId: o.id,
              orderNumber: o.orderNumber || o.id,
              tenantId: tId,
              tenantName: o.tenantName || tenantInfoMap[tId]?.name || 'Tenant',
              productCode: item.productCode || item.code || 'N/A',
              productName: item.productName || item.name || 'Product',
              variantName: item.variantName || item.color || item.title || 'Standard',
              sku: item.sku || 'N/A',
              quantityRestored: Number(item.quantity || 1),
              isRestored: o.inventoryRestored ?? true,
              date: o.updatedAt || o.createdAt
            });
          });
        }
        // REQUIREMENT 6: Cancelled orders are shown, but their amount is NOT added to totals!
        return;
      }

      // Valid active order
      totalActiveOrdersCount += 1;
      totalPlatformGrossSales += selling;
      totalPlatformBaseCost += base;
      totalPlatformSupplierPurchaseCost += purchase;
      totalPlatformAdminProfit += adminProfit;

      tenantMap[tId].activeOrders += 1;
      tenantMap[tId].grossSales += selling;
      tenantMap[tId].basePricePayable += base;
      tenantMap[tId].purchaseCost += purchase;
      tenantMap[tId].adminProfit += adminProfit;

      // Track item-level purchases for "most purchases"
      if (o.items && Array.isArray(o.items)) {
        o.items.forEach((item) => {
          const code = item.productCode || item.code || 'UNKNOWN';
          const name = item.productName || item.name || 'Product';
          const qty = Number(item.quantity || 1);
          const itemRev = Number(item.sellingPrice || item.price || 0) * qty;

          if (!productPurchasesMap[code]) {
            productPurchasesMap[code] = {
              code,
              name,
              totalUnitsPurchased: 0,
              totalRevenue: 0,
              ordersCount: 0
            };
          }
          productPurchasesMap[code].totalUnitsPurchased += qty;
          productPurchasesMap[code].totalRevenue += itemRev;
          productPurchasesMap[code].ordersCount += 1;
        });
      }
    });

    // 2. Process Admin Payments for Tenant Paid amounts
    let totalAdminAmountReceived = 0;
    filteredPayments.forEach((p) => {
      const tId = p.tenantId || p.sellerId || 'UNKNOWN';
      const amt = Number(p.amount || 0);
      const isCompleted = (p.status || 'COMPLETED').toUpperCase() === 'COMPLETED';

      if (isCompleted) {
        totalAdminAmountReceived += amt;
        if (tenantMap[tId]) {
          tenantMap[tId].amountPaid += amt;
        } else {
          const info = tenantInfoMap[tId] || {};
          tenantMap[tId] = {
            tenantId: tId,
            name: info.name || tId,
            code: info.code || '',
            totalOrders: 0,
            activeOrders: 0,
            cancelledOrders: 0,
            grossSales: 0,
            basePricePayable: 0,
            purchaseCost: 0,
            adminProfit: 0,
            amountPaid: amt
          };
        }
      }
    });

    const tenantList = Object.values(tenantMap).map((t) => {
      const remainingPending = Math.max(0, t.basePricePayable - t.amountPaid);
      return {
        ...t,
        remainingPending,
        isSettled: remainingPending <= 0 && t.basePricePayable > 0
      };
    });

    // Sort tenants by orders count descending ("Top tenants show as per order")
    const topTenantsByOrders = [...tenantList].sort((a, b) => b.totalOrders - a.totalOrders);

    // Sort top purchased products by units descending
    const topPurchasedProducts = Object.values(productPurchasesMap).sort(
      (a, b) => b.totalUnitsPurchased - a.totalUnitsPurchased
    );

    const totalAdminAmountPending = Math.max(0, totalPlatformBaseCost - totalAdminAmountReceived);

    return {
      totalPlatformGrossSales,
      totalPlatformBaseCost,
      totalPlatformSupplierPurchaseCost,
      totalPlatformAdminProfit,
      totalActiveOrdersCount,
      totalCancelledOrdersCount,
      totalCancelledExcludedAmount,
      totalAdminAmountReceived,
      totalAdminAmountPending,
      tenantList,
      topTenantsByOrders,
      topPurchasedProducts,
      cancelledOrdersList,
      restoredInventoryList
    };
  }, [filteredOrders, filteredPayments, tenantInfoMap]);

  // Filtered Tenant list based on search
  const displayedTenants = useMemo(() => {
    if (!searchQuery.trim()) return analysis.topTenantsByOrders;
    const q = searchQuery.toLowerCase().trim();
    return analysis.topTenantsByOrders.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.tenantId.toLowerCase().includes(q)
    );
  }, [analysis.topTenantsByOrders, searchQuery]);

  // CSV Export Handler
  const handleExportCSV = () => {
    const rows = [];
    rows.push(['SUPER ADMIN ANALYSIS REPORT - KIYUZIYU']);
    rows.push(['Generated At', new Date().toLocaleString()]);
    rows.push(['Date Range Filter', `${startDateStr || 'All Time'} to ${endDateStr || 'Now'}`]);
    rows.push([]);

    rows.push(['--- PLATFORM OVERVIEW ---']);
    rows.push(['Total Registered Tenants', tenants.length]);
    rows.push(['Active Orders Count', analysis.totalActiveOrdersCount]);
    rows.push(['Total Gross Sales (INR)', analysis.totalPlatformGrossSales]);
    rows.push(['Admin Base Payable (INR)', analysis.totalPlatformBaseCost]);
    rows.push(['Apla Profit / Admin Net Profit (INR)', analysis.totalPlatformAdminProfit]);
    rows.push(['Tenant Payments Received (INR)', analysis.totalAdminAmountReceived]);
    rows.push(['Tenant Payments Pending (INR)', analysis.totalAdminAmountPending]);
    rows.push(['Cancelled Orders Count (Excluded)', analysis.totalCancelledOrdersCount]);
    rows.push(['Cancelled Excluded Value (INR)', analysis.totalCancelledExcludedAmount]);
    rows.push([]);

    rows.push(['--- TENANT-WISE BREAKDOWN & PROFIT ---']);
    rows.push(['Tenant Name', 'Code', 'Total Orders', 'Active Orders', 'Gross Sales', 'Wholesale Base Cost', 'Apla Profit', 'Amount Paid', 'Amount Pending']);
    analysis.topTenantsByOrders.forEach((t) => {
      rows.push([
        `"${t.name}"`,
        `"${t.code}"`,
        t.totalOrders,
        t.activeOrders,
        t.grossSales,
        t.basePricePayable,
        t.adminProfit,
        t.amountPaid,
        t.remainingPending
      ]);
    });
    rows.push([]);

    rows.push(['--- TOP PURCHASED PRODUCTS ---']);
    rows.push(['Product Code', 'Product Name', 'Units Sold', 'Total Revenue (INR)', 'Orders Count']);
    analysis.topPurchasedProducts.slice(0, 50).forEach((p) => {
      rows.push([`"${p.code}"`, `"${p.name}"`, p.totalUnitsPurchased, p.totalRevenue, p.ordersCount]);
    });
    rows.push([]);

    rows.push(['--- ADMIN TRANSACTIONS LOG ---']);
    rows.push(['Transaction ID', 'Date', 'Tenant ID', 'Amount', 'Status', 'Reference ID']);
    filteredPayments.forEach((p) => {
      rows.push([
        `"${p.transactionId || p.id}"`,
        `"${formatDisplayDate(p.createdAt || p.date)}"`,
        `"${p.tenantId || p.sellerId || ''}"`,
        p.amount || 0,
        `"${p.status || 'COMPLETED'}"`,
        `"${p.referenceId || ''}"`
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Admin_Analysis_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={st.container}>
      {/* Top Header Bar */}
      <div style={st.headerBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={st.headerIconBadge}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b89620" strokeWidth="2.5">
              <line x1="12" y1="20" x2="12" y2="10" />
              <line x1="18" y1="20" x2="18" y2="4" />
              <line x1="6" y1="20" x2="6" y2="16" />
            </svg>
          </div>
          <div>
            <h1 style={st.headerTitle}>Admin Analysis Reports</h1>
            <p style={st.headerSubtitle}>
              Platform-wide performance, tenant profitability, payment settlements, and top purchased products.
            </p>
          </div>
        </div>

        {/* Global Controls: Presets, Date Picker, Refresh, CSV Export */}
        <div style={st.controlCluster}>
          <div style={st.presetGroup}>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'month', label: 'This Month' },
              { id: 'week', label: 'Last 7 Days' },
              { id: 'today', label: 'Today' },
              { id: 'custom', label: 'Custom' }
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => setDateRangePreset(preset.id)}
                style={{
                  ...st.presetBtn,
                  ...(dateRangePreset === preset.id ? st.presetBtnActive : {})
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {dateRangePreset === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={st.dateInput}
              />
              <span style={{ fontSize: '12px', color: '#64748b' }}>to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={st.dateInput}
              />
            </div>
          )}

          <button onClick={() => fetchAllData(true)} disabled={refreshing} style={st.btnRefresh}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button onClick={handleExportCSV} style={st.btnExport}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {lastUpdated && (
        <div style={st.timestampRow}>
          <span style={st.liveDot} />
          <span>Real-time connected • Last synchronized: {lastUpdated.toLocaleTimeString()}</span>
        </div>
      )}

      {/* ============================================================
          TOP EXECUTIVE CARDS (Requirements 1, 3, 4, 6)
         ============================================================ */}
      <div style={st.kpiGrid}>
        {/* Card 1: Total Tenants */}
        <div style={st.kpiCard}>
          <div style={st.kpiTop}>
            <span style={st.kpiLabel}>TOTAL TENANTS</span>
            <span style={{ ...st.kpiIcon, backgroundColor: '#fef3c7', color: '#b89620' }}>🏢</span>
          </div>
          <div style={st.kpiVal}>{tenants.length || Object.keys(tenantInfoMap).length}</div>
          <div style={st.kpiSub}>Registered store tenants on platform</div>
        </div>

        {/* Card 2: Total Platform Sales (Gross, Excl. Cancelled) */}
        <div style={st.kpiCard}>
          <div style={st.kpiTop}>
            <span style={st.kpiLabel}>TOTAL PLATFORM SALES</span>
            <span style={{ ...st.kpiIcon, backgroundColor: '#eff6ff', color: '#2563eb' }}>🛒</span>
          </div>
          <div style={st.kpiVal}>{formatCurrency(analysis.totalPlatformGrossSales)}</div>
          <div style={st.kpiSub}>{analysis.totalActiveOrdersCount} fulfilled/confirmed customer orders</div>
        </div>

        {/* Card 3: APLA PROFIT (Admin Net Profit) */}
        <div style={{ ...st.kpiCard, border: '1.5px solid #a7f3d0' }}>
          <div style={st.kpiTop}>
            <span style={{ ...st.kpiLabel, color: '#059669' }}>APLA PROFIT (ADMIN NET PROFIT)</span>
            <span style={{ ...st.kpiIcon, backgroundColor: '#ecfdf5', color: '#059669' }}>💰</span>
          </div>
          <div style={{ ...st.kpiVal, color: '#059669' }}>
            {formatCurrency(analysis.totalPlatformAdminProfit)}
          </div>
          <div style={st.kpiSub}>Net margin earned across all tenant sales</div>
        </div>

        {/* Card 4: Tenant Payments Status (Paid vs Pending) */}
        <div style={st.kpiCard}>
          <div style={st.kpiTop}>
            <span style={st.kpiLabel}>TENANT PAYMENTS SETTLED</span>
            <span style={{ ...st.kpiIcon, backgroundColor: '#f1f5f9', color: '#475569' }}>💳</span>
          </div>
          <div style={st.kpiVal}>{formatCurrency(analysis.totalAdminAmountReceived)}</div>
          <div style={st.kpiSub}>
            <strong style={{ color: analysis.totalAdminAmountPending > 0 ? '#d97706' : '#10b981' }}>
              Pending: {formatCurrency(analysis.totalAdminAmountPending)}
            </strong>
          </div>
        </div>
      </div>

      {/* Requirement 6 Callout: Cancelled Orders Banner */}
      {analysis.totalCancelledOrdersCount > 0 && (
        <div style={st.cancelledBanner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={st.cancelledPill}>✕ {analysis.totalCancelledOrdersCount} Cancelled Orders</span>
            <span style={{ fontSize: '12.5px', color: '#b91c1c' }}>
              Total excluded from sales & profit: <strong>{formatCurrency(analysis.totalCancelledExcludedAmount)}</strong> (Zero financial impact on reports)
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Stock automatically restored to Firebase</span>
        </div>
      )}

      {/* ============================================================
          CATEGORY TAB BUTTONS (All 7 Requirements + Overview)
         ============================================================ */}
      <div style={st.categoryNavContainer}>
        <div style={st.categoryHeaderRow}>
          <span style={st.categoryHeadingText}>REPORT CATEGORIES & MODULES:</span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Click any category to isolate its detailed information</span>
        </div>
        <div style={st.categoryGrid}>
          {[
            { id: 'all', num: 'All', icon: '📊', label: 'Full Overview', badge: 'All In One' },
            { id: 'total_tenants', num: '1', icon: '🏢', label: 'Total Tenants', badge: `${tenants.length || Object.keys(tenantInfoMap).length} Registered` },
            { id: 'most_purchased', num: '2', icon: '🔥', label: 'Most Purchases', badge: `${analysis.topPurchasedProducts.length} Products` },
            { id: 'tenant_profit', num: '3', icon: '💰', label: 'Tenant Orders & Apla Profit', badge: `${analysis.totalActiveOrdersCount} Orders` },
            { id: 'payment_status', num: '4', icon: '💳', label: 'Tenant Paid & Pending', badge: `Pending: ${formatCurrency(analysis.totalAdminAmountPending)}` },
            { id: 'transactions_top', num: '5', icon: '📜', label: 'Transactions & Top Tenants', badge: `${filteredPayments.length} Transactions` },
            { id: 'cancelled_orders', num: '6', icon: '❌', label: 'Cancelled Orders', badge: `${analysis.totalCancelledOrdersCount} Excluded` },
            { id: 'stock_restoration', num: '7', icon: '📦', label: 'Stock Restored to Firebase', badge: `${analysis.restoredInventoryList.length} Restored` }
          ].map((cat) => {
            const isActive = activeTabSection === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTabSection(cat.id)}
                style={{
                  ...st.categoryCardBtn,
                  ...(isActive ? st.categoryCardBtnActive : {})
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ ...st.categoryNumBadge, ...(isActive ? st.categoryNumBadgeActive : {}) }}>
                    {cat.num}
                  </span>
                  <span style={st.categoryIcon}>{cat.icon}</span>
                </div>
                <div style={{ textAlign: 'left', marginTop: '6px' }}>
                  <div style={{ ...st.categoryTitle, ...(isActive ? st.categoryTitleActive : {}) }}>
                    {cat.label}
                  </div>
                  <div style={{ ...st.categoryMetaBadge, ...(isActive ? st.categoryMetaBadgeActive : {}) }}>
                    {cat.badge}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================
          CATEGORY 1: TOTAL TENANTS (Point 1: "1- total tenents")
         ============================================================ */}
      {(activeTabSection === 'all' || activeTabSection === 'total_tenants') && (
        <div style={st.sectionCard}>
          <div style={st.sectionHeader}>
            <div>
              <div style={st.sectionBadgeRow}>
                <span style={st.categoryNumberPill}>Point 1</span>
                <h2 style={st.sectionHeading}>🏢 Total Tenants Directory</h2>
              </div>
              <p style={st.sectionSubHeading}>
                Complete list of registered store tenants on the platform, store codes, active status, and lifetime activity.
              </p>
            </div>
            <div style={st.badgeCountPill}>{tenants.length || Object.keys(tenantInfoMap).length} Total Stores</div>
          </div>

          {/* Quick Metrics for Category 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
            <div style={st.miniKpiCard}>
              <span style={st.miniKpiLabel}>REGISTERED TENANTS</span>
              <div style={st.miniKpiVal}>{tenants.length || Object.keys(tenantInfoMap).length}</div>
              <span style={st.miniKpiSub}>Total onboarded shops</span>
            </div>
            <div style={st.miniKpiCard}>
              <span style={st.miniKpiLabel}>ACTIVE TENANTS</span>
              <div style={{ ...st.miniKpiVal, color: '#059669' }}>
                {tenants.filter((t) => (t.status || 'ACTIVE').toUpperCase() === 'ACTIVE').length || tenants.length}
              </div>
              <span style={st.miniKpiSub}>Ready for order routing</span>
            </div>
            <div style={st.miniKpiCard}>
              <span style={st.miniKpiLabel}>ACTIVE ORDERS THIS PERIOD</span>
              <div style={st.miniKpiVal}>{analysis.totalActiveOrdersCount}</div>
              <span style={st.miniKpiSub}>Across all stores</span>
            </div>
            <div style={st.miniKpiCard}>
              <span style={st.miniKpiLabel}>TOTAL PLATFORM GROSS SALES</span>
              <div style={{ ...st.miniKpiVal, color: '#2563eb' }}>{formatCurrency(analysis.totalPlatformGrossSales)}</div>
              <span style={st.miniKpiSub}>Excluding cancelled</span>
            </div>
          </div>

          <div style={st.tableWrapper}>
            <table style={st.table}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={st.th}>#</th>
                  <th style={st.th}>Tenant Name</th>
                  <th style={st.th}>Store Code</th>
                  <th style={st.th}>Tenant ID</th>
                  <th style={st.th}>Email / Owner</th>
                  <th style={{ ...st.th, textAlign: 'center' }}>Total Orders</th>
                  <th style={{ ...st.th, textAlign: 'right' }}>Gross Sales</th>
                  <th style={{ ...st.th, textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {(tenants.length > 0 ? tenants : Object.keys(tenantInfoMap).map((k) => ({ id: k, ...tenantInfoMap[k] }))).map((t, idx) => {
                  const tId = t.id || t.tenantId || '';
                  const orderStat = analysis.tenantList.find((item) => item.tenantId === tId) || {};
                  return (
                    <tr key={tId || idx} style={st.tr}>
                      <td style={{ ...st.td, fontWeight: '700', color: '#64748b' }}>{idx + 1}</td>
                      <td style={st.td}>
                        <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px' }}>
                          🏪 {t.name || t.fullName || 'Tenant Store'}
                        </div>
                      </td>
                      <td style={st.td}>
                        <span style={st.tenantCodeTag}>{t.code || t.tenantCode || 'STORE'}</span>
                      </td>
                      <td style={{ ...st.td, fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
                        {tId ? `${tId.substring(0, 10)}...` : '—'}
                      </td>
                      <td style={{ ...st.td, color: '#475569', fontSize: '12.5px' }}>
                        {t.email || t.ownerEmail || 'admin@store.com'}
                      </td>
                      <td style={{ ...st.td, textAlign: 'center', fontWeight: '800' }}>
                        {orderStat.totalOrders || 0}
                      </td>
                      <td style={{ ...st.td, textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                        {formatCurrency(orderStat.grossSales || 0)}
                      </td>
                      <td style={{ ...st.td, textAlign: 'center' }}>
                        <span style={st.statusBadgeActive}>
                          {(t.status || 'ACTIVE').toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================
          CATEGORY 2: MOST PURCHASED PRODUCTS (Point 2: "2- how is most parches")
         ============================================================ */}
      {(activeTabSection === 'all' || activeTabSection === 'most_purchased') && (
        <div style={st.sectionCard}>
          <div style={st.sectionHeader}>
            <div>
              <div style={st.sectionBadgeRow}>
                <span style={st.categoryNumberPill}>Point 2</span>
                <h2 style={st.sectionHeading}>🔥 Most Purchased Products (Best Sellers)</h2>
              </div>
              <p style={st.sectionSubHeading}>
                Highest selling jewelry items across all tenant orders ranked strictly by quantity ordered.
              </p>
            </div>
            <div style={st.badgeCountPill}>{analysis.topPurchasedProducts.length} Unique Products</div>
          </div>

          {/* Top 3 Best Seller Podium */}
          <div style={st.podiumGrid}>
            {analysis.topPurchasedProducts.slice(0, 3).map((prod, idx) => {
              const medals = ['🥇 #1 Best Seller', '🥈 #2 Runner-Up', '🥉 #3 Third Place'];
              const borders = ['#fde68a', '#e2e8f0', '#fed7aa'];
              const bgs = ['#fffbeb', '#f8fafc', '#fff7ed'];
              return (
                <div
                  key={prod.code}
                  style={{
                    ...st.podiumCard,
                    backgroundColor: bgs[idx] || '#ffffff',
                    border: `1.5px solid ${borders[idx] || '#e2e8f0'}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={st.podiumBadge}>{medals[idx]}</span>
                    <span style={st.orderCountBadge}>{prod.totalUnitsPurchased} Units Sold</span>
                  </div>
                  <h3 style={st.podiumTenantName}>{prod.name}</h3>
                  <div style={{ fontSize: '11.5px', fontFamily: 'monospace', color: '#64748b' }}>
                    Code: <strong>{prod.code}</strong>
                  </div>
                  <div style={st.podiumMetrics}>
                    <div>
                      <span style={st.podiumMetricLabel}>Orders Count</span>
                      <div style={st.podiumMetricVal}>{prod.ordersCount} Orders</div>
                    </div>
                    <div>
                      <span style={{ ...st.podiumMetricLabel, color: '#059669' }}>Total Revenue</span>
                      <div style={{ ...st.podiumMetricVal, color: '#059669' }}>
                        {formatCurrency(prod.totalRevenue)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={st.tableWrapper}>
            <table style={st.table}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={st.th}>Rank</th>
                  <th style={st.th}>Product Code</th>
                  <th style={st.th}>Product Title</th>
                  <th style={{ ...st.th, textAlign: 'center' }}>Total Units Purchased</th>
                  <th style={{ ...st.th, textAlign: 'center' }}>Orders Count</th>
                  <th style={{ ...st.th, textAlign: 'right' }}>Total Revenue Generated</th>
                </tr>
              </thead>
              <tbody>
                {analysis.topPurchasedProducts.slice(0, 50).map((prod, idx) => (
                  <tr key={prod.code} style={st.tr}>
                    <td style={{ ...st.td, fontWeight: '700', color: '#64748b' }}>
                      {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                    </td>
                    <td style={st.td}>
                      <span style={st.productCodeTag}>{prod.code}</span>
                    </td>
                    <td style={{ ...st.td, fontWeight: '600', color: '#0f172a' }}>{prod.name}</td>
                    <td style={{ ...st.td, textAlign: 'center' }}>
                      <span style={st.qtyPill}>{prod.totalUnitsPurchased} units</span>
                    </td>
                    <td style={{ ...st.td, textAlign: 'center', color: '#64748b' }}>{prod.ordersCount}</td>
                    <td style={{ ...st.td, textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                      {formatCurrency(prod.totalRevenue)}
                    </td>
                  </tr>
                ))}
                {analysis.topPurchasedProducts.length === 0 && (
                  <tr>
                    <td colSpan="6" style={st.tdEmpty}>
                      No product purchase data recorded in this date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================
          CATEGORY 3: TENANT ORDERS & APLA PROFIT (Point 3)
         ============================================================ */}
      {(activeTabSection === 'all' || activeTabSection === 'tenant_profit') && (
        <div style={st.sectionCard}>
          <div style={st.sectionHeader}>
            <div>
              <div style={st.sectionBadgeRow}>
                <span style={st.categoryNumberPill}>Point 3</span>
                <h2 style={st.sectionHeading}>💰 Tenant Orders, Order Amounts & Apla Profit</h2>
              </div>
              <p style={st.sectionSubHeading}>
                kontya tenent chi kiti order ahe, gross sales amount kiti ahe, wholesale base cost kiti ahe, ani apla profit (Admin Net Profit) kiti ahe.
              </p>
            </div>
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search tenant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={st.searchInput}
            />
          </div>

          {/* Quick Metrics for Category 3 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '16px' }}>
            <div style={st.miniKpiCard}>
              <span style={st.miniKpiLabel}>TOTAL ACTIVE ORDERS</span>
              <div style={st.miniKpiVal}>{analysis.totalActiveOrdersCount} Orders</div>
              <span style={st.miniKpiSub}>Customer orders fulfilled</span>
            </div>
            <div style={st.miniKpiCard}>
              <span style={st.miniKpiLabel}>GROSS SALES AMOUNT</span>
              <div style={{ ...st.miniKpiVal, color: '#2563eb' }}>{formatCurrency(analysis.totalPlatformGrossSales)}</div>
              <span style={st.miniKpiSub}>Total customer price</span>
            </div>
            <div style={st.miniKpiCard}>
              <span style={st.miniKpiLabel}>WHOLESALE BASE COST</span>
              <div style={st.miniKpiVal}>{formatCurrency(analysis.totalPlatformBaseCost)}</div>
              <span style={st.miniKpiSub}>Wholesale platform base</span>
            </div>
            <div style={{ ...st.miniKpiCard, border: '1.5px solid #a7f3d0', backgroundColor: '#f0fdf4' }}>
              <span style={{ ...st.miniKpiLabel, color: '#059669' }}>APLA PROFIT (ADMIN NET PROFIT)</span>
              <div style={{ ...st.miniKpiVal, color: '#059669' }}>{formatCurrency(analysis.totalPlatformAdminProfit)}</div>
              <span style={st.miniKpiSub}>Net earned margin</span>
            </div>
          </div>

          <div style={st.tableWrapper}>
            <table style={st.table}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={st.th}>Rank</th>
                  <th style={st.th}>Tenant Name & Code</th>
                  <th style={{ ...st.th, textAlign: 'center' }}>Total Orders</th>
                  <th style={{ ...st.th, textAlign: 'center' }}>Active Orders</th>
                  <th style={{ ...st.th, textAlign: 'right' }}>Total Order Amount (Gross)</th>
                  <th style={{ ...st.th, textAlign: 'right' }}>Wholesale Base Cost</th>
                  <th style={{ ...st.th, textAlign: 'right', color: '#059669' }}>Apla Profit (Net Margin)</th>
                  <th style={{ ...st.th, textAlign: 'center' }}>Profit Margin %</th>
                </tr>
              </thead>
              <tbody>
                {displayedTenants.map((t, idx) => {
                  const marginPct = t.grossSales > 0 ? ((t.adminProfit / t.grossSales) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={t.tenantId} style={st.tr}>
                      <td style={{ ...st.td, fontWeight: '700', color: '#64748b' }}>#{idx + 1}</td>
                      <td style={st.td}>
                        <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px' }}>
                          🏪 {t.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          {t.code && <span style={st.tenantCodeTag}>{t.code}</span>}
                          <span style={{ fontSize: '10.5px', color: '#94a3b8', fontFamily: 'monospace' }}>
                            {t.tenantId.substring(0, 8)}...
                          </span>
                        </div>
                      </td>
                      <td style={{ ...st.td, textAlign: 'center', fontWeight: '800' }}>{t.totalOrders}</td>
                      <td style={{ ...st.td, textAlign: 'center', color: '#059669', fontWeight: '700' }}>
                        {t.activeOrders}
                      </td>
                      <td style={{ ...st.td, textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                        {formatCurrency(t.grossSales)}
                      </td>
                      <td style={{ ...st.td, textAlign: 'right', color: '#475569' }}>
                        {formatCurrency(t.basePricePayable)}
                      </td>
                      <td style={{ ...st.td, textAlign: 'right' }}>
                        <span style={st.profitBadge}>{formatCurrency(t.adminProfit)}</span>
                      </td>
                      <td style={{ ...st.td, textAlign: 'center' }}>
                        <span style={st.marginPercentPill}>{marginPct}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================
          CATEGORY 4: TENANT PAID & PENDING (Point 4)
         ============================================================ */}
      {(activeTabSection === 'all' || activeTabSection === 'payment_status') && (
        <div style={st.sectionCard}>
          <div style={st.sectionHeader}>
            <div>
              <div style={st.sectionBadgeRow}>
                <span style={st.categoryNumberPill}>Point 4</span>
                <h2 style={st.sectionHeading}>💳 Tenant Payments Status (Amount Paid vs Pending)</h2>
              </div>
              <p style={st.sectionSubHeading}>
                tenent kiti payment dela ahe ani kiti payment pending ahe - Wholesale reconciliation & balance tracking.
              </p>
            </div>
            <div style={st.badgeCountPill}>
              Pending: {formatCurrency(analysis.totalAdminAmountPending)}
            </div>
          </div>

          {/* Quick Metrics for Category 4 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '16px' }}>
            <div style={st.miniKpiCard}>
              <span style={st.miniKpiLabel}>TOTAL WHOLESALE PAYABLE</span>
              <div style={st.miniKpiVal}>{formatCurrency(analysis.totalPlatformBaseCost)}</div>
              <span style={st.miniKpiSub}>Base price due to admin</span>
            </div>
            <div style={{ ...st.miniKpiCard, border: '1.5px solid #a7f3d0' }}>
              <span style={{ ...st.miniKpiLabel, color: '#059669' }}>AMOUNT PAID BY TENANTS</span>
              <div style={{ ...st.miniKpiVal, color: '#059669' }}>{formatCurrency(analysis.totalAdminAmountReceived)}</div>
              <span style={st.miniKpiSub}>Settled into platform</span>
            </div>
            <div style={{ ...st.miniKpiCard, border: analysis.totalAdminAmountPending > 0 ? '1.5px solid #fde68a' : '1px solid #e2e8f0' }}>
              <span style={{ ...st.miniKpiLabel, color: analysis.totalAdminAmountPending > 0 ? '#b89620' : '#10b981' }}>REMAINING PENDING BALANCE</span>
              <div style={{ ...st.miniKpiVal, color: analysis.totalAdminAmountPending > 0 ? '#b89620' : '#10b981' }}>
                {formatCurrency(analysis.totalAdminAmountPending)}
              </div>
              <span style={st.miniKpiSub}>Outstanding tenant obligations</span>
            </div>
          </div>

          <div style={st.tableWrapper}>
            <table style={st.table}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={st.th}>Tenant Name & Code</th>
                  <th style={{ ...st.th, textAlign: 'right' }}>Wholesale Payable</th>
                  <th style={{ ...st.th, textAlign: 'right', color: '#059669' }}>Amount Paid (Dela Ahe)</th>
                  <th style={{ ...st.th, textAlign: 'right', color: '#b89620' }}>Pending Payment (Pending Ahe)</th>
                  <th style={{ ...st.th, width: '180px' }}>Settlement Progress</th>
                  <th style={{ ...st.th, textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayedTenants.map((t) => {
                  const pct = t.basePricePayable > 0 ? Math.min(100, Math.round((t.amountPaid / t.basePricePayable) * 100)) : 100;
                  return (
                    <tr key={t.tenantId} style={st.tr}>
                      <td style={st.td}>
                        <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px' }}>
                          🏪 {t.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          {t.code && <span style={st.tenantCodeTag}>{t.code}</span>}
                          <span style={{ fontSize: '10.5px', color: '#94a3b8', fontFamily: 'monospace' }}>
                            {t.tenantId.substring(0, 8)}...
                          </span>
                        </div>
                      </td>
                      <td style={{ ...st.td, textAlign: 'right', fontWeight: '700', color: '#475569' }}>
                        {formatCurrency(t.basePricePayable)}
                      </td>
                      <td style={{ ...st.td, textAlign: 'right', fontWeight: '800', color: '#059669', fontSize: '13.5px' }}>
                        {formatCurrency(t.amountPaid)}
                      </td>
                      <td style={{ ...st.td, textAlign: 'right', fontWeight: '800', color: t.remainingPending > 0 ? '#b89620' : '#10b981', fontSize: '13.5px' }}>
                        {formatCurrency(t.remainingPending)}
                      </td>
                      <td style={st.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={st.progressBarTrack}>
                            <div style={{ ...st.progressBarFill, width: `${pct}%`, backgroundColor: pct >= 100 ? '#10b981' : '#b89620' }} />
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{ ...st.td, textAlign: 'center' }}>
                        <span
                          style={{
                            ...st.settlementBadge,
                            ...(t.remainingPending <= 0 && t.basePricePayable > 0
                              ? st.settlementPaid
                              : t.remainingPending > 0
                              ? st.settlementPending
                              : st.settlementNeutral)
                          }}
                        >
                          {t.remainingPending <= 0 && t.basePricePayable > 0
                            ? '✓ Settled'
                            : t.remainingPending > 0
                            ? '⏳ Pending'
                            : 'No Orders'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================
          CATEGORY 5: TRANSACTIONS & TOP TENANTS BY ORDERS (Point 5)
         ============================================================ */}
      {(activeTabSection === 'all' || activeTabSection === 'transactions_top') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Sub-Section 5A: Top Tenants Leaderboard by Orders */}
          <div style={st.sectionCard}>
            <div style={st.sectionHeader}>
              <div>
                <div style={st.sectionBadgeRow}>
                  <span style={st.categoryNumberPill}>Point 5A</span>
                  <h2 style={st.sectionHeading}>🏆 Top Tenants Ranked As Per Orders</h2>
                </div>
                <p style={st.sectionSubHeading}>
                  top tenent show as per order - Leading platform tenants ranked strictly by order volume.
                </p>
              </div>
            </div>

            {/* Top 3 Podium Cards */}
            <div style={st.podiumGrid}>
              {analysis.topTenantsByOrders.slice(0, 3).map((tenant, idx) => {
                const medals = ['🥇 #1 Top Tenant', '🥈 #2 Runner-Up', '🥉 #3 Third Place'];
                const borders = ['#fde68a', '#e2e8f0', '#fed7aa'];
                const bgs = ['#fffbeb', '#f8fafc', '#fff7ed'];
                return (
                  <div
                    key={tenant.tenantId}
                    style={{
                      ...st.podiumCard,
                      backgroundColor: bgs[idx] || '#ffffff',
                      border: `1.5px solid ${borders[idx] || '#e2e8f0'}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={st.podiumBadge}>{medals[idx] || `#${idx + 1}`}</span>
                      <span style={st.orderCountBadge}>{tenant.totalOrders} Orders</span>
                    </div>
                    <h3 style={st.podiumTenantName}>{tenant.name}</h3>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Code: {tenant.code || 'N/A'}</div>

                    <div style={st.podiumMetrics}>
                      <div>
                        <span style={st.podiumMetricLabel}>Sales Amount</span>
                        <div style={st.podiumMetricVal}>{formatCurrency(tenant.grossSales)}</div>
                      </div>
                      <div>
                        <span style={{ ...st.podiumMetricLabel, color: '#059669' }}>Apla Profit</span>
                        <div style={{ ...st.podiumMetricVal, color: '#059669' }}>
                          {formatCurrency(tenant.adminProfit)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sub-Section 5B: Admin Transactions Log */}
          <div style={st.sectionCard}>
            <div style={st.sectionHeader}>
              <div>
                <div style={st.sectionBadgeRow}>
                  <span style={st.categoryNumberPill}>Point 5B</span>
                  <h2 style={st.sectionHeading}>💳 Admin Transactions Log (Who Paid When)</h2>
                </div>
                <p style={st.sectionSubHeading}>
                  transction koni kadhi paise dele ahe - Complete timestamped audit history of tenant payments received.
                </p>
              </div>
              <div style={st.badgeCountPill}>{filteredPayments.length} Transactions Recorded</div>
            </div>

            <div style={st.tableWrapper}>
              <table style={st.table}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <th style={st.th}>Transaction Ref</th>
                    <th style={st.th}>Date & Time (Kadhi Dele)</th>
                    <th style={st.th}>Tenant / Payer (Koni Dele)</th>
                    <th style={{ ...st.th, textAlign: 'right' }}>Amount Paid (Paise)</th>
                    <th style={st.th}>Type</th>
                    <th style={st.th}>Reference ID</th>
                    <th style={{ ...st.th, textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((p, idx) => {
                    const tId = p.tenantId || p.sellerId || '';
                    const tInfo = tenantInfoMap[tId] || {};
                    const isCompleted = (p.status || 'COMPLETED').toUpperCase() === 'COMPLETED';

                    return (
                      <tr key={p.id || idx} style={st.tr}>
                        <td style={st.td}>
                          <span style={st.txRefTag}>{p.transactionId || p.id || `TXN-${idx + 1}`}</span>
                        </td>
                        <td style={{ ...st.td, color: '#475569', fontSize: '12px', fontWeight: '600' }}>
                          🗓️ {formatDisplayDate(p.createdAt || p.date)}
                        </td>
                        <td style={st.td}>
                          <div style={{ fontWeight: '700', color: '#0f172a' }}>
                            {tInfo.name || p.tenantName || (tId ? `${tId.substring(0, 8)}...` : 'Tenant')}
                          </div>
                          {tInfo.code && <span style={st.tenantCodeTag}>{tInfo.code}</span>}
                        </td>
                        <td style={{ ...st.td, textAlign: 'right', fontWeight: '800', color: '#059669', fontSize: '13.5px' }}>
                          {formatCurrency(p.amount)}
                        </td>
                        <td style={st.td}>
                          <span style={st.badgeNeutral}>{p.type || 'SETTLEMENT'}</span>
                        </td>
                        <td style={{ ...st.td, color: '#64748b', fontFamily: 'monospace', fontSize: '11px' }}>
                          {p.referenceId || 'N/A'}
                        </td>
                        <td style={{ ...st.td, textAlign: 'center' }}>
                          <span
                            style={{
                              ...st.settlementBadge,
                              ...(isCompleted ? st.settlementPaid : st.settlementPending)
                            }}
                          >
                            {p.status || 'COMPLETED'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPayments.length === 0 && (
                    <tr>
                      <td colSpan="7" style={st.tdEmpty}>
                        No admin transactions recorded in this date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          CATEGORY 6: CANCELLED ORDERS (Point 6: "6- cancle order distin pan amount add naahi honar yanchi kuta")
         ============================================================ */}
      {(activeTabSection === 'all' || activeTabSection === 'cancelled_orders') && (
        <div style={st.sectionCard}>
          <div style={st.sectionHeader}>
            <div>
              <div style={st.sectionBadgeRow}>
                <span style={st.categoryNumberPill}>Point 6</span>
                <h2 style={st.sectionHeading}>❌ Cancelled Orders (Zero Financial Impact)</h2>
              </div>
              <p style={st.sectionSubHeading}>
                cancle order distin pan amount add naahi honar yanchi kuta - Tracked for audit transparency with ₹0.00 financial addition.
              </p>
            </div>
            <div style={{ ...st.badgeCountPill, backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }}>
              {analysis.totalCancelledOrdersCount} Cancelled Orders
            </div>
          </div>

          {/* Prominent Exclusion Notice Banner */}
          <div style={st.financialIsolationNotice}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>🛡️</span>
              <div>
                <strong style={{ fontSize: '13.5px', color: '#991b1b', display: 'block' }}>
                  Financial Isolation Rule Active:
                </strong>
                <span style={{ fontSize: '12.5px', color: '#7f1d1d' }}>
                  Total of {analysis.totalCancelledOrdersCount} cancelled orders worth <strong>{formatCurrency(analysis.totalCancelledExcludedAmount)}</strong> are listed here for complete audit history, but their monetary value is strictly <strong>NEVER ADDED</strong> to Gross Sales, Wholesale Base Cost, or Apla Profit totals.
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics for Category 6 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
            <div style={st.miniKpiCard}>
              <span style={st.miniKpiLabel}>CANCELLED ORDERS COUNT</span>
              <div style={{ ...st.miniKpiVal, color: '#dc2626' }}>{analysis.totalCancelledOrdersCount}</div>
              <span style={st.miniKpiSub}>Visible in audit trail</span>
            </div>
            <div style={st.miniKpiCard}>
              <span style={st.miniKpiLabel}>TOTAL EXCLUDED VALUE</span>
              <div style={{ ...st.miniKpiVal, color: '#dc2626', textDecoration: 'line-through' }}>
                {formatCurrency(analysis.totalCancelledExcludedAmount)}
              </div>
              <span style={st.miniKpiSub}>Excluded from platform reports</span>
            </div>
            <div style={{ ...st.miniKpiCard, backgroundColor: '#f0fdf4', border: '1.5px solid #a7f3d0' }}>
              <span style={{ ...st.miniKpiLabel, color: '#059669' }}>PLATFORM FINANCIAL IMPACT</span>
              <div style={{ ...st.miniKpiVal, color: '#059669' }}>₹0.00 (Zero Added)</div>
              <span style={st.miniKpiSub}>Strict financial isolation</span>
            </div>
            <div style={{ ...st.miniKpiCard, backgroundColor: '#eff6ff', border: '1.5px solid #bfdbfe' }}>
              <span style={{ ...st.miniKpiLabel, color: '#2563eb' }}>FIREBASE STOCK STATUS</span>
              <div style={{ ...st.miniKpiVal, color: '#2563eb', fontSize: '16px' }}>✓ Restored to Firestore</div>
              <span style={st.miniKpiSub}>Variants returned to inventory</span>
            </div>
          </div>

          <div style={st.tableWrapper}>
            <table style={st.table}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={st.th}>Order Number</th>
                  <th style={st.th}>Cancellation Date</th>
                  <th style={st.th}>Tenant Store</th>
                  <th style={st.th}>Customer</th>
                  <th style={st.th}>Items in Order</th>
                  <th style={{ ...st.th, textAlign: 'right' }}>Cancelled Amount</th>
                  <th style={{ ...st.th, textAlign: 'center' }}>Financial Inclusion</th>
                  <th style={{ ...st.th, textAlign: 'center' }}>Stock Status</th>
                </tr>
              </thead>
              <tbody>
                {analysis.cancelledOrdersList.map((o) => {
                  const tInfo = tenantInfoMap[o.tenantId] || {};
                  return (
                    <tr key={o.id} style={st.tr}>
                      <td style={st.td}>
                        <span style={{ ...st.codePill, backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>
                          #{o.orderNumber || o.id?.substring(0, 6)}
                        </span>
                      </td>
                      <td style={{ ...st.td, color: '#64748b', fontSize: '12px' }}>
                        {formatDisplayDate(o.updatedAt || o.createdAt)}
                      </td>
                      <td style={st.td}>
                        <div style={{ fontWeight: '700', color: '#0f172a' }}>
                          {tInfo.name || o.tenantName || 'Tenant Store'}
                        </div>
                        {tInfo.code && <span style={st.tenantCodeTag}>{tInfo.code}</span>}
                      </td>
                      <td style={st.td}>
                        <div style={{ fontWeight: '600', color: '#334155' }}>{o.customerName || 'Customer'}</div>
                        {o.phone && <div style={{ fontSize: '11px', color: '#64748b' }}>📞 {o.phone}</div>}
                      </td>
                      <td style={st.td}>
                        <div style={{ fontSize: '12px', color: '#475569' }}>
                          {(o.items || []).map((item, i) => (
                            <span key={i} style={{ display: 'inline-block', marginRight: '6px' }}>
                              {item.productName || item.productCode} × {item.quantity || 1}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ ...st.td, textAlign: 'right', fontWeight: '800', color: '#dc2626', textDecoration: 'line-through' }}>
                        {formatCurrency(o.totalSellingPrice || o.totalAmount || 0)}
                      </td>
                      <td style={{ ...st.td, textAlign: 'center' }}>
                        <span style={st.excludedZeroBadge}>
                          ⛔ ₹0.00 Added
                        </span>
                      </td>
                      <td style={{ ...st.td, textAlign: 'center' }}>
                        <span style={st.stockRestoredPill}>
                          ✓ Restored in Firebase
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {analysis.cancelledOrdersList.length === 0 && (
                  <tr>
                    <td colSpan="8" style={st.tdEmpty}>
                      No cancelled orders found in this date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================
          CATEGORY 7: STOCK RESTORATION ON CANCELLATION (Point 7)
         ============================================================ */}
      {(activeTabSection === 'all' || activeTabSection === 'stock_restoration') && (
        <div style={st.sectionCard}>
          <div style={st.sectionHeader}>
            <div>
              <div style={st.sectionBadgeRow}>
                <span style={st.categoryNumberPill}>Point 7</span>
                <h2 style={st.sectionHeading}>📦 Stock Restored to Firebase on Cancellation</h2>
              </div>
              <p style={st.sectionSubHeading}>
                cancel order keli ter firebase madhi tya product chi varient/quntity vadhli pahije - Automatic stock increment audit log.
              </p>
            </div>
            <div style={{ ...st.badgeCountPill, backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
              {analysis.restoredInventoryList.length} Items Restored
            </div>
          </div>

          {/* Explanation Card */}
          <div style={st.stockRestorationNotice}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>🔄</span>
              <div>
                <strong style={{ fontSize: '13.5px', color: '#065f46', display: 'block' }}>
                  Automatic Inventory Increment Active:
                </strong>
                <span style={{ fontSize: '12.5px', color: '#047857' }}>
                  Whenever any tenant order is marked <strong>Cancelled</strong>, our system searches the product in Firebase Firestore and automatically increments (+units) the exact matching <strong>Variant quantity and Product stock</strong> so that stock counts remain accurate without manual correction.
                </span>
              </div>
            </div>
          </div>

          <div style={st.tableWrapper}>
            <table style={st.table}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={st.th}>Order #</th>
                  <th style={st.th}>Timestamp</th>
                  <th style={st.th}>Tenant</th>
                  <th style={st.th}>Product Code & Name</th>
                  <th style={st.th}>Variant / Color</th>
                  <th style={st.th}>SKU</th>
                  <th style={{ ...st.th, textAlign: 'center' }}>Restored Qty</th>
                  <th style={{ ...st.th, textAlign: 'center' }}>Firebase Status</th>
                </tr>
              </thead>
              <tbody>
                {analysis.restoredInventoryList.map((item, idx) => (
                  <tr key={idx} style={st.tr}>
                    <td style={st.td}>
                      <span style={st.codePill}>#{item.orderNumber}</span>
                    </td>
                    <td style={{ ...st.td, color: '#64748b', fontSize: '12px' }}>
                      {formatDisplayDate(item.date)}
                    </td>
                    <td style={{ ...st.td, fontWeight: '700', color: '#0f172a' }}>
                      {item.tenantName}
                    </td>
                    <td style={st.td}>
                      <div style={{ fontWeight: '700', color: '#0f172a' }}>{item.productName}</div>
                      <span style={st.productCodeTag}>{item.productCode}</span>
                    </td>
                    <td style={st.td}>
                      <span style={st.badgeNeutral}>{item.variantName}</span>
                    </td>
                    <td style={{ ...st.td, fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
                      {item.sku}
                    </td>
                    <td style={{ ...st.td, textAlign: 'center' }}>
                      <span style={st.restoredQtyBadge}>
                        +{item.quantityRestored} Units
                      </span>
                    </td>
                    <td style={{ ...st.td, textAlign: 'center' }}>
                      <span style={st.stockRestoredPill}>
                        ✓ Stock Increased in Firebase
                      </span>
                    </td>
                  </tr>
                ))}
                {analysis.restoredInventoryList.length === 0 && (
                  <tr>
                    <td colSpan="8" style={st.tdEmpty}>
                      No cancelled order items requiring inventory restoration in this date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Embedded Animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const st = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#0f172a',
    width: '100%',
    boxSizing: 'border-box'
  },
  headerBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px',
    backgroundColor: '#ffffff',
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
    padding: '20px 24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
  },
  headerIconBadge: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    backgroundColor: '#fef3c7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  headerTitle: {
    margin: '0 0 4px 0',
    fontSize: '20px',
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: '-0.02em'
  },
  headerSubtitle: {
    margin: 0,
    fontSize: '13px',
    color: '#64748b'
  },
  controlCluster: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap'
  },
  presetGroup: {
    display: 'flex',
    backgroundColor: '#f1f5f9',
    borderRadius: '8px',
    padding: '3px'
  },
  presetBtn: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#64748b',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s'
  },
  presetBtnActive: {
    backgroundColor: '#ffffff',
    color: '#0f172a',
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
  },
  dateInput: {
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '12px',
    backgroundColor: '#ffffff',
    outline: 'none'
  },
  btnRefresh: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 14px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#334155',
    fontSize: '12.5px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  btnExport: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 16px',
    borderRadius: '8px',
    border: '1px solid #b89620',
    backgroundColor: '#b89620',
    color: '#ffffff',
    fontSize: '12.5px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(184, 150, 32, 0.2)'
  },
  timestampRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#64748b',
    marginTop: '-8px'
  },
  liveDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)'
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
    gap: '16px'
  },
  kpiCard: {
    backgroundColor: '#ffffff',
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
  },
  kpiTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  kpiLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  kpiIcon: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px'
  },
  kpiVal: {
    fontSize: '26px',
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: '-0.02em',
    marginBottom: '4px'
  },
  kpiSub: {
    fontSize: '12px',
    color: '#94a3b8'
  },
  cancelledBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
    padding: '12px 18px',
    borderRadius: '10px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca'
  },
  cancelledPill: {
    padding: '2px 8px',
    borderRadius: '12px',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    fontWeight: '700',
    fontSize: '11.5px',
    border: '1px solid #fca5a5'
  },
  subNavBar: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '2px'
  },
  subNavBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid transparent',
    backgroundColor: '#ffffff',
    color: '#64748b',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  subNavBtnActive: {
    backgroundColor: '#fef3c7',
    color: '#b89620',
    border: '1px solid #fde68a'
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    padding: '22px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '14px',
    marginBottom: '18px',
    paddingBottom: '14px',
    borderBottom: '1px solid #f1f5f9'
  },
  sectionHeading: {
    margin: '0 0 4px 0',
    fontSize: '17px',
    fontWeight: '700',
    color: '#0f172a'
  },
  sectionSubHeading: {
    margin: 0,
    fontSize: '12.5px',
    color: '#64748b'
  },
  searchInput: {
    padding: '7px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '12.5px',
    outline: 'none',
    width: '220px'
  },
  podiumGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '16px',
    marginBottom: '16px'
  },
  podiumCard: {
    borderRadius: '12px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
  },
  podiumBadge: {
    fontSize: '12px',
    fontWeight: '800',
    color: '#b89620'
  },
  orderCountBadge: {
    padding: '2px 8px',
    borderRadius: '12px',
    backgroundColor: '#0f172a',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: '700'
  },
  podiumTenantName: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '800',
    color: '#0f172a'
  },
  podiumMetrics: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingTop: '10px',
    borderTop: '1px solid rgba(0,0,0,0.06)'
  },
  podiumMetricLabel: {
    fontSize: '10.5px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase'
  },
  podiumMetricVal: {
    fontSize: '15px',
    fontWeight: '800',
    color: '#0f172a'
  },
  tableWrapper: {
    overflowX: 'auto',
    borderRadius: '10px',
    border: '1px solid #e2e8f0'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    textAlign: 'left'
  },
  th: {
    padding: '12px 14px',
    fontSize: '11.5px',
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid #e2e8f0',
    whiteSpace: 'nowrap'
  },
  td: {
    padding: '12px 14px',
    borderBottom: '1px solid #f1f5f9',
    color: '#334155',
    verticalAlign: 'middle'
  },
  tr: {
    backgroundColor: '#ffffff'
  },
  tdEmpty: {
    padding: '40px 16px',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '13px'
  },
  tenantCodeTag: {
    fontSize: '10px',
    padding: '1px 5px',
    borderRadius: '4px',
    backgroundColor: '#fef3c7',
    color: '#b89620',
    fontWeight: '700',
    border: '1px solid #fde68a'
  },
  productCodeTag: {
    fontFamily: 'monospace',
    fontWeight: '700',
    color: '#0f172a',
    backgroundColor: '#f1f5f9',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '11.5px'
  },
  qtyPill: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '12px',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: '11.5px'
  },
  profitBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: '6px',
    backgroundColor: '#ecfdf5',
    color: '#059669',
    fontWeight: '700',
    fontSize: '12px',
    border: '1px solid #a7f3d0'
  },
  settlementBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '700'
  },
  settlementPaid: {
    backgroundColor: '#ecfdf5',
    color: '#059669',
    border: '1px solid #a7f3d0'
  },
  settlementPending: {
    backgroundColor: '#fffbeb',
    color: '#d97706',
    border: '1px solid #fde68a'
  },
  settlementNeutral: {
    backgroundColor: '#f1f5f9',
    color: '#64748b'
  },
  txRefTag: {
    fontFamily: 'monospace',
    fontSize: '11.5px',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#0f172a'
  },
  badgeNeutral: {
    fontSize: '11px',
    fontWeight: '600',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: '#f1f5f9',
    color: '#475569'
  },
  // --- Category Nav & Module Styles ---
  categoryNavContainer: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    padding: '18px 20px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
  },
  categoryHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '14px',
    paddingBottom: '10px',
    borderBottom: '1px solid #f1f5f9'
  },
  categoryHeadingText: {
    fontSize: '11.5px',
    fontWeight: '800',
    color: '#475569',
    letterSpacing: '0.06em',
    textTransform: 'uppercase'
  },
  categoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '10px'
  },
  categoryCardBtn: {
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1.5px solid #e2e8f0',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 0.18s ease-in-out',
    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
    outline: 'none'
  },
  categoryCardBtnActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
    boxShadow: '0 4px 14px rgba(15, 23, 42, 0.18)',
    transform: 'translateY(-1px)'
  },
  categoryNumBadge: {
    width: '22px',
    height: '22px',
    borderRadius: '6px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    fontSize: '11px',
    fontWeight: '800',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  categoryNumBadgeActive: {
    backgroundColor: '#b89620',
    color: '#ffffff'
  },
  categoryIcon: {
    fontSize: '18px'
  },
  categoryTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#1e293b',
    lineHeight: 1.25,
    marginTop: '6px'
  },
  categoryTitleActive: {
    color: '#ffffff'
  },
  categoryMetaBadge: {
    fontSize: '10.5px',
    fontWeight: '600',
    color: '#64748b',
    marginTop: '4px'
  },
  categoryMetaBadgeActive: {
    color: '#cbd5e1'
  },
  sectionBadgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px'
  },
  categoryNumberPill: {
    padding: '2px 8px',
    borderRadius: '6px',
    backgroundColor: '#fef3c7',
    color: '#b89620',
    border: '1px solid #fde68a',
    fontSize: '11px',
    fontWeight: '800',
    letterSpacing: '0.04em',
    textTransform: 'uppercase'
  },
  badgeCountPill: {
    padding: '4px 12px',
    borderRadius: '16px',
    backgroundColor: '#f1f5f9',
    color: '#334155',
    border: '1px solid #e2e8f0',
    fontSize: '12px',
    fontWeight: '700'
  },
  miniKpiCard: {
    backgroundColor: '#f8fafc',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  miniKpiLabel: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  },
  miniKpiVal: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#0f172a'
  },
  miniKpiSub: {
    fontSize: '11px',
    color: '#94a3b8'
  },
  statusBadgeActive: {
    padding: '3px 10px',
    borderRadius: '12px',
    backgroundColor: '#ecfdf5',
    color: '#059669',
    border: '1px solid #a7f3d0',
    fontSize: '11px',
    fontWeight: '700'
  },
  marginPercentPill: {
    padding: '2px 8px',
    borderRadius: '12px',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    fontSize: '11.5px',
    fontWeight: '700'
  },
  progressBarTrack: {
    flex: 1,
    height: '6px',
    borderRadius: '3px',
    backgroundColor: '#e2e8f0',
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease'
  },
  financialIsolationNotice: {
    backgroundColor: '#fef2f2',
    border: '1.5px solid #fecaca',
    borderRadius: '12px',
    padding: '14px 18px',
    marginBottom: '16px'
  },
  stockRestorationNotice: {
    backgroundColor: '#ecfdf5',
    border: '1.5px solid #a7f3d0',
    borderRadius: '12px',
    padding: '14px 18px',
    marginBottom: '16px'
  },
  restoredQtyBadge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '12px',
    backgroundColor: '#ecfdf5',
    color: '#059669',
    border: '1px solid #a7f3d0',
    fontSize: '12px',
    fontWeight: '800'
  },
  stockRestoredPill: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '12px',
    backgroundColor: '#eff6ff',
    color: '#2563eb',
    border: '1px solid #bfdbfe',
    fontSize: '11.5px',
    fontWeight: '700'
  },
  excludedZeroBadge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '12px',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    border: '1px solid #fca5a5',
    fontSize: '11.5px',
    fontWeight: '800'
  },
  codePill: {
    fontFamily: 'monospace',
    fontWeight: '700',
    fontSize: '11.5px',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: '#f1f5f9',
    color: '#0f172a'
  }
};
