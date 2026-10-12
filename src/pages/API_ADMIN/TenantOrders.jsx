import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';

export const ORDER_STATUSES = [
    'Pending Payment',
    'Payment Done',
    'Ready to Dispatch',
    'Dispatched',
    'Delivered',
    'Cancelled'
];

export const STATUS_CONFIG = {
    'Pending Payment': {
        label: 'Pending Payment',
        color: '#b45309',
        bg: '#fef3c7',
        border: '#fde68a',
        badgeBg: '#fffbeb',
        icon: '⏳',
        step: 1,
        desc: 'Customer payment pending or verifying'
    },
    'Payment Done': {
        label: 'Payment Done',
        color: '#1d4ed8',
        bg: '#dbeafe',
        border: '#bfdbfe',
        badgeBg: '#eff6ff',
        icon: '💳',
        step: 2,
        desc: 'Payment received & verified'
    },
    'Ready to Dispatch': {
        label: 'Ready to Dispatch',
        color: '#6d28d9',
        bg: '#ede9fe',
        border: '#ddd6fe',
        badgeBg: '#f5f3ff',
        icon: '📦',
        step: 3,
        desc: 'Items packed and awaiting carrier pickup'
    },
    'Dispatched': {
        label: 'Dispatched',
        color: '#0e7490',
        bg: '#cffafe',
        border: '#a5f3fc',
        badgeBg: '#ecfeff',
        icon: '🚚',
        step: 4,
        desc: 'Order in transit with shipping courier'
    },
    'Delivered': {
        label: 'Delivered',
        color: '#15803d',
        bg: '#dcfce7',
        border: '#bbf7d0',
        badgeBg: '#ecfdf5',
        icon: '✅',
        step: 5,
        desc: 'Order safely delivered to recipient'
    },
    'Cancelled': {
        label: 'Cancelled',
        color: '#b91c1c',
        bg: '#fee2e2',
        border: '#fecaca',
        badgeBg: '#fef2f2',
        icon: '✕',
        step: 0,
        desc: 'Order has been cancelled'
    }
};

export const normalizeStatus = (rawStatus) => {
    if (!rawStatus) return 'Pending Payment';
    const s = String(rawStatus).trim();
    const upper = s.toUpperCase().replace(/[_\s-]+/g, ' ');

    if (upper === 'PENDING PAYMENT' || upper === 'PENDING' || upper === 'UNPAID') return 'Pending Payment';
    if (upper === 'PAYMENT DONE' || upper === 'PAID' || upper === 'COMPLETED' || upper === 'PAYMENT RECEIVED') return 'Payment Done';
    if (upper === 'READY TO DISPATCH' || upper === 'PROCESSING' || upper === 'PACKED' || upper === 'READY') return 'Ready to Dispatch';
    if (upper === 'DISPATCHED' || upper === 'DISPATCH' || upper === 'SHIPPED' || upper === 'IN TRANSIT') return 'Dispatched';
    if (upper === 'DELIVERED' || upper === 'DELIVERD' || upper === 'FULFILLED') return 'Delivered';
    if (upper === 'CANCELLED' || upper === 'CANCELED' || upper === 'CANCLE' || upper === 'VOID') return 'Cancelled';

    if (upper === 'NEW') return 'Pending Payment';

    if (STATUS_CONFIG[s]) return s;
    return 'Pending Payment';
};

