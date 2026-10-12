import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function TenantOrders({ tenantId, isAdmin = false }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchOrders = async () => {
            setLoading(true);
            try {
                let ordersQuery;
                if (isAdmin) {
                    // Admin can see all tenant orders
                    ordersQuery = query(collection(db, 'apiTenantOrders'));
                } else {
                    // Tenant sees only their own orders
                    if (!tenantId) return;
                    ordersQuery = query(
                        collection(db, 'apiTenantOrders'),
                        where('tenantId', 'in', [tenantId, 'g0usC1NMyehaoSKJRhOqUUhZAO62'])
                    );
                }

                const querySnapshot = await getDocs(ordersQuery);
                const fetchedOrders = [];
                querySnapshot.forEach((doc) => {
                    fetchedOrders.push({ id: doc.id, ...doc.data() });
                });

                // Latest orders first
                fetchedOrders.sort((a, b) => {
                    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                    return timeB - timeA;
                });

                setOrders(fetchedOrders);
            } catch (err) {
                console.error("Error fetching orders:", err);
                setError('Failed to fetch orders.');
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, [tenantId, isAdmin]);

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

    if (loading) {
        return (
            <div style={{ padding: '32px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
                <div style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid #cbd5e1', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <p style={{ marginTop: '12px', fontSize: '14px', fontWeight: '500' }}>Loading orders...</p>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '24px', backgroundColor: '#fef2f2', borderRadius: '12px', border: '1px solid #fecaca', color: '#dc2626' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Error Loading Orders</h3>
                <p style={{ margin: '8px 0 0', fontSize: '14px' }}>{error}</p>
            </div>
        );
    }

    // =========================================================================
    // FULL ORDER DETAILS VIEW
    // =========================================================================
    if (selectedOrder) {
        const totalItemsCount = selectedOrder.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || (selectedOrder.quantity || 1);
        const status = selectedOrder.status || 'NEW';

        const getStatusBadge = (st) => {
            const normalized = (st || '').toUpperCase();
            let bg = '#eff6ff';
            let color = '#2563eb';
            let border = '#bfdbfe';

            if (normalized === 'COMPLETED' || normalized === 'PAID' || normalized === 'FULFILLED') {
                bg = '#ecfdf5';
                color = '#059669';
                border = '#a7f3d0';
            } else if (normalized === 'PROCESSING' || normalized === 'PENDING') {
                bg = '#fffbeb';
                color = '#d97706';
                border = '#fde68a';
            } else if (normalized === 'CANCELLED' || normalized === 'FAILED') {
                bg = '#fef2f2';
                color = '#dc2626';
                border = '#fecaca';
            }

            return (
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: '700',
                    letterSpacing: '0.04em',
                    backgroundColor: bg,
                    color: color,
                    border: `1px solid ${border}`
                }}>
                    ● {st}
                </span>
            );
        };

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Back Button & Top Navigation Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <button
                        onClick={() => setSelectedOrder(null)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 16px',
                            backgroundColor: '#fff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            color: '#334155',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
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
                                padding: '8px 14px',
                                backgroundColor: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                color: '#475569',
                                fontSize: '13px',
                                fontWeight: '500',
                                cursor: 'pointer'
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
                <div style={{
                    backgroundColor: '#fff',
                    borderRadius: '12px',
                    padding: '24px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px'
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>
                                Order #{selectedOrder.orderNumber || 'N/A'}
                            </h1>
                            {getStatusBadge(status)}
                        </div>
                        <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>
                            Placed on {formatDate(selectedOrder.createdAt)}
                        </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
                            {isAdmin ? 'Total Selling Price' : 'Order Total (Selling Price)'}
                        </span>
                        <div style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a' }}>
                            {formatCurrency(selectedOrder.totalSellingPrice)}
                        </div>
                    </div>
                </div>

                {/* Info Cards Grid (3 Columns) */}
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div>
                                <span style={labelStyle}>Customer Name:</span>
                                <div style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a' }}>
                                    {selectedOrder.customerName || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <span style={labelStyle}>Customer Email:</span>
                                <div style={{ fontSize: '14px', color: '#334155', wordBreak: 'break-all' }}>
                                    {selectedOrder.customerEmail || 'No email provided'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Order Reference Card */}
                    <div style={detailCardStyle}>
                        <div style={cardHeaderStyle}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                                <path d="M7 15h0M2 9h20"></path>
                            </svg>
                            <h3 style={cardTitleStyle}>Order References</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                                        <span style={{ fontWeight: '500' }}>{formatCurrency(selectedOrder.totalPurchasePrice)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                        <span style={{ color: '#64748b' }}>Base Price (Tenant Cost):</span>
                                        <span style={{ fontWeight: '500' }}>{formatCurrency(selectedOrder.totalBasePrice)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                        <span style={{ color: '#64748b' }}>Customer Selling Price:</span>
                                        <span style={{ fontWeight: '500' }}>{formatCurrency(selectedOrder.totalSellingPrice)}</span>
                                    </div>
                                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '14px' }}>Admin Net Profit:</span>
                                        <span style={{ fontSize: '18px', fontWeight: '800', color: '#16a34a' }}>
                                            {formatCurrency(selectedOrder.totalAdminProfit)}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                        <span style={{ color: '#64748b' }}>Total Base Cost:</span>
                                        <span style={{ fontWeight: '500' }}>{formatCurrency(selectedOrder.totalBasePrice)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                        <span style={{ color: '#64748b' }}>Total Customer Price:</span>
                                        <span style={{ fontWeight: '500' }}>{formatCurrency(selectedOrder.totalSellingPrice)}</span>
                                    </div>
                                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '14px' }}>Your Net Profit:</span>
                                        <span style={{ fontSize: '18px', fontWeight: '800', color: '#16a34a' }}>
                                            {formatCurrency(selectedOrder.totalProfit)}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Ordered Items Table */}
                <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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
                                        <td colSpan={isAdmin ? 8 : 7} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
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
                                                        fontWeight: '600',
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
                                                            fontWeight: '500'
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
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <button
                        onClick={() => setSelectedOrder(null)}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#0f172a',
                            color: '#fff',
                            borderRadius: '8px',
                            border: 'none',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer'
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
    const filteredOrders = orders.filter((o) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        const num = (o.orderNumber || '').toLowerCase();
        const cust = (o.customerName || '').toLowerCase();
        const email = (o.customerEmail || '').toLowerCase();
        const code = o.items?.some(i => (i.productCode || '').toLowerCase().includes(q));
        return num.includes(q) || cust.includes(q) || email.includes(q) || code;
    });

    return (
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            {/* Header + Search bar */}
            <div style={{
                padding: '18px 24px',
                borderBottom: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                        {isAdmin ? 'All Tenant Orders' : 'Your Orders'}
                    </h2>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                        Click on any order to view its full details and breakdown.
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                        type="text"
                        placeholder="Search order #, customer..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            padding: '8px 14px',
                            fontSize: '13px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            outline: 'none',
                            minWidth: '220px'
                        }}
                    />
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                        {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'}
                    </span>
                </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: '#f1f5f9' }}>
                        <tr>
                            <th style={thStyle}>Order ID</th>
                            {isAdmin && <th style={thStyle}>Tenant ID</th>}
                            <th style={thStyle}>Customer</th>
                            <th style={thStyle}>Products</th>
                            <th style={thStyle}>Qty</th>
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
                            <th style={{ ...thStyle, textAlign: 'center' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredOrders.length === 0 ? (
                            <tr>
                                <td colSpan={isAdmin ? 9 : 8} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                                    {searchQuery ? 'No matching orders found.' : 'No orders found.'}
                                </td>
                            </tr>
                        ) : (
                            filteredOrders.map((order, i) => {
                                const totalQty = order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || (order.quantity || 1);
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
                                        {isAdmin && (
                                            <td style={tdStyle} title={order.tenantId}>
                                                <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
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
                                                        <div key={idx} style={{ fontSize: '13px', whiteSpace: 'normal', maxWidth: '280px' }}>
                                                            <strong>{item.productCode}</strong> - {item.productName}
                                                            {item.variantName && item.variantName !== 'Default Title' ? ` (${item.variantName})` : ''}
                                                            <span style={{ color: '#64748b', fontWeight: '500' }}> x{item.quantity || 1}</span>
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
                                        <td style={{ ...tdStyle, fontWeight: '600' }}>{totalQty}</td>
                                        {isAdmin ? (
                                            <>
                                                <td style={tdStyle}>{formatCurrency(order.totalPurchasePrice)}</td>
                                                <td style={{ ...tdStyle, fontWeight: '600', color: '#0f172a' }}>{formatCurrency(order.totalBasePrice)}</td>
                                                <td style={{ ...tdStyle, fontWeight: '700', color: '#16a34a' }}>{formatCurrency(order.totalAdminProfit)}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td style={tdStyle}>{formatCurrency(order.totalBasePrice)}</td>
                                                <td style={{ ...tdStyle, fontWeight: '600', color: '#0f172a' }}>{formatCurrency(order.totalSellingPrice)}</td>
                                                <td style={{ ...tdStyle, fontWeight: '700', color: '#16a34a' }}>{formatCurrency(order.totalProfit)}</td>
                                            </>
                                        )}
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedOrder(order);
                                                }}
                                                style={{
                                                    padding: '6px 12px',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    borderRadius: '6px',
                                                    backgroundColor: '#eff6ff',
                                                    color: '#2563eb',
                                                    border: '1px solid #bfdbfe',
                                                    cursor: 'pointer'
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
    padding: '12px 20px',
    fontSize: '12px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
};

const tdStyle = {
    padding: '14px 20px',
    fontSize: '14px',
    color: '#475569',
    whiteSpace: 'nowrap'
};

const detailCardStyle = {
    backgroundColor: '#fff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
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
    fontWeight: '600',
    color: '#64748b',
    marginBottom: '2px',
    textTransform: 'uppercase',
    letterSpacing: '0.03em'
};

