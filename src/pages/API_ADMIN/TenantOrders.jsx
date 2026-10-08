import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function TenantOrders({ tenantId, isAdmin = false }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchOrders = async () => {
            setLoading(true);
            try {
                let ordersQuery;
                if (isAdmin) {
                    // Admin ला सर्व Tenants च्या ऑर्डर्स दिसतील
                    ordersQuery = query(collection(db, 'apiTenantOrders'));
                } else {
                    // Tenant ला फक्त स्वतःच्या ऑर्डर्स दिसतील
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

                // Latest ऑर्डर्स वरती दिसाव्यात म्हणून Sorting
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

    if (loading) return <div className="p-4 text-gray-600">Loading orders...</div>;
    if (error) return <div className="p-4 text-red-500">{error}</div>;

    return (
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#0f172a' }}>
                    {isAdmin ? 'All Tenant Orders' : 'Your Orders'}
                </h2>
            </div>
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
                                    <th style={{...thStyle, color: '#16a34a'}}>Profit</th>
                                </>
                            ) : (
                                <>
                                    <th style={thStyle}>Base Price</th>
                                    <th style={thStyle}>Selling Price</th>
                                    <th style={{...thStyle, color: '#16a34a'}}>Profit</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {orders.length === 0 ? (
                            <tr>
                                <td colSpan={isAdmin ? 8 : 7} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                                    No orders found. (Debug: Search tenantId = {tenantId})
                                </td>
                            </tr>
                        ) : (
                            orders.map((order, i) => {
                                const totalQty = order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || (order.quantity || 1);
                                return (
                                    <tr key={order.id} style={{ borderTop: '1px solid #e2e8f0', backgroundColor: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                        <td style={tdStyle}>#{order.orderNumber || 'N/A'}</td>
                                        {isAdmin && <td style={tdStyle} title={order.tenantId}>{order.tenantId?.substring(0, 8)}...</td>}
                                        <td style={tdStyle}>{order.customerName || 'N/A'}</td>
                                        <td style={tdStyle}>
                                            {order.items && order.items.length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {order.items.map((item, idx) => (
                                                        <div key={idx} style={{ fontSize: '13px', whiteSpace: 'normal', maxWidth: '300px' }}>
                                                            <strong>{item.productCode}</strong> - {item.productName} 
                                                            {item.variantName && item.variantName !== 'Default Title' ? ` (${item.variantName})` : ''} 
                                                            <span style={{ color: '#64748b', fontWeight: '500' }}> x{item.quantity || 1}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span style={{ color: '#94a3b8' }}>No items</span>
                                            )}
                                        </td>
                                        <td style={tdStyle}>{totalQty}</td>
                                        {isAdmin ? (
                                            <>
                                                <td style={tdStyle}>₹{order.totalPurchasePrice || 0}</td>
                                                <td style={{...tdStyle, fontWeight: '500', color: '#0f172a'}}>₹{order.totalBasePrice}</td>
                                                <td style={{...tdStyle, fontWeight: '600', color: '#16a34a'}}>₹{order.totalAdminProfit || 0}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td style={tdStyle}>₹{order.totalBasePrice}</td>
                                                <td style={{...tdStyle, fontWeight: '500', color: '#0f172a'}}>₹{order.totalSellingPrice}</td>
                                                <td style={{...tdStyle, fontWeight: '600', color: '#16a34a'}}>₹{order.totalProfit}</td>
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
    );
}

const thStyle = {
    padding: '12px 24px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
};

const tdStyle = {
    padding: '16px 24px',
    fontSize: '14px',
    color: '#475569',
    whiteSpace: 'nowrap'
};