export default function TenantOrders({ tenantId, isAdmin = false }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
    const [statusUpdatingId, setStatusUpdatingId] = useState(null);
    const [statusToast, setStatusToast] = useState({ show: false, text: '', isError: false });
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // =========================================================================
    // REAL-TIME DATA FETCHING ("PROPER DATA FETCH")
    // =========================================================================
    useEffect(() => {
        let unsubscribe = null;
        let isMounted = true;

        const setupOrdersSubscription = async () => {
            // Wait for tenantId if viewing as tenant
            if (!isAdmin && !tenantId) {
                setLoading(true);
                return;
            }

            setLoading(true);
            setError('');

            try {
                let ordersQuery;
                if (isAdmin) {
                    ordersQuery = query(collection(db, 'apiTenantOrders'));
                } else {
                    const tenantIds = [tenantId];
                    if (tenantId !== 'g0usC1NMyehaoSKJRhOqUUhZAO62') {
                        tenantIds.push('g0usC1NMyehaoSKJRhOqUUhZAO62');
                    }
                    ordersQuery = query(
                        collection(db, 'apiTenantOrders'),
                        where('tenantId', 'in', tenantIds)
                    );
                }

                // Attach real-time Firestore listener
                unsubscribe = onSnapshot(
                    ordersQuery,
                    (snapshot) => {
                        if (!isMounted) return;
                        const fetched = [];
                        snapshot.forEach((doc) => {
                            const data = doc.data();
                            fetched.push({
                                id: doc.id,
                                ...data,
                                status: normalizeStatus(data.status)
                            });
                        });

                        // Sort newest orders first
                        fetched.sort((a, b) => {
                            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                            return timeB - timeA;
                        });

                        setOrders(fetched);
                        setLoading(false);
                        setError('');

                        // If an order is currently selected, refresh its reference with latest data
                        setSelectedOrder((prev) => {
                            if (!prev) return null;
                            const updated = fetched.find((o) => o.id === prev.id);
                            return updated || prev;
                        });
                    },
                    async (err) => {
                        console.warn("onSnapshot failed, falling back to getDocs:", err);
                        if (!isMounted) return;

                        // Fallback one-time fetch
                        try {
                            let snap;
                            try {
                                snap = await getDocs(ordersQuery);
                            } catch {
                                snap = await getDocs(collection(db, 'apiTenantOrders'));
                            }

                            const fetched = [];
                            snap.forEach((doc) => {
                                const data = doc.data();
                                if (isAdmin || !tenantId || data.tenantId === tenantId || data.tenantId === 'g0usC1NMyehaoSKJRhOqUUhZAO62') {
                                    fetched.push({
                                        id: doc.id,
                                        ...data,
                                        status: normalizeStatus(data.status)
                                    });
                                }
                            });

                            fetched.sort((a, b) => {
                                const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                                const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                                return timeB - timeA;
                            });

                            setOrders(fetched);
                            setLoading(false);
                        } catch (fallbackErr) {
                            console.error("Fallback getDocs error:", fallbackErr);
                            setError('Unable to load orders. Please check your connection or click Retry.');
                            setLoading(false);
                        }
                    }
                );
            } catch (err) {
                console.error("Orders listener setup error:", err);
                setError('Failed to initialize orders.');
                setLoading(false);
            }
        };

        setupOrdersSubscription();

        return () => {
            isMounted = false;
            if (unsubscribe) unsubscribe();
        };
    }, [tenantId, isAdmin, refreshTrigger]);

    // =========================================================================
    // STATUS UPDATE HANDLER
    // =========================================================================
    const handleUpdateStatus = async (orderId, newStatus) => {
        if (!orderId || !newStatus) return;
        setStatusUpdatingId(orderId);
        try {
            const orderDocRef = doc(db, 'apiTenantOrders', orderId);
            const nowIso = new Date().toISOString();
            await updateDoc(orderDocRef, {
                status: newStatus,
                updatedAt: nowIso
            });

            // Optimistic update local state
            setOrders((prev) =>
                prev.map((o) => (o.id === orderId ? { ...o, status: newStatus, updatedAt: nowIso } : o))
            );
            setSelectedOrder((prev) =>
                prev && prev.id === orderId ? { ...prev, status: newStatus, updatedAt: nowIso } : prev
            );

            showToast(`Order status updated to "${newStatus}"!`, false);
        } catch (err) {
            console.error('Error updating order status:', err);
            showToast(`Failed to update status: ${err.message || 'Error'}`, true);
        } finally {
            setStatusUpdatingId(null);
        }
    };

    const showToast = (text, isError = false) => {
        setStatusToast({ show: true, text, isError });
        setTimeout(() => {
            setStatusToast({ show: false, text: '', isError: false });
        }, 4000);
    };

    // =========================================================================
    // FORMATTING HELPERS
    // =========================================================================
    const formatCurrency = (val) => {
        if (val === undefined || val === null || isNaN(val)) return '₹0.00';
        return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatDate = (val) => {
        if (!val) return 'N/A';
        try {
            const d = val.toDate ? val.toDate() : (val.toMillis ? new Date(val.toMillis()) : new Date(val));
            return isNaN(d.getTime()) ? String(val) : d.toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return String(val);
        }
    };

    const renderStatusBadge = (rawStatus, size = 'normal') => {
        const norm = normalizeStatus(rawStatus);
        const cfg = STATUS_CONFIG[norm] || STATUS_CONFIG['Pending Payment'];
        const isSmall = size === 'small';

        return (
            <span
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: isSmall ? '3px 8px' : '5px 12px',
                    borderRadius: '9999px',
                    fontSize: isSmall ? '11px' : '12px',
                    fontWeight: '700',
                    letterSpacing: '0.02em',
                    backgroundColor: cfg.bg,
                    color: cfg.color,
                    border: `1px solid ${cfg.border}`,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                }}
            >
                <span style={{ fontSize: isSmall ? '11px' : '13px' }}>{cfg.icon}</span>
                {cfg.label}
            </span>
        );
    };

    // Status counts for filter pills
    const statusCounts = useMemo(() => {
        const counts = {
            ALL: orders.length,
            'Pending Payment': 0,
            'Payment Done': 0,
            'Ready to Dispatch': 0,
            'Dispatched': 0,
            'Delivered': 0,
            'Cancelled': 0
        };
        orders.forEach((o) => {
            const norm = normalizeStatus(o.status);
            if (counts[norm] !== undefined) counts[norm]++;
        });
        return counts;
    }, [orders]);

    // Filter orders by search & status tab
    const filteredOrders = useMemo(() => {
        return orders.filter((o) => {
            const normStatus = normalizeStatus(o.status);
            if (selectedStatusFilter !== 'ALL' && normStatus !== selectedStatusFilter) {
                return false;
            }

            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase().trim();
            const num = String(o.orderNumber || '').toLowerCase();
            const shopifyId = String(o.shopifyOrderId || '').toLowerCase();
            const cust = String(o.customerName || '').toLowerCase();
            const email = String(o.customerEmail || '').toLowerCase();
            const tenant = String(o.tenantId || '').toLowerCase();
            const code = o.items?.some((i) => (i.productCode || '').toLowerCase().includes(q));

            return num.includes(q) || shopifyId.includes(q) || cust.includes(q) || email.includes(q) || tenant.includes(q) || code;
        });
    }, [orders, selectedStatusFilter, searchQuery]);

    // =========================================================================
    // LOADING & ERROR STATES
    // =========================================================================
    if (loading) {
        return (
            <div style={{ padding: '48px 32px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
                <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
                <p style={{ marginTop: '14px', fontSize: '15px', fontWeight: '600', color: '#1e293b' }}>Fetching orders...</p>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>Connecting to live database stream</p>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '28px', backgroundColor: '#fef2f2', borderRadius: '12px', border: '1px solid #fecaca', color: '#dc2626' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>Error Loading Orders</h3>
                        <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#b91c1c' }}>{error}</p>
                    </div>
                    <button
                        onClick={() => setRefreshTrigger((p) => p + 1)}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#dc2626',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            fontSize: '13px',
                            cursor: 'pointer'
                        }}
                    >
                        🔄 Retry Now
                    </button>
                </div>
            </div>
        );
    }

    // =========================================================================
    // FULL ORDER DETAILS VIEW
    // =========================================================================
    if (selectedOrder) {
        const totalItemsCount = selectedOrder.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || (selectedOrder.quantity || 1);
        const currentNormStatus = normalizeStatus(selectedOrder.status);
        const currentCfg = STATUS_CONFIG[currentNormStatus];
        const isCancelled = currentNormStatus === 'Cancelled';
        const isUpdating = statusUpdatingId === selectedOrder.id;

        const pipelineSteps = [
            'Pending Payment',
            'Payment Done',
            'Ready to Dispatch',
            'Dispatched',
            'Delivered'
        ];
        const currentStepIndex = pipelineSteps.indexOf(currentNormStatus);

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Floating Notification Toast */}
                {statusToast.show && (
                    <div
                        style={{
                            position: 'fixed',
                            top: '20px',
                            right: '20px',
                            zIndex: 9999,
                            padding: '12px 20px',
                            borderRadius: '10px',
                            backgroundColor: statusToast.isError ? '#ef4444' : '#10b981',
                            color: '#fff',
                            fontWeight: '600',
                            fontSize: '14px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            animation: 'fadeIn 0.2s ease-out'
                        }}
                    >
                        <span>{statusToast.isError ? '⚠️' : '✓'}</span>
                        {statusToast.text}
                    </div>
                )}

                {/* Back Button & Top Actions Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <button
                        onClick={() => setSelectedOrder(null)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '9px 18px',
                            backgroundColor: '#fff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            color: '#1e293b',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff'; }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12"></line>
                            <polyline points="12 19 5 12 12 5"></polyline>
                        </svg>
                        Back to Orders
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                            onClick={() => window.print()}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '9px 16px',
                                backgroundColor: '#fff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                color: '#475569',
                                fontSize: '13px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                            }}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                                <rect x="6" y="14" width="12" height="8"></rect>
                            </svg>
                            Print Details
                        </button>
                    </div>
                </div>

                {/* Main Order Header Banner */}
                <div
                    style={{
                        backgroundColor: '#fff',
                        borderRadius: '12px',
                        padding: '24px 28px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '20px'
                    }}
                >
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '800', color: '#0f172a' }}>
                                Order #{selectedOrder.orderNumber || 'N/A'}
                            </h1>
                            {renderStatusBadge(selectedOrder.status)}
                        </div>
                        <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>
                            Placed on {formatDate(selectedOrder.createdAt)}
                            {selectedOrder.updatedAt && ` • Updated on ${formatDate(selectedOrder.updatedAt)}`}
                        </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.04em' }}>
                            {isAdmin ? 'Total Customer Price' : 'Order Total (Selling Price)'}
                        </span>
                        <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                            {formatCurrency(selectedOrder.totalSellingPrice)}
                        </div>
                    </div>
                </div>

                {/* ORDER STATUS PROGRESSION & CONTROLS CARD */}
                <div
                    style={{
                        backgroundColor: '#fff',
                        borderRadius: '12px',
                        padding: '24px 28px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
                                Order Lifecycle Status
                            </h3>
                            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                                Current Stage: <strong>{currentCfg.label}</strong> — {currentCfg.desc}
                            </p>
                        </div>

                        {/* Status Change Selector Dropdown */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                                Update Status:
                            </label>
                            <select
                                value={currentNormStatus}
                                disabled={isUpdating}
                                onChange={(e) => handleUpdateStatus(selectedOrder.id, e.target.value)}
                                style={{
                                    padding: '8px 14px',
                                    borderRadius: '8px',
                                    border: '1.5px solid #cbd5e1',
                                    backgroundColor: '#fff',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    color: '#0f172a',
                                    cursor: isUpdating ? 'not-allowed' : 'pointer',
                                    outline: 'none'
                                }}
                            >
                                {ORDER_STATUSES.map((st) => (
                                    <option key={st} value={st}>
                                        {STATUS_CONFIG[st].icon} {st}
                                    </option>
                                ))}
                            </select>
                            {isUpdating && (
                                <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '600' }}>
                                    Saving...
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Progress Pipeline Visualization */}
                    {isCancelled ? (
                        <div
                            style={{
                                padding: '16px 20px',
                                borderRadius: '10px',
                                backgroundColor: '#fef2f2',
                                border: '1px solid #fecaca',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                color: '#b91c1c'
                            }}
                        >
                            <span style={{ fontSize: '24px' }}>✕</span>
                            <div>
                                <strong style={{ fontSize: '14px' }}>This order has been cancelled.</strong>
                                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#dc2626' }}>
                                    No further dispatch or fulfillment actions are required. You can restore it to any status above at any time.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginTop: '6px' }}>
                            {pipelineSteps.map((stepName, idx) => {
                                const stepCfg = STATUS_CONFIG[stepName];
                                const isPassed = currentStepIndex > idx;
                                const isCurrent = currentStepIndex === idx;

                                return (
                                    <div
                                        key={stepName}
                                        onClick={() => handleUpdateStatus(selectedOrder.id, stepName)}
                                        style={{
                                            padding: '14px 12px',
                                            borderRadius: '10px',
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                            border: isCurrent
                                                ? `2px solid ${stepCfg.color}`
                                                : isPassed
                                                ? '1px solid #bbf7d0'
                                                : '1px solid #e2e8f0',
                                            backgroundColor: isCurrent
                                                ? stepCfg.badgeBg
                                                : isPassed
                                                ? '#f0fdf4'
                                                : '#f8fafc',
                                            boxShadow: isCurrent ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
                                        }}
                                        title={`Click to set status to ${stepName}`}
                                    >
                                        <div style={{ fontSize: '20px', marginBottom: '6px' }}>
                                            {isPassed ? '✅' : stepCfg.icon}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: '12px',
                                                fontWeight: isCurrent ? '800' : '600',
                                                color: isCurrent
                                                    ? stepCfg.color
                                                    : isPassed
                                                    ? '#15803d'
                                                    : '#64748b'
                                            }}
                                        >
                                            {stepName}
                                        </div>
                                        <div style={{ fontSize: '10px', marginTop: '4px', color: '#94a3b8' }}>
                                            {isCurrent ? 'Current' : isPassed ? 'Completed' : `Step ${idx + 1}`}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 3 Detail Cards (Customer, References, Financial) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    {/* Customer Info Card */}
                    <div style={detailCardStyle}>
                        <div style={cardHeaderStyle}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            <h3 style={cardTitleStyle}>Customer Details</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div>
                                <span style={labelStyle}>Customer Name:</span>
                                <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                                    {selectedOrder.customerName || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <span style={labelStyle}>Email Address:</span>
                                <div style={{ fontSize: '14px', color: '#334155', wordBreak: 'break-all' }}>
                                    {selectedOrder.customerEmail || 'No email provided'}
                                </div>
                            </div>
                            <div>
                                <span style={labelStyle}>Phone Number:</span>
                                <div style={{ fontSize: '14px', color: '#334155' }}>
                                    {selectedOrder.customerPhone || selectedOrder.phone || 'N/A'}
                                </div>
                            </div>
                            {selectedOrder.shippingAddress && (
                                <div>
                                    <span style={labelStyle}>Shipping Address:</span>
                                    <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.4 }}>
                                        {selectedOrder.shippingAddress}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Order References Card */}
                    <div style={detailCardStyle}>
                        <div style={cardHeaderStyle}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                                <path d="M7 15h0M2 9h20"></path>
                            </svg>
                            <h3 style={cardTitleStyle}>Order References</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div>
                                <span style={labelStyle}>Shopify Order ID:</span>
                                <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a', fontFamily: 'monospace' }}>
                                    {selectedOrder.shopifyOrderId || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <span style={labelStyle}>System Order ID:</span>
                                <div style={{ fontSize: '13px', color: '#64748b', fontFamily: 'monospace' }}>
                                    {selectedOrder.orderId || selectedOrder.id}
                                </div>
                            </div>
                            {isAdmin && (
                                <div>
                                    <span style={labelStyle}>Tenant ID:</span>
                                    <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '600', fontFamily: 'monospace' }}>
                                        {selectedOrder.tenantId || 'N/A'}
                                    </div>
                                </div>
                            )}
                            <div>
                                <span style={labelStyle}>Store Domain / ID:</span>
                                <div style={{ fontSize: '13px', color: '#475569' }}>
                                    {selectedOrder.storeId || 'Shopify Store'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Financial Summary Card */}
                    <div style={detailCardStyle}>
                        <div style={cardHeaderStyle}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 6v2m0 8v2"></path>
                            </svg>
                            <h3 style={cardTitleStyle}>Financial Breakdown</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {isAdmin ? (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                        <span style={{ color: '#64748b' }}>Purchase Cost (Supplier):</span>
                                        <span style={{ fontWeight: '600' }}>{formatCurrency(selectedOrder.totalPurchasePrice)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                        <span style={{ color: '#64748b' }}>Base Price (Tenant Cost):</span>
                                        <span style={{ fontWeight: '600' }}>{formatCurrency(selectedOrder.totalBasePrice)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                        <span style={{ color: '#64748b' }}>Customer Selling Price:</span>
                                        <span style={{ fontWeight: '600' }}>{formatCurrency(selectedOrder.totalSellingPrice)}</span>
                                    </div>
                                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>Admin Net Profit:</span>
                                        <span style={{ fontSize: '19px', fontWeight: '800', color: '#16a34a' }}>
                                            {formatCurrency(selectedOrder.totalAdminProfit)}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                        <span style={{ color: '#64748b' }}>Total Base Cost:</span>
                                        <span style={{ fontWeight: '600' }}>{formatCurrency(selectedOrder.totalBasePrice)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                        <span style={{ color: '#64748b' }}>Total Customer Price:</span>
                                        <span style={{ fontWeight: '600' }}>{formatCurrency(selectedOrder.totalSellingPrice)}</span>
                                    </div>
                                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>Your Net Profit:</span>
                                        <span style={{ fontSize: '19px', fontWeight: '800', color: '#16a34a' }}>
                                            {formatCurrency(selectedOrder.totalProfit)}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Ordered Items Table */}
                <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ padding: '16px 24px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                            Order Items ({totalItemsCount} {totalItemsCount === 1 ? 'unit' : 'units'})
                        </h2>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead style={{ backgroundColor: '#f1f5f9' }}>
                                <tr>
                                    <th style={thStyle}>Product</th>
                                    <th style={thStyle}>Code</th>
                                    <th style={thStyle}>Variant</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Quantity</th>
                                    {isAdmin ? (
                                        <>
                                            <th style={thStyle}>Purchase Price</th>
                                            <th style={thStyle}>Base Price</th>
                                            <th style={thStyle}>Selling Price</th>
                                            <th style={{ ...thStyle, color: '#16a34a', textAlign: 'right' }}>Admin Profit</th>
                                        </>
                                    ) : (
                                        <>
                                            <th style={thStyle}>Base Price</th>
                                            <th style={thStyle}>Selling Price</th>
                                            <th style={{ ...thStyle, color: '#16a34a', textAlign: 'right' }}>Your Profit</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {!selectedOrder.items || selectedOrder.items.length === 0 ? (
                                    <tr>
                                        <td colSpan={isAdmin ? 8 : 7} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                                            No item details found for this order.
                                        </td>
                                    </tr>
                                ) : (
                                    selectedOrder.items.map((item, idx) => {
                                        const qty = item.quantity || 1;
                                        const unitBase = item.basePrice || 0;
                                        const unitSelling = item.sellingPrice || 0;
                                        const unitProfit = item.profit !== undefined ? item.profit : (unitSelling - unitBase) * qty;

                                        return (
                                            <tr key={idx} style={{ borderTop: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                                <td style={{ ...tdStyle, fontWeight: '600', color: '#0f172a' }}>
                                                    {item.productName || 'Product'}
                                                </td>
                                                <td style={tdStyle}>
                                                    <span style={{
                                                        padding: '2px 8px',
                                                        borderRadius: '6px',
                                                        backgroundColor: '#f1f5f9',
                                                        fontSize: '12px',
                                                        fontWeight: '700',
                                                        color: '#475569',
                                                        fontFamily: 'monospace'
                                                    }}>
                                                        {item.productCode || 'N/A'}
                                                    </span>
                                                </td>
                                                <td style={tdStyle}>
                                                    {item.variantName && item.variantName !== 'Default Title' ? (
                                                        <span style={{
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            backgroundColor: '#ede9fe',
                                                            color: '#6d28d9',
                                                            fontSize: '12px',
                                                            fontWeight: '600'
                                                        }}>
                                                            {item.variantName}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: '#94a3b8', fontSize: '13px' }}>Standard</span>
                                                    )}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'center', fontWeight: '700', color: '#0f172a' }}>
                                                    {qty}
                                                </td>
                                                {isAdmin ? (
                                                    <>
                                                        <td style={tdStyle}>{formatCurrency(item.purchasePrice)}</td>
                                                        <td style={tdStyle}>{formatCurrency(unitBase)}</td>
                                                        <td style={{ ...tdStyle, fontWeight: '600', color: '#0f172a' }}>{formatCurrency(unitSelling)}</td>
                                                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: '#16a34a' }}>
                                                            {formatCurrency(item.adminProfit !== undefined ? item.adminProfit : 0)}
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td style={tdStyle}>{formatCurrency(unitBase)}</td>
                                                        <td style={{ ...tdStyle, fontWeight: '600', color: '#0f172a' }}>{formatCurrency(unitSelling)}</td>
                                                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: '#16a34a' }}>
                                                            {formatCurrency(unitProfit)}
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Bottom Back Button */}
                <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: '4px' }}>
                    <button
                        onClick={() => setSelectedOrder(null)}
                        style={{
                            padding: '10px 22px',
                            backgroundColor: '#0f172a',
                            color: '#fff',
                            borderRadius: '8px',
                            border: 'none',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                    >
                        ← Back to Orders List
                    </button>
                </div>
            </div>
        );
    }

    // =========================================================================
    // ORDERS LIST TABLE VIEW
    // =========================================================================
    return (
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            {/* Notification Toast */}
            {statusToast.show && (
                <div
                    style={{
                        position: 'fixed',
                        top: '20px',
                        right: '20px',
                        zIndex: 9999,
                        padding: '12px 20px',
                        borderRadius: '10px',
                        backgroundColor: statusToast.isError ? '#ef4444' : '#10b981',
                        color: '#fff',
                        fontWeight: '600',
                        fontSize: '14px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}
                >
                    <span>{statusToast.isError ? '⚠️' : '✓'}</span>
                    {statusToast.text}
                </div>
            )}

            {/* Header + Search bar + Refresh */}
            <div
                style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '16px'
                }}
            >
                <div>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
                        {isAdmin ? 'All Tenant Orders' : 'Your Store Orders'}
                    </h2>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                        Manage orders, track fulfillment status, and view customer breakdowns.
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <input
                        type="text"
                        placeholder="Search order #, customer, product..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            padding: '8px 14px',
                            fontSize: '13px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            outline: 'none',
                            minWidth: '230px'
                        }}
                    />

                    <button
                        onClick={() => setRefreshTrigger((p) => p + 1)}
                        title="Reload live orders"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#fff',
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#475569',
                            cursor: 'pointer'
                        }}
                    >
                        🔄 Refresh
                    </button>

                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', padding: '6px 10px', backgroundColor: '#e2e8f0', borderRadius: '6px' }}>
                        {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'}
                    </span>
                </div>
            </div>

            {/* STATUS FILTER PILLS BAR */}
            <div
                style={{
                    padding: '12px 24px',
                    borderBottom: '1px solid #e2e8f0',
                    backgroundColor: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    overflowX: 'auto',
                    whiteSpace: 'nowrap'
                }}
            >
                {/* ALL TAB */}
                <button
                    onClick={() => setSelectedStatusFilter('ALL')}
                    style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        border: selectedStatusFilter === 'ALL' ? '1px solid #0f172a' : '1px solid #e2e8f0',
                        backgroundColor: selectedStatusFilter === 'ALL' ? '#0f172a' : '#f8fafc',
                        color: selectedStatusFilter === 'ALL' ? '#fff' : '#475569',
                        transition: 'all 0.15s ease'
                    }}
                >
                    All ({statusCounts.ALL})
                </button>

                {/* CANONICAL STATUS TABS */}
                {ORDER_STATUSES.map((st) => {
                    const cfg = STATUS_CONFIG[st];
                    const isSelected = selectedStatusFilter === st;
                    const count = statusCounts[st] || 0;

                    return (
                        <button
                            key={st}
                            onClick={() => setSelectedStatusFilter(st)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 14px',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                border: isSelected ? `1.5px solid ${cfg.color}` : '1px solid #e2e8f0',
                                backgroundColor: isSelected ? cfg.badgeBg : '#fff',
                                color: isSelected ? cfg.color : '#475569',
                                transition: 'all 0.15s ease',
                                boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                            }}
                        >
                            <span>{cfg.icon}</span>
                            <span>{cfg.label}</span>
                            <span
                                style={{
                                    fontSize: '11px',
                                    fontWeight: '800',
                                    padding: '1px 6px',
                                    borderRadius: '10px',
                                    backgroundColor: isSelected ? cfg.bg : '#f1f5f9',
                                    color: isSelected ? cfg.color : '#64748b'
                                }}
                            >
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Orders Table */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: '#f1f5f9' }}>
                        <tr>
                            <th style={thStyle}>Order ID</th>
                            <th style={thStyle}>Date</th>
                            {isAdmin && <th style={thStyle}>Tenant</th>}
                            <th style={thStyle}>Customer</th>
                            <th style={thStyle}>Products</th>
                            <th style={{ ...thStyle, textAlign: 'center' }}>Qty</th>
                            {isAdmin ? (
                                <>
                                    <th style={thStyle}>Purchase Price</th>
                                    <th style={thStyle}>Selling Price</th>
                                    <th style={{ ...thStyle, color: '#16a34a' }}>Profit</th>
                                </>
                            ) : (
                                <>
                                    <th style={thStyle}>Base Price</th>
                                    <th style={thStyle}>Selling Price</th>
                                    <th style={{ ...thStyle, color: '#16a34a' }}>Profit</th>
                                </>
                            )}
                            <th style={thStyle}>Status</th>
                            <th style={{ ...thStyle, textAlign: 'center' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredOrders.length === 0 ? (
                            <tr>
                                <td colSpan={isAdmin ? 11 : 10} style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📦</div>
                                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b' }}>
                                        {searchQuery || selectedStatusFilter !== 'ALL'
                                            ? 'No orders match your filter criteria.'
                                            : 'No orders recorded yet.'}
                                    </div>
                                    {(searchQuery || selectedStatusFilter !== 'ALL') && (
                                        <button
                                            onClick={() => {
                                                setSearchQuery('');
                                                setSelectedStatusFilter('ALL');
                                            }}
                                            style={{
                                                marginTop: '12px',
                                                padding: '6px 14px',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                backgroundColor: '#fff',
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                color: '#3b82f6'
                                            }}
                                        >
                                            Reset Filters
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ) : (
                            filteredOrders.map((order, i) => {
                                const totalQty = order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || (order.quantity || 1);
                                const normStatus = normalizeStatus(order.status);
                                const isRowUpdating = statusUpdatingId === order.id;

                                return (
                                    <tr
                                        key={order.id}
                                        onClick={() => setSelectedOrder(order)}
                                        style={{
                                            borderTop: '1px solid #e2e8f0',
                                            backgroundColor: i % 2 === 0 ? '#fff' : '#f8fafc',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.15s ease'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = i % 2 === 0 ? '#fff' : '#f8fafc'; }}
                                    >
                                        <td style={{ ...tdStyle, fontWeight: '700', color: '#2563eb' }}>
                                            #{order.orderNumber || 'N/A'}
                                        </td>
                                        <td style={{ ...tdStyle, fontSize: '12px', color: '#64748b' }}>
                                            {formatDate(order.createdAt)}
                                        </td>
                                        {isAdmin && (
                                            <td style={tdStyle} title={order.tenantId}>
                                                <span style={{ fontFamily: 'monospace', fontSize: '12px', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                                                    {order.tenantId?.substring(0, 8)}...
                                                </span>
                                            </td>
                                        )}
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: '600', color: '#0f172a' }}>{order.customerName || 'N/A'}</div>
                                            {order.customerEmail && (
                                                <div style={{ fontSize: '12px', color: '#64748b' }}>{order.customerEmail}</div>
                                            )}
                                        </td>
                                        <td style={tdStyle}>
                                            {order.items && order.items.length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                    {order.items.slice(0, 2).map((item, idx) => (
                                                        <div key={idx} style={{ fontSize: '13px', whiteSpace: 'normal', maxWidth: '270px' }}>
                                                            <strong>{item.productCode}</strong> - {item.productName}
                                                            {item.variantName && item.variantName !== 'Default Title' ? ` (${item.variantName})` : ''}
                                                            <span style={{ color: '#64748b', fontWeight: '600' }}> x{item.quantity || 1}</span>
                                                        </div>
                                                    ))}
                                                    {order.items.length > 2 && (
                                                        <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '600' }}>
                                                            +{order.items.length - 2} more item{order.items.length - 2 > 1 ? 's' : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span style={{ color: '#94a3b8' }}>No items</span>
                                            )}
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: '700' }}>{totalQty}</td>
                                        {isAdmin ? (
                                            <>
                                                <td style={tdStyle}>{formatCurrency(order.totalPurchasePrice)}</td>
                                                <td style={{ ...tdStyle, fontWeight: '600', color: '#0f172a' }}>{formatCurrency(order.totalSellingPrice)}</td>
                                                <td style={{ ...tdStyle, fontWeight: '700', color: '#16a34a' }}>{formatCurrency(order.totalAdminProfit)}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td style={tdStyle}>{formatCurrency(order.totalBasePrice)}</td>
                                                <td style={{ ...tdStyle, fontWeight: '600', color: '#0f172a' }}>{formatCurrency(order.totalSellingPrice)}</td>
                                                <td style={{ ...tdStyle, fontWeight: '700', color: '#16a34a' }}>{formatCurrency(order.totalProfit)}</td>
                                            </>
                                        )}

                                        {/* INLINE STATUS SELECTOR & BADGE */}
                                        <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                {renderStatusBadge(normStatus, 'small')}
                                                <select
                                                    value={normStatus}
                                                    disabled={isRowUpdating}
                                                    onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                                                    style={{
                                                        fontSize: '11px',
                                                        fontWeight: '600',
                                                        padding: '3px 6px',
                                                        borderRadius: '6px',
                                                        border: '1px solid #cbd5e1',
                                                        backgroundColor: '#fff',
                                                        color: '#334155',
                                                        cursor: isRowUpdating ? 'not-allowed' : 'pointer',
                                                        outline: 'none'
                                                    }}
                                                >
                                                    {ORDER_STATUSES.map((st) => (
                                                        <option key={st} value={st}>
                                                            {STATUS_CONFIG[st].icon} {st}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </td>

                                        {/* ACTION */}
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedOrder(order);
                                                }}
                                                style={{
                                                    padding: '6px 14px',
                                                    fontSize: '12px',
                                                    fontWeight: '700',
                                                    borderRadius: '6px',
                                                    backgroundColor: '#eff6ff',
                                                    color: '#2563eb',
                                                    border: '1px solid #bfdbfe',
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                View Info →
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const thStyle = {
    padding: '12px 18px',
    fontSize: '12px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap'
};

const tdStyle = {
    padding: '14px 18px',
    fontSize: '13px',
    color: '#475569',
    whiteSpace: 'nowrap'
};

const detailCardStyle = {
    backgroundColor: '#fff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '22px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
};

const cardHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderBottom: '1px solid #f1f5f9',
    paddingBottom: '12px',
    marginBottom: '4px'
};

const cardTitleStyle = {
    margin: 0,
    fontSize: '15px',
    fontWeight: '700',
    color: '#0f172a'
};

const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: '700',
    color: '#64748b',
    marginBottom: '2px',
    textTransform: 'uppercase',
    letterSpacing: '0.03em'
};
