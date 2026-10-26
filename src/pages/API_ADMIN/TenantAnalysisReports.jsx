import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getIdToken, API_BASE, apiFetch } from './adminAuth';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

// Chart palette matching KIYUZYU design system
const STATUS_COLORS = {
  PAID: '#10b981',
  'Payment Done': '#10b981',
  COMPLETED: '#10b981',
  PENDING: '#f59e0b',
  'Pending Payment': '#f59e0b',
  FAILED: '#ef4444',
  Cancelled: '#ef4444',
  REFUNDED: '#6366f1',
  COD: '#8b5cf6',
  'Ready to Dispatch': '#8b5cf6',
  Dispatched: '#06b6d4',
  Delivered: '#059669',
  OTHER: '#94a3b8'
};

const PIE_COLORS = ['#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444', '#3b82f6'];

export default function TenantAnalysisReports({ tenantId, tenantProfile }) {
  // State
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Filters
  const [dateRangePreset, setDateRangePreset] = useState('all'); // 'all', 'today', 'week', 'month', 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [activeReportSection, setActiveReportSection] = useState('all'); // 'all', 'sales', 'daily', 'payable', 'transactions', 'activity'
  const [activitySearchQuery, setActivitySearchQuery] = useState('');
  const [activityCategoryFilter, setActivityCategoryFilter] = useState('ALL');

  // Compute effective start and end dates
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
      return {
        startDateStr: customStartDate || '',
        endDateStr: customEndDate || ''
      };
    }
    return { startDateStr: '', endDateStr: '' };
  }, [dateRangePreset, customStartDate, customEndDate]);

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

  // Fallback calculation directly from Firestore for 100% reliability
  const computeReportsFromFirestore = useCallback(async (tId, startStr, endStr) => {
    try {
      const tenantIds = [tId];
      if (tId && tId !== 'g0usC1NMyehaoSKJRhOqUUhZAO62') {
        tenantIds.push('g0usC1NMyehaoSKJRhOqUUhZAO62');
      }

      const ordersQ = query(
        collection(db, 'apiTenantOrders'),
        where('tenantId', 'in', tenantIds)
      );
      const ordersSnap = await getDocs(ordersQ);
      const allOrders = [];
      ordersSnap.forEach((d) => allOrders.push({ id: d.id, ...d.data() }));

      // Query admin payments
      const adminPayments = [];
      try {
        const pmQ = query(collection(db, 'adminPayments'), where('tenantId', '==', tId));
        const pmSnap = await getDocs(pmQ);
        pmSnap.forEach((d) => adminPayments.push({ id: d.id, ...d.data() }));
      } catch (e) {
        // Fallback or empty if none yet
      }

      // Filter orders by date range
      const orders = allOrders.filter((o) => {
        if (!startStr && !endStr) return true;
        const dStr = parseToDateString(o.createdAt || o.orderDate);
        if (!dStr) return true;
        if (startStr && dStr < startStr) return false;
        if (endStr && dStr > endStr) return false;
        return true;
      });

      let totalSales = 0;
      let totalReceived = 0;
      let pendingPayments = 0;
      let successfulCount = 0;
      let successfulAmount = 0;
      let failedCount = 0;
      let failedAmount = 0;
      let totalBasePrice = 0;
      const statusMap = {};

      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;

      let todayOrderAmount = 0;
      let todayCollected = 0;
      let todayPending = 0;
      let todayCount = 0;
      let yesterdayAmount = 0;
      let yesterdayCount = 0;

      const dailySummaryMap = {};

      orders.forEach((o) => {
        const status = o.status || 'Pending Payment';
        statusMap[status] = (statusMap[status] || 0) + 1;
        const selling = Number(o.totalSellingPrice || o.totalAmount || 0);
        const base = Number(o.totalBasePrice || 0);
        const isCancelled = status.toLowerCase().includes('cancel') || status.toLowerCase().includes('fail');
        const isPaid = status === 'Payment Done' || status === 'Ready to Dispatch' || status === 'Dispatched' || status === 'Delivered';
        const isPending = status === 'Pending Payment' || status === 'NEW';

        const orderDateStr = parseToDateString(o.createdAt || o.orderDate);

        if (!isCancelled) {
          totalSales += selling;
          totalBasePrice += base;
        }

        if (isPaid) {
          totalReceived += selling;
          successfulCount++;
          successfulAmount += selling;
        } else if (isPending) {
          pendingPayments += selling;
        } else if (isCancelled) {
          failedCount++;
          failedAmount += selling;
        }

        if (orderDateStr === todayStr) {
          todayCount++;
          if (!isCancelled) todayOrderAmount += selling;
          if (isPaid) todayCollected += selling;
          if (isPending) todayPending += selling;
        } else if (orderDateStr === yesterdayStr) {
          yesterdayCount++;
          if (!isCancelled) yesterdayAmount += selling;
        }

        if (orderDateStr) {
          if (!dailySummaryMap[orderDateStr]) {
            dailySummaryMap[orderDateStr] = { label: orderDateStr, salesAmount: 0, receivedAmount: 0, ordersCount: 0 };
          }
          if (!isCancelled) dailySummaryMap[orderDateStr].salesAmount += selling;
          if (isPaid) dailySummaryMap[orderDateStr].receivedAmount += selling;
          dailySummaryMap[orderDateStr].ordersCount += 1;
        }
      });

      let amountPaid = 0;
      let totalCompletedTx = 0;
      let totalPendingTx = 0;
      let totalFailedTx = 0;
      let completedTxAmount = 0;

      const transactions = adminPayments.map((p) => {
        const amt = Number(p.amount || 0);
        const st = (p.status || 'COMPLETED').toUpperCase();
        if (st === 'COMPLETED') {
          amountPaid += amt;
          totalCompletedTx++;
          completedTxAmount += amt;
        } else if (st === 'PENDING') {
          totalPendingTx++;
        } else {
          totalFailedTx++;
        }
        return {
          transactionId: p.transactionId || p.id,
          date: p.createdAt || '',
          amount: amt,
          type: p.type || 'PAYMENT',
          status: st,
          referenceId: p.referenceId || '',
          note: p.note || ''
        };
      });

      const remainingPayable = Math.max(0, totalBasePrice - amountPaid);
      const amountChange = yesterdayAmount > 0 ? ((todayOrderAmount - yesterdayAmount) / yesterdayAmount) * 100 : (todayOrderAmount > 0 ? 100 : 0);
      const ordersChange = yesterdayCount > 0 ? ((todayCount - yesterdayCount) / yesterdayCount) * 100 : (todayCount > 0 ? 100 : 0);

      const activityLogsList = [];
      orders.slice(0, 15).forEach((o) => {
        activityLogsList.push({
          id: o.id,
          timestamp: o.createdAt || '',
          user: o.customerName || 'Store Customer',
          action: `Order ${o.status || 'Created'}`,
          entityId: o.orderNumber || o.id,
          entityType: 'ORDER',
          result: o.status === 'Cancelled' ? 'FAILED' : 'SUCCESS',
          details: `Order total: ₹${Number(o.totalSellingPrice || 0).toFixed(2)}`
        });
      });

      const dailySummaryList = Object.values(dailySummaryMap).sort((a, b) => a.label.localeCompare(b.label));

      return {
        tenantId: tId,
        currency: 'INR',
        generatedAt: new Date().toISOString(),
        salesReport: {
          totalSalesAmount: totalSales,
          totalPaymentsReceived: totalReceived,
          pendingPayments,
          successfulPaymentsCount: successfulCount,
          successfulPaymentsAmount: successfulAmount,
          failedPaymentsCount: failedCount,
          failedPaymentsAmount: failedAmount,
          dailySummary: dailySummaryList,
          weeklySummary: [],
          monthlySummary: [],
          paymentStatusBreakdown: statusMap
        },
        dailyAmountReport: {
          todayOrderAmount,
          todayCollectedAmount: todayCollected,
          todayPendingAmount: todayPending,
          todayOrderCount: todayCount,
          previousDayOrderAmount: yesterdayAmount,
          amountChangePercentage: amountChange,
          ordersChangePercentage: ordersChange
        },
        adminPayableReport: {
          totalPayableToAdmin: totalBasePrice,
          amountAlreadyPaid: amountPaid,
          remainingPayableAmount: remainingPayable,
          paymentHistory: transactions
        },
        adminTransactionReport: {
          transactions,
          totalCompleted: totalCompletedTx,
          totalPending: totalPendingTx,
          totalFailed: totalFailedTx,
          totalCompletedAmount: completedTxAmount
        },
        activityLogs: {
          logs: activityLogsList
        }
      };
    } catch (err) {
      console.warn('Firestore fallback calculation note:', err);
      return null;
    }
  }, []);

  // Fetch report data: first from Spring Boot API; if unavailable, fallback to direct Firestore calculation
  const fetchReport = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    let loadedSuccessfully = false;

    try {
      const token = await getIdToken();
      const params = new URLSearchParams();
      if (startDateStr) params.append('startDate', startDateStr);
      if (endDateStr) params.append('endDate', endDateStr);

      const url = `${API_BASE}/api/v1/tenants/me/reports/analysis${params.toString() ? '?' + params.toString() : ''}`;
      const res = await apiFetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setReportData(json.data);
          setLastUpdated(new Date());
          setError('');
          loadedSuccessfully = true;
        }
      }
    } catch (err) {
      console.warn('Backend API reports request:', err.message);
    }

    // Seamless fallback to Firestore calculations if API response was unavailable
    if (!loadedSuccessfully) {
      try {
        const effectiveTId = tenantId || tenantProfile?.tenantId;
        const fallbackData = await computeReportsFromFirestore(effectiveTId, startDateStr, endDateStr);
        if (fallbackData) {
          setReportData(fallbackData);
          setLastUpdated(new Date());
          setError('');
          loadedSuccessfully = true;
        }
      } catch (fallbackErr) {
        console.error('Fallback calculation failed:', fallbackErr);
      }
    }

    if (!loadedSuccessfully) {
      setError('Unable to load reports. Please click retry or check your network connection.');
    }

    setLoading(false);
    setRefreshing(false);
  }, [startDateStr, endDateStr, tenantId, tenantProfile, computeReportsFromFirestore]);

  // Initial and reactive fetch on filter change
  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Real-time Firestore listener on `apiTenantOrders` to trigger refresh when orders update
  useEffect(() => {
    if (!tenantId) return;

    let unsub;
    try {
      const ordersQ = query(
        collection(db, 'apiTenantOrders'),
        where('tenantId', 'in', [tenantId, 'g0usC1NMyehaoSKJRhOqUUhZAO62'])
      );
      unsub = onSnapshot(
        ordersQ,
        () => {
          // Quietly refresh backend aggregated data when changes occur in Firestore
          fetchReport(true);
        },
        (err) => {
          console.warn('Real-time listener notice:', err.message);
        }
      );
    } catch (e) {
      console.warn('Snapshot listener skipped:', e);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [tenantId, fetchReport]);

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

  // CSV Export handler
  const handleExportCSV = () => {
    if (!reportData) return;

    const rows = [];
    rows.push(['KIYUZIYU TENANT ANALYSIS REPORT']);
    rows.push(['Tenant ID', reportData.tenantId || tenantId || '—']);
    rows.push(['Date Range', `${startDateStr || 'All Time'} to ${endDateStr || 'Now'}`]);
    rows.push(['Generated At', new Date().toLocaleString()]);
    rows.push([]);

    // Sales Report Section
    rows.push(['--- PAYMENT & SALES REPORT ---']);
    rows.push(['Metric', 'Value']);
    rows.push(['Total Sales Amount (Gross)', reportData.salesReport?.totalSalesAmount || 0]);
    rows.push(['Total Payments Received', reportData.salesReport?.totalPaymentsReceived || 0]);
    rows.push(['Pending Payments', reportData.salesReport?.pendingPayments || 0]);
    rows.push(['Successful Payments Count', reportData.salesReport?.successfulPaymentsCount || 0]);
    rows.push(['Successful Payments Amount', reportData.salesReport?.successfulPaymentsAmount || 0]);
    rows.push(['Failed Payments Count', reportData.salesReport?.failedPaymentsCount || 0]);
    rows.push(['Failed Payments Amount', reportData.salesReport?.failedPaymentsAmount || 0]);
    rows.push([]);

    // Daily Amount Section
    rows.push(['--- DAILY AMOUNT REPORT ---']);
    rows.push(['Today Order Amount', reportData.dailyAmountReport?.todayOrderAmount || 0]);
    rows.push(['Today Amount Collected', reportData.dailyAmountReport?.todayCollectedAmount || 0]);
    rows.push(['Today Pending Amount', reportData.dailyAmountReport?.todayPendingAmount || 0]);
    rows.push(['Today Order Count', reportData.dailyAmountReport?.todayOrderCount || 0]);
    rows.push(['Previous Day Order Amount', reportData.dailyAmountReport?.previousDayOrderAmount || 0]);
    rows.push(['Amount Change (%)', reportData.dailyAmountReport?.amountChangePercentage || 0]);
    rows.push([]);

    // Admin Payable Section
    rows.push(['--- ADMIN PAYABLE REPORT ---']);
    rows.push(['Total Amount Payable to Admin', reportData.adminPayableReport?.totalPayableToAdmin || 0]);
    rows.push(['Amount Already Paid', reportData.adminPayableReport?.amountAlreadyPaid || 0]);
    rows.push(['Remaining Payable Amount', reportData.adminPayableReport?.remainingPayableAmount || 0]);
    rows.push([]);

    // Admin Transactions Section
    rows.push(['--- ADMIN TRANSACTIONS ---']);
    rows.push(['Transaction ID', 'Date', 'Amount (INR)', 'Type', 'Status', 'Reference ID', 'Note']);
    (reportData.adminTransactionReport?.transactions || []).forEach((t) => {
      rows.push([
        `"${t.transactionId || ''}"`,
        `"${t.date || ''}"`,
        t.amount || 0,
        `"${t.type || ''}"`,
        `"${t.status || ''}"`,
        `"${t.referenceId || ''}"`,
        `"${(t.note || '').replace(/"/g, '""')}"`
      ]);
    });
    rows.push([]);

    // Activity Logs Section
    rows.push(['--- ACTIVITY LOGS ---']);
    rows.push(['Timestamp', 'User', 'Action', 'Entity ID', 'Entity Type', 'Result', 'Details']);
    (reportData.activityLogs?.logs || []).forEach((l) => {
      rows.push([
        `"${l.timestamp || ''}"`,
        `"${l.user || ''}"`,
        `"${l.action || ''}"`,
        `"${l.entityId || ''}"`,
        `"${l.entityType || ''}"`,
        `"${l.result || ''}"`,
        `"${(l.details || '').replace(/"/g, '""')}"`
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kiyuziyu_analysis_${tenantId || 'tenant'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Prepare chart data for payment status breakdown
  const pieChartData = useMemo(() => {
    if (!reportData?.salesReport?.paymentStatusBreakdown) return [];
    const breakdown = reportData.salesReport.paymentStatusBreakdown;
    return Object.entries(breakdown).map(([name, value]) => ({
      name,
      value
    }));
  }, [reportData]);

  // Filtered Activity Logs
  const filteredActivityLogs = useMemo(() => {
    const list = reportData?.activityLogs?.logs || [];
    return list.filter((item) => {
      if (activityCategoryFilter !== 'ALL') {
        const type = (item.entityType || '').toUpperCase();
        if (activityCategoryFilter === 'ORDER' && !type.includes('ORDER')) return false;
        if (activityCategoryFilter === 'SHOPIFY' && !type.includes('SHOPIFY') && !type.includes('SYNC')) return false;
        if (activityCategoryFilter === 'PAYMENT' && !type.includes('PAYMENT')) return false;
      }
      if (activitySearchQuery) {
        const q = activitySearchQuery.toLowerCase();
        const text = `${item.action} ${item.entityId} ${item.user} ${item.details}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [reportData, activityCategoryFilter, activitySearchQuery]);

  return (
    <div style={styles.container}>
      {/* Top Header Bar */}
      <div style={styles.headerBar}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={styles.pageIconWrap}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b89620" strokeWidth="2.5">
                <line x1="12" y1="20" x2="12" y2="10" />
                <line x1="18" y1="20" x2="18" y2="4" />
                <line x1="6" y1="20" x2="6" y2="16" />
              </svg>
            </div>
            <div>
              <h1 style={styles.pageTitle}>Analysis Reports</h1>
              <p style={styles.pageSubtitle}>
                Real-time sales performance, payment settlements, daily intake, and activity tracking.
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls: Date Filter, Manual Refresh, CSV Export */}
        <div style={styles.controlCluster}>
          {/* Preset Buttons */}
          <div style={styles.presetGroup}>
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
                  ...styles.presetBtn,
                  ...(dateRangePreset === preset.id ? styles.presetBtnActive : {})
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          {dateRangePreset === 'custom' && (
            <div style={styles.customDateWrapper}>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={styles.dateInput}
                title="Start Date"
              />
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={styles.dateInput}
                title="End Date"
              />
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={() => fetchReport(true)}
            disabled={refreshing}
            style={styles.refreshBtn}
            title="Refresh Real-Time Data"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{
                animation: refreshing ? 'spin 0.8s linear infinite' : 'none'
              }}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            disabled={!reportData || loading}
            style={styles.exportBtn}
            title="Export Report to CSV"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Timestamp indicator */}
      {lastUpdated && (
        <div style={styles.timestampRow}>
          <span style={styles.liveDot} />
          <span>Real-time connected • Last synchronized: {lastUpdated.toLocaleTimeString()}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div style={styles.alertBox}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => fetchReport(true)} style={styles.alertRetryBtn}>
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !reportData ? (
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Calculating real-time tenant financial analysis...</p>
        </div>
      ) : (
        <>
          {/* Sub-Navigation Tabs for Quick Filtering */}
          <div style={styles.subNavBar}>
            {[
              { id: 'all', label: 'Full Overview' },
              { id: 'sales', label: 'Payment & Sales' },
              { id: 'daily', label: 'Daily Amount' },
              { id: 'payable', label: 'Admin Payable' },
              { id: 'transactions', label: 'Admin Transactions' },
              { id: 'activity', label: 'Activity Logs' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveReportSection(tab.id)}
                style={{
                  ...styles.subNavBtn,
                  ...(activeReportSection === tab.id ? styles.subNavBtnActive : {})
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ============================================================
              TOP KPI CARDS (Executive Snapshot)
             ============================================================ */}
          <div style={styles.kpiGrid}>
            {/* Card 1: Gross Sales */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>TOTAL SALES AMOUNT</span>
                <span style={{ ...styles.kpiIconWrap, backgroundColor: '#fef3c7', color: '#b89620' }}>₹</span>
              </div>
              <div style={styles.kpiValue}>
                {formatCurrency(reportData?.salesReport?.totalSalesAmount)}
              </div>
              <div style={styles.kpiSub}>Gross order value in selected period</div>
            </div>

            {/* Card 2: Payments Received */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>PAYMENTS RECEIVED</span>
                <span style={{ ...styles.kpiIconWrap, backgroundColor: '#ecfdf5', color: '#059669' }}>✓</span>
              </div>
              <div style={{ ...styles.kpiValue, color: '#059669' }}>
                {formatCurrency(reportData?.salesReport?.totalPaymentsReceived)}
              </div>
              <div style={styles.kpiSub}>
                {reportData?.salesReport?.successfulPaymentsCount || 0} successful customer transactions
              </div>
            </div>

            {/* Card 3: Pending Payments */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>PENDING PAYMENTS</span>
                <span style={{ ...styles.kpiIconWrap, backgroundColor: '#fffbeb', color: '#d97706' }}>⏳</span>
              </div>
              <div style={{ ...styles.kpiValue, color: '#d97706' }}>
                {formatCurrency(reportData?.salesReport?.pendingPayments)}
              </div>
              <div style={styles.kpiSub}>Awaiting verification or COD clearance</div>
            </div>

            {/* Card 4: Admin Remaining Balance */}
            <div style={styles.kpiCard}>
              <div style={styles.kpiHeader}>
                <span style={styles.kpiLabel}>ADMIN PAYABLE BALANCE</span>
                <span style={{ ...styles.kpiIconWrap, backgroundColor: '#f1f5f9', color: '#475569' }}>💼</span>
              </div>
              <div style={{ ...styles.kpiValue, color: '#0f172a' }}>
                {formatCurrency(reportData?.adminPayableReport?.remainingPayableAmount)}
              </div>
              <div style={styles.kpiSub}>
                Paid: {formatCurrency(reportData?.adminPayableReport?.amountAlreadyPaid)}
              </div>
            </div>
          </div>

          {/* ============================================================
              REPORT SECTION A: PAYMENT & SALES REPORTS
             ============================================================ */}
          {(activeReportSection === 'all' || activeReportSection === 'sales') && (
            <div style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionTitleGroup}>
                  <div style={styles.sectionIconBadge}>📊</div>
                  <div>
                    <h2 style={styles.sectionHeading}>Payment & Sales Reports</h2>
                    <p style={styles.sectionSubHeading}>
                      Revenue trajectory, settled transactions, pending collections, and payment distribution.
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Breakdown Metric Row */}
              <div style={styles.statPillsRow}>
                <div style={{ ...styles.statPill, borderLeft: '4px solid #10b981' }}>
                  <span style={styles.statPillLabel}>Successful Payments</span>
                  <span style={{ ...styles.statPillValue, color: '#10b981' }}>
                    {reportData?.salesReport?.successfulPaymentsCount || 0} ({formatCurrency(reportData?.salesReport?.successfulPaymentsAmount)})
                  </span>
                </div>
                <div style={{ ...styles.statPill, borderLeft: '4px solid #f59e0b' }}>
                  <span style={styles.statPillLabel}>Pending Payments</span>
                  <span style={{ ...styles.statPillValue, color: '#d97706' }}>
                    {formatCurrency(reportData?.salesReport?.pendingPayments)}
                  </span>
                </div>
                <div style={{ ...styles.statPill, borderLeft: '4px solid #ef4444' }}>
                  <span style={styles.statPillLabel}>Failed / Cancelled</span>
                  <span style={{ ...styles.statPillValue, color: '#ef4444' }}>
                    {reportData?.salesReport?.failedPaymentsCount || 0} ({formatCurrency(reportData?.salesReport?.failedPaymentsAmount)})
                  </span>
                </div>
              </div>

              {/* Charts Grid */}
              <div style={styles.chartsGrid}>
                {/* Chart 1: Daily Sales & Revenue Trend */}
                <div style={styles.chartContainer}>
                  <div style={styles.chartTitleWrap}>
                    <h3 style={styles.chartTitle}>Daily Sales & Payments Received Trend</h3>
                    <span style={styles.chartTag}>Real-Time Aggregate</span>
                  </div>
                  {reportData?.salesReport?.dailySummary?.length > 0 ? (
                    <div style={{ width: '100%', height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={reportData.salesReport.dailySummary}
                          margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#b89620" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#b89620" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="recGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                          <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => `₹${val}`} />
                          <Tooltip
                            formatter={(val) => [formatCurrency(val), 'Amount']}
                            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Area
                            type="monotone"
                            dataKey="salesAmount"
                            name="Gross Sales"
                            stroke="#b89620"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#salesGrad)"
                          />
                          <Area
                            type="monotone"
                            dataKey="receivedAmount"
                            name="Payments Received"
                            stroke="#10b981"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#recGrad)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div style={styles.chartEmpty}>
                      <span style={{ fontSize: '28px' }}>📉</span>
                      <p style={styles.emptyTitle}>No Sales Activity in Selected Period</p>
                      <p style={styles.emptyDesc}>Orders placed in your connected store will appear here.</p>
                    </div>
                  )}
                </div>

                {/* Chart 2: Payment Status Breakdown */}
                <div style={styles.chartContainer}>
                  <div style={styles.chartTitleWrap}>
                    <h3 style={styles.chartTitle}>Payment Status Breakdown</h3>
                    <span style={styles.chartTag}>By Orders Count</span>
                  </div>
                  {pieChartData.length > 0 ? (
                    <div style={{ width: '100%', height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={4}
                            dataKey="value"
                            nameKey="name"
                          >
                            {pieChartData.map((entry, index) => {
                              const color = STATUS_COLORS[entry.name] || PIE_COLORS[index % PIE_COLORS.length];
                              return <Cell key={`cell-${index}`} fill={color} />;
                            })}
                          </Pie>
                          <Tooltip
                            formatter={(val, name) => [`${val} orders`, name]}
                            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div style={styles.chartEmpty}>
                      <span style={{ fontSize: '28px' }}>🍩</span>
                      <p style={styles.emptyTitle}>No Payment Status Data</p>
                      <p style={styles.emptyDesc}>Completed, pending, and failed statuses will be summarized here.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Weekly & Monthly Comparison Table */}
              <div style={styles.tableCardWrap}>
                <h4 style={styles.tableTitle}>Sales Performance Summaries</h4>
                <div style={styles.responsiveTableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Interval</th>
                        <th style={styles.th}>Orders</th>
                        <th style={styles.th}>Gross Sales Amount</th>
                        <th style={styles.th}>Received Amount</th>
                        <th style={styles.th}>Pending Clearance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Weekly summaries */}
                      {(reportData?.salesReport?.weeklySummary || []).slice(0, 4).map((w, idx) => {
                        const pending = Math.max(0, (w.salesAmount || 0) - (w.receivedAmount || 0));
                        return (
                          <tr key={`week-${idx}`} style={styles.tr}>
                            <td style={styles.td}>
                              <span style={styles.badgeNeutral}>{w.label || `Week ${idx + 1}`}</span>
                            </td>
                            <td style={styles.td}>{w.ordersCount || 0}</td>
                            <td style={{ ...styles.td, fontWeight: '600' }}>{formatCurrency(w.salesAmount)}</td>
                            <td style={{ ...styles.td, color: '#059669', fontWeight: '600' }}>{formatCurrency(w.receivedAmount)}</td>
                            <td style={{ ...styles.td, color: '#d97706' }}>{formatCurrency(pending)}</td>
                          </tr>
                        );
                      })}
                      {(!reportData?.salesReport?.weeklySummary || reportData.salesReport.weeklySummary.length === 0) && (
                        <tr>
                          <td colSpan="5" style={styles.tdEmpty}>No weekly summary data available for this range.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================
              REPORT SECTION B: DAILY AMOUNT REPORT
             ============================================================ */}
          {(activeReportSection === 'all' || activeReportSection === 'daily') && (
            <div style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionTitleGroup}>
                  <div style={styles.sectionIconBadge}>📅</div>
                  <div>
                    <h2 style={styles.sectionHeading}>Daily Amount Report</h2>
                    <p style={styles.sectionSubHeading}>
                      Today's intake, collected amounts, and comparison with yesterday's performance.
                    </p>
                  </div>
                </div>
              </div>

              <div style={styles.dailyGrid}>
                {/* Today's Order Amount */}
                <div style={styles.dailyCard}>
                  <div style={styles.dailyCardTop}>
                    <span style={styles.dailyCardLabel}>TODAY'S TOTAL ORDER AMOUNT</span>
                    <span style={styles.dailyCardBadge}>Today</span>
                  </div>
                  <div style={styles.dailyCardValue}>
                    {formatCurrency(reportData?.dailyAmountReport?.todayOrderAmount)}
                  </div>
                  {/* Yesterday comparison indicator */}
                  <div style={styles.comparisonRow}>
                    {Number(reportData?.dailyAmountReport?.amountChangePercentage || 0) >= 0 ? (
                      <span style={styles.trendUp}>
                        ▲ +{Number(reportData?.dailyAmountReport?.amountChangePercentage || 0).toFixed(1)}%
                      </span>
                    ) : (
                      <span style={styles.trendDown}>
                        ▼ {Number(reportData?.dailyAmountReport?.amountChangePercentage || 0).toFixed(1)}%
                      </span>
                    )}
                    <span style={styles.comparisonText}>
                      vs yesterday ({formatCurrency(reportData?.dailyAmountReport?.previousDayOrderAmount)})
                    </span>
                  </div>
                </div>

                {/* Amount Collected Today */}
                <div style={styles.dailyCard}>
                  <div style={styles.dailyCardTop}>
                    <span style={styles.dailyCardLabel}>COLLECTED TODAY</span>
                    <span style={{ ...styles.dailyCardBadge, backgroundColor: '#ecfdf5', color: '#059669' }}>Received</span>
                  </div>
                  <div style={{ ...styles.dailyCardValue, color: '#059669' }}>
                    {formatCurrency(reportData?.dailyAmountReport?.todayCollectedAmount)}
                  </div>
                  <div style={styles.comparisonRow}>
                    <span style={styles.comparisonText}>Actual customer payments verified today</span>
                  </div>
                </div>

                {/* Pending Amount Today */}
                <div style={styles.dailyCard}>
                  <div style={styles.dailyCardTop}>
                    <span style={styles.dailyCardLabel}>PENDING AMOUNT TODAY</span>
                    <span style={{ ...styles.dailyCardBadge, backgroundColor: '#fffbeb', color: '#d97706' }}>Pending</span>
                  </div>
                  <div style={{ ...styles.dailyCardValue, color: '#d97706' }}>
                    {formatCurrency(reportData?.dailyAmountReport?.todayPendingAmount)}
                  </div>
                  <div style={styles.comparisonRow}>
                    <span style={styles.comparisonText}>Unsettled or pending verification orders</span>
                  </div>
                </div>

                {/* Number of Orders Today */}
                <div style={styles.dailyCard}>
                  <div style={styles.dailyCardTop}>
                    <span style={styles.dailyCardLabel}>ORDERS TODAY</span>
                    <span style={styles.dailyCardBadge}>Volume</span>
                  </div>
                  <div style={styles.dailyCardValue}>
                    {reportData?.dailyAmountReport?.todayOrderCount || 0}
                  </div>
                  <div style={styles.comparisonRow}>
                    {Number(reportData?.dailyAmountReport?.ordersChangePercentage || 0) >= 0 ? (
                      <span style={styles.trendUp}>
                        ▲ +{Number(reportData?.dailyAmountReport?.ordersChangePercentage || 0).toFixed(0)}%
                      </span>
                    ) : (
                      <span style={styles.trendDown}>
                        ▼ {Number(reportData?.dailyAmountReport?.ordersChangePercentage || 0).toFixed(0)}%
                      </span>
                    )}
                    <span style={styles.comparisonText}>order volume vs previous day</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================
              REPORT SECTION C: ADMIN PAYABLE REPORT
             ============================================================ */}
          {(activeReportSection === 'all' || activeReportSection === 'payable') && (
            <div style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionTitleGroup}>
                  <div style={styles.sectionIconBadge}>🤝</div>
                  <div>
                    <h2 style={styles.sectionHeading}>Admin Payable Report</h2>
                    <p style={styles.sectionSubHeading}>
                      Platform wholesale settlement, amount paid, and net remaining payable balance.
                    </p>
                  </div>
                </div>
              </div>

              {/* Admin Payable Formula Highlight Box */}
              <div style={styles.payableOverviewBox}>
                <div style={styles.payableCol}>
                  <span style={styles.payableLabel}>Total Payable to Admin</span>
                  <span style={styles.payableValPrimary}>
                    {formatCurrency(reportData?.adminPayableReport?.totalPayableToAdmin)}
                  </span>
                  <span style={styles.payableNote}>Derived strictly from product wholesale base prices</span>
                </div>

                <div style={styles.payableDivider}>—</div>

                <div style={styles.payableCol}>
                  <span style={styles.payableLabel}>Amount Already Paid</span>
                  <span style={{ ...styles.payableValPrimary, color: '#059669' }}>
                    {formatCurrency(reportData?.adminPayableReport?.amountAlreadyPaid)}
                  </span>
                  <span style={styles.payableNote}>Authoritative settled payments to platform</span>
                </div>

                <div style={styles.payableDivider}>=</div>

                <div style={styles.payableCol}>
                  <span style={styles.payableLabel}>Remaining Payable Balance</span>
                  <span
                    style={{
                      ...styles.payableValPrimary,
                      color:
                        (reportData?.adminPayableReport?.remainingPayableAmount || 0) > 0 ? '#b89620' : '#10b981'
                    }}
                  >
                    {formatCurrency(reportData?.adminPayableReport?.remainingPayableAmount)}
                  </span>
                  <span style={styles.payableNote}>
                    {(reportData?.adminPayableReport?.remainingPayableAmount || 0) === 0
                      ? '✓ Account fully settled'
                      : 'Outstanding platform obligation'}
                  </span>
                </div>
              </div>

              {/* Settlement History List */}
              <div style={styles.tableCardWrap}>
                <h4 style={styles.tableTitle}>Recent Admin Settlements & Payment Records</h4>
                <div style={styles.responsiveTableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Transaction Ref</th>
                        <th style={styles.th}>Date & Time</th>
                        <th style={styles.th}>Amount</th>
                        <th style={styles.th}>Type</th>
                        <th style={styles.th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData?.adminPayableReport?.paymentHistory || []).map((t, idx) => (
                        <tr key={`admin-hist-${idx}`} style={styles.tr}>
                          <td style={styles.td}>
                            <span style={styles.codePill}>{t.transactionId || t.referenceId || `TX-${idx + 1}`}</span>
                          </td>
                          <td style={styles.td}>{t.date || '—'}</td>
                          <td style={{ ...styles.td, fontWeight: '700', color: '#059669' }}>
                            {formatCurrency(t.amount)}
                          </td>
                          <td style={styles.td}>
                            <span style={styles.badgeNeutral}>{t.type || 'PAYMENT'}</span>
                          </td>
                          <td style={styles.td}>
                            <span
                              style={{
                                ...styles.statusBadge,
                                ...(t.status === 'COMPLETED' ? styles.statusSuccess : styles.statusWarning)
                              }}
                            >
                              {t.status || 'COMPLETED'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {(!reportData?.adminPayableReport?.paymentHistory ||
                        reportData.adminPayableReport.paymentHistory.length === 0) && (
                        <tr>
                          <td colSpan="5" style={styles.tdEmpty}>
                            No admin payment settlement records found for this period.
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
              REPORT SECTION D: ADMIN TRANSACTION REPORT
             ============================================================ */}
          {(activeReportSection === 'all' || activeReportSection === 'transactions') && (
            <div style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionTitleGroup}>
                  <div style={styles.sectionIconBadge}>💳</div>
                  <div>
                    <h2 style={styles.sectionHeading}>Admin Transaction Report</h2>
                    <p style={styles.sectionSubHeading}>
                      All platform transfers, fee deductions, completed disbursements, and status totals.
                    </p>
                  </div>
                </div>

                {/* Summary badges */}
                <div style={styles.txStatsWrap}>
                  <span style={styles.txCountCompleted}>
                    Completed: {reportData?.adminTransactionReport?.totalCompleted || 0} (
                    {formatCurrency(reportData?.adminTransactionReport?.totalCompletedAmount)})
                  </span>
                  <span style={styles.txCountPending}>
                    Pending: {reportData?.adminTransactionReport?.totalPending || 0}
                  </span>
                  <span style={styles.txCountFailed}>
                    Failed: {reportData?.adminTransactionReport?.totalFailed || 0}
                  </span>
                </div>
              </div>

              {/* Transactions Table */}
              <div style={styles.responsiveTableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Transaction ID</th>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Amount</th>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Reference ID</th>
                      <th style={styles.th}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reportData?.adminTransactionReport?.transactions || []).map((tx, idx) => (
                      <tr key={`tx-${idx}`} style={styles.tr}>
                        <td style={styles.td}>
                          <span style={styles.codePill}>{tx.transactionId || `TXN-${idx + 1}`}</span>
                        </td>
                        <td style={styles.td}>{tx.date || '—'}</td>
                        <td style={{ ...styles.td, fontWeight: '700', color: '#0f172a' }}>
                          {formatCurrency(tx.amount)}
                        </td>
                        <td style={styles.td}>
                          <span style={styles.badgeNeutral}>{tx.type || 'PAYMENT'}</span>
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.statusBadge,
                              ...(tx.status === 'COMPLETED'
                                ? styles.statusSuccess
                                : tx.status === 'FAILED'
                                ? styles.statusDanger
                                : styles.statusWarning)
                            }}
                          >
                            {tx.status || 'PENDING'}
                          </span>
                        </td>
                        <td style={styles.td}>{tx.referenceId || '—'}</td>
                        <td style={{ ...styles.td, color: '#64748b', fontSize: '12px' }}>{tx.note || '—'}</td>
                      </tr>
                    ))}
                    {(!reportData?.adminTransactionReport?.transactions ||
                      reportData.adminTransactionReport.transactions.length === 0) && (
                      <tr>
                        <td colSpan="7" style={styles.tdEmpty}>
                          No transactions recorded. All platform settlements will appear here.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================
              REPORT SECTION E: ACTIVITY LOGS
             ============================================================ */}
          {(activeReportSection === 'all' || activeReportSection === 'activity') && (
            <div style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionTitleGroup}>
                  <div style={styles.sectionIconBadge}>📜</div>
                  <div>
                    <h2 style={styles.sectionHeading}>Activity Logs</h2>
                    <p style={styles.sectionSubHeading}>
                      Audit trail of Shopify syncs, order lifecycle updates, payments, and system events.
                    </p>
                  </div>
                </div>

                {/* Filter and Search controls */}
                <div style={styles.activityFilterCluster}>
                  <input
                    type="text"
                    placeholder="Search action or ID..."
                    value={activitySearchQuery}
                    onChange={(e) => setActivitySearchQuery(e.target.value)}
                    style={styles.activitySearchInput}
                  />
                  <select
                    value={activityCategoryFilter}
                    onChange={(e) => setActivityCategoryFilter(e.target.value)}
                    style={styles.activitySelect}
                  >
                    <option value="ALL">All Categories</option>
                    <option value="ORDER">Orders</option>
                    <option value="SHOPIFY">Shopify Sync</option>
                    <option value="PAYMENT">Payments</option>
                  </select>
                </div>
              </div>

              {/* Activity Logs Stream Table */}
              <div style={styles.responsiveTableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Timestamp</th>
                      <th style={styles.th}>User / Source</th>
                      <th style={styles.th}>Action</th>
                      <th style={styles.th}>Entity ID</th>
                      <th style={styles.th}>Category</th>
                      <th style={styles.th}>Result</th>
                      <th style={styles.th}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActivityLogs.map((log, idx) => (
                      <tr key={`log-${idx}`} style={styles.tr}>
                        <td style={{ ...styles.td, whiteSpace: 'nowrap', fontSize: '12.5px', color: '#64748b' }}>
                          {log.timestamp || '—'}
                        </td>
                        <td style={{ ...styles.td, fontWeight: '600', color: '#0f172a' }}>{log.user || 'System'}</td>
                        <td style={styles.td}>{log.action || '—'}</td>
                        <td style={styles.td}>
                          <span style={styles.codePill}>{log.entityId || '—'}</span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.badgeNeutral}>{log.entityType || 'SYSTEM'}</span>
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.statusBadge,
                              ...(log.result === 'SUCCESS'
                                ? styles.statusSuccess
                                : log.result === 'FAILED'
                                ? styles.statusDanger
                                : styles.statusWarning)
                            }}
                          >
                            {log.result || 'SUCCESS'}
                          </span>
                        </td>
                        <td style={{ ...styles.td, fontSize: '12px', color: '#475569', maxWidth: '300px' }}>
                          {log.details || '—'}
                        </td>
                      </tr>
                    ))}
                    {filteredActivityLogs.length === 0 && (
                      <tr>
                        <td colSpan="7" style={styles.tdEmpty}>
                          No activity logs match the selected filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Global Embedded Styles */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Inline Styles strictly adhering to KIYUZYU Dashboard Design Tokens
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#0f172a'
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
  pageIconWrap: {
    width: '42px',
    height: '42px',
    borderRadius: '10px',
    backgroundColor: '#fef3c7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  pageTitle: {
    margin: '0 0 4px 0',
    fontSize: '20px',
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: '-0.02em'
  },
  pageSubtitle: {
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
  customDateWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  dateInput: {
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '12px',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    outline: 'none'
  },
  refreshBtn: {
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
    cursor: 'pointer',
    transition: 'all 0.15s'
  },
  exportBtn: {
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
    marginTop: '-12px',
    paddingLeft: '4px'
  },
  liveDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)'
  },
  alertBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 18px',
    borderRadius: '10px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    fontSize: '13px',
    fontWeight: '500'
  },
  alertRetryBtn: {
    padding: '4px 10px',
    borderRadius: '6px',
    backgroundColor: '#ffffff',
    border: '1px solid #fca5a5',
    color: '#b91c1c',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  loadingContainer: {
    backgroundColor: '#ffffff',
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
    padding: '60px 20px',
    textAlign: 'center'
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #e2e8f0',
    borderTop: '3px solid #b89620',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto 16px'
  },
  loadingText: {
    fontSize: '13.5px',
    color: '#64748b',
    margin: 0
  },
  subNavBar: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '4px'
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
    whiteSpace: 'nowrap',
    transition: 'all 0.15s'
  },
  subNavBtnActive: {
    backgroundColor: '#fef3c7',
    color: '#b89620',
    border: '1px solid #fde68a'
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
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
  kpiHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px'
  },
  kpiLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  kpiIconWrap: {
    width: '26px',
    height: '26px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '13px'
  },
  kpiValue: {
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
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    padding: '24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid #f1f5f9'
  },
  sectionTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  sectionIconBadge: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px'
  },
  sectionHeading: {
    margin: '0 0 2px 0',
    fontSize: '17px',
    fontWeight: '700',
    color: '#0f172a'
  },
  sectionSubHeading: {
    margin: 0,
    fontSize: '12.5px',
    color: '#64748b'
  },
  statPillsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
    marginBottom: '24px'
  },
  statPill: {
    backgroundColor: '#f8fafc',
    borderRadius: '10px',
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  statPillLabel: {
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#64748b'
  },
  statPillValue: {
    fontSize: '15px',
    fontWeight: '700'
  },
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    gap: '20px',
    marginBottom: '24px'
  },
  chartContainer: {
    backgroundColor: '#fafafa',
    borderRadius: '12px',
    border: '1px solid #f1f5f9',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column'
  },
  chartTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px'
  },
  chartTitle: {
    margin: 0,
    fontSize: '13px',
    fontWeight: '700',
    color: '#334155'
  },
  chartTag: {
    fontSize: '10.5px',
    fontWeight: '700',
    backgroundColor: '#e2e8f0',
    color: '#475569',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  chartEmpty: {
    height: '240px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    color: '#94a3b8'
  },
  emptyTitle: {
    margin: '8px 0 2px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#334155'
  },
  emptyDesc: {
    margin: 0,
    fontSize: '12px',
    color: '#94a3b8'
  },
  tableCardWrap: {
    marginTop: '16px'
  },
  tableTitle: {
    margin: '0 0 10px 0',
    fontSize: '13.5px',
    fontWeight: '700',
    color: '#334155'
  },
  responsiveTableWrap: {
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
    backgroundColor: '#f8fafc',
    padding: '12px 16px',
    fontWeight: '700',
    color: '#475569',
    borderBottom: '1px solid #e2e8f0',
    whiteSpace: 'nowrap'
  },
  td: {
    padding: '12px 16px',
    borderBottom: '1px solid #f1f5f9',
    color: '#1e293b'
  },
  tdEmpty: {
    padding: '30px 16px',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '13px'
  },
  tr: {
    backgroundColor: '#ffffff'
  },
  badgeNeutral: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: '6px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    fontSize: '11px',
    fontWeight: '600'
  },
  codePill: {
    fontFamily: 'monospace',
    fontSize: '11.5px',
    backgroundColor: '#f8fafc',
    padding: '3px 7px',
    borderRadius: '4px',
    border: '1px solid #e2e8f0',
    color: '#0f172a'
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '700'
  },
  statusSuccess: {
    backgroundColor: '#ecfdf5',
    color: '#059669',
    border: '1px solid #a7f3d0'
  },
  statusWarning: {
    backgroundColor: '#fffbeb',
    color: '#d97706',
    border: '1px solid #fde68a'
  },
  statusDanger: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca'
  },
  dailyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px'
  },
  dailyCard: {
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '18px'
  },
  dailyCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  dailyCardLabel: {
    fontSize: '10.5px',
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: '0.04em'
  },
  dailyCardBadge: {
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: '#e2e8f0',
    color: '#475569'
  },
  dailyCardValue: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: '8px'
  },
  comparisonRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11.5px'
  },
  trendUp: {
    color: '#10b981',
    fontWeight: '700'
  },
  trendDown: {
    color: '#ef4444',
    fontWeight: '700'
  },
  comparisonText: {
    color: '#64748b'
  },
  payableOverviewBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: '16px',
    backgroundColor: '#f8fafc',
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
    padding: '22px',
    marginBottom: '20px'
  },
  payableCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center'
  },
  payableLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '4px'
  },
  payableValPrimary: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: '4px'
  },
  payableNote: {
    fontSize: '11.5px',
    color: '#94a3b8'
  },
  payableDivider: {
    fontSize: '24px',
    fontWeight: '300',
    color: '#cbd5e1'
  },
  txStatsWrap: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    fontSize: '12px',
    fontWeight: '600'
  },
  txCountCompleted: {
    padding: '4px 10px',
    borderRadius: '6px',
    backgroundColor: '#ecfdf5',
    color: '#059669',
    border: '1px solid #a7f3d0'
  },
  txCountPending: {
    padding: '4px 10px',
    borderRadius: '6px',
    backgroundColor: '#fffbeb',
    color: '#d97706',
    border: '1px solid #fde68a'
  },
  txCountFailed: {
    padding: '4px 10px',
    borderRadius: '6px',
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca'
  },
  activityFilterCluster: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap'
  },
  activitySearchInput: {
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '12.5px',
    outline: 'none',
    width: '180px'
  },
  activitySelect: {
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '12.5px',
    outline: 'none',
    backgroundColor: '#ffffff'
  }
};
