import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, onSnapshot, collectionGroup } from 'firebase/firestore';
import { API_BASE, apiFetch } from './adminAuth';

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

export default function TenantOrders({ tenantId, isAdmin = false, tenants = [] }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
    const [selectedTenantFilter, setSelectedTenantFilter] = useState('ALL');
    const [selectedDateFilter, setSelectedDateFilter] = useState('');
    const [statusUpdatingId, setStatusUpdatingId] = useState(null);
    const [statusToast, setStatusToast] = useState({ show: false, text: '', isError: false });
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [copiedField, setCopiedField] = useState(null);

    // Confirmation Status Modal state
    const [statusConfirmModal, setStatusConfirmModal] = useState({
        show: false,
        order: null,
        targetStatus: '',
        currentStatus: ''
    });

    // Map tenant information for lookup by tenantId or code
    const tenantInfoMap = useMemo(() => {
        const map = {
            'g0usC1NMyehaoSKJRhOqUUhZAO62': {
                name: 'Kiyuziyu Store',
                code: 'KIYU-STORE',
                email: 'store@kiyuziyu.com'
            }
        };
        (tenants || []).forEach((t) => {
            if (!t) return;
            const info = {
                name: t.name || t.fullName || t.tenantName || 'Tenant',
                code: t.code || t.tenantCode || '',
                email: t.ownerEmail || t.email || ''
            };
            if (t.id) map[t.id] = info;
            if (t.tenantId) map[t.tenantId] = info;
            if (t.ownerUserId) map[t.ownerUserId] = info;
            if (t.code) map[t.code] = info;
        });
        return map;
    }, [tenants]);

    const getTenantDisplay = useCallback((order) => {
        if (!order) return { name: 'Unknown', code: '', id: '' };
        const tId = order.tenantId || '';
        const mapped = tId ? tenantInfoMap[tId] : null;
        const name = order.tenantName || mapped?.name || order.storeName || (tId ? (mapped?.name || `${tId.substring(0, 8)}...`) : 'Tenant');
        const code = order.tenantCode || mapped?.code || '';
        return { name, code, id: tId };
    }, [tenantInfoMap]);

    // Available tenants for filter dropdown
    const availableTenants = useMemo(() => {
        const map = new Map();
        (tenants || []).forEach((t) => {
            if (t && (t.id || t.tenantId)) {
                const id = t.id || t.tenantId;
                map.set(id, {
                    id,
                    name: t.name || t.fullName || 'Tenant',
                    code: t.code || ''
                });
            }
        });
        orders.forEach((o) => {
            if (o.tenantId && !map.has(o.tenantId)) {
                const info = tenantInfoMap[o.tenantId];
                map.set(o.tenantId, {
                    id: o.tenantId,
                    name: info?.name || o.tenantName || o.storeName || `Tenant (${o.tenantId.substring(0, 6)}...)`,
                    code: info?.code || o.tenantCode || ''
                });
            }
        });
        return Array.from(map.values());
    }, [tenants, orders, tenantInfoMap]);

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
                    if (tenantId !== 'tenant_7802bd5e01fb') {
                        tenantIds.push('tenant_7802bd5e01fb');
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
                        const rawList = [];
                        snapshot.forEach((doc) => {
                            const data = doc.data();
                            rawList.push({
                                id: doc.id,
                                ...data,
                                status: normalizeStatus(data.status)
                            });
                        });

                        // Sort newest orders first
                        rawList.sort((a, b) => {
                            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                            return timeB - timeA;
                        });

                        // Deduplicate by shopifyOrderId or orderNumber so duplicate Firestore documents don't duplicate rows
                        const seenKeys = new Set();
                        const fetched = [];
                        for (const item of rawList) {
                            const dedupKey = item.shopifyOrderId ? `shopify_${item.shopifyOrderId}` : (item.orderNumber ? `order_${item.orderNumber}` : item.id);
                            if (!seenKeys.has(dedupKey)) {
                                seenKeys.add(dedupKey);
                                fetched.push(item);
                            }
                        }

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

                            const rawList = [];
                            snap.forEach((doc) => {
                                const data = doc.data();
                                if (isAdmin || !tenantId || data.tenantId === tenantId || data.tenantId === 'g0usC1NMyehaoSKJRhOqUUhZAO62' || data.tenantId === 'tenant_7802bd5e01fb') {
                                    rawList.push({
                                        id: doc.id,
                                        ...data,
                                        status: normalizeStatus(data.status)
                                    });
                                }
                            });

                            rawList.sort((a, b) => {
                                const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                                const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                                return timeB - timeA;
                            });

                            const seenKeys = new Set();
                            const fetched = [];
                            for (const item of rawList) {
                                const dedupKey = item.shopifyOrderId ? `shopify_${item.shopifyOrderId}` : (item.orderNumber ? `order_${item.orderNumber}` : item.id);
                                if (!seenKeys.has(dedupKey)) {
                                    seenKeys.add(dedupKey);
                                    fetched.push(item);
                                }
                            }

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
    // =========================================================================
    // RESTORE INVENTORY ON ORDER CANCELLATION
    // =========================================================================
    const restoreInventoryOnCancellation = async (order) => {
        if (!order || !order.items || order.items.length === 0) return 0;
        if (order.inventoryRestored) {
            console.log(`[Inventory] Order ${order.orderNumber || order.id} stock was already restored previously.`);
            return 0;
        }

        let totalUnitsRestored = 0;

        // 1. Try Backend Spring Boot Endpoint First (Instant Admin SDK execution)
        try {
            const apiRes = await apiFetch(`${API_BASE}/api/v1/tenants/orders/${order.id}/cancel-and-restore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (apiRes.ok) {
                const data = await apiRes.json();
                if (data.success) {
                    console.log(`[Inventory Backend] Successfully restored ${data.restoredUnits} units for order ${order.orderNumber || order.id}`);
                    return data.restoredUnits || 1;
                }
            }
        } catch (backendErr) {
            console.warn('[Inventory Backend] Backend cancel endpoint skipped or unreachable, falling back to direct Firestore:', backendErr);
        }

        // 2. Client-Side Direct Firestore Restoration
        try {
            for (const item of order.items) {
                const productCode = item.productCode || item.code;
                const qtyToRestore = Number(item.quantity || 1);
                if (qtyToRestore <= 0) continue;

                let targetDocs = [];

                // Path A: Direct collection & subcollection path if stored on item
                if (item.collectionId && item.subcollectionId && item.productId) {
                    try {
                        const directRef = doc(db, 'collections', item.collectionId, 'subcollections', item.subcollectionId, 'products', item.productId);
                        const directSnap = await getDoc(directRef);
                        if (directSnap.exists()) {
                            targetDocs.push(directSnap);
                        }
                    } catch (dErr) {
                        console.warn('Direct path fetch error:', dErr);
                    }
                }

                // Path B: Query collectionGroup if path not available
                if (targetDocs.length === 0 && productCode) {
                    try {
                        const pQuery = query(collectionGroup(db, 'products'), where('productCode', '==', productCode));
                        const pSnap = await getDocs(pQuery);
                        if (!pSnap.empty) {
                            targetDocs = pSnap.docs;
                        }
                    } catch (cgErr) {
                        console.warn('collectionGroup query failed:', cgErr);
                    }
                }

                // Process found product documents
                for (const pDoc of targetDocs) {
                    const pData = pDoc.data();
                    let updated = false;
                    const updates = {};

                    // 1. Update variation quantity
                    if (pData.variations && Array.isArray(pData.variations) && pData.variations.length > 0) {
                        const newVariations = pData.variations.map((v, idx) => {
                            let match = false;
                            const itemSku = String(item.sku || item.productCode || '').trim();
                            const vSku = String(v.sku || '').trim();
                            if (vSku && itemSku && vSku.toLowerCase() === itemSku.toLowerCase()) {
                                match = true;
                            }
                            if (!match && item.variantId) {
                                const vVarId = String(v.shopifyVariantId || v.variantId || v.shopify_variant_id || v.id || '').trim();
                                const targetVarId = String(item.variantId).includes('/') ? String(item.variantId).substring(String(item.variantId).lastIndexOf('/') + 1) : String(item.variantId);
                                if (vVarId && (vVarId === targetVarId || vVarId.endsWith('/' + targetVarId))) {
                                    match = true;
                                }
                            }
                            if (!match && item.sku && item.sku.includes('-')) {
                                const lastDash = item.sku.lastIndexOf('-');
                                const suffix = item.sku.substring(lastDash + 1).trim();
                                const variantIdx = parseInt(suffix, 10) - 1;
                                if (variantIdx === idx) match = true;
                            }
                            if (!match && (item.variantName || item.variantDetails)) {
                                const targetName = String(item.variantName || item.variantDetails || '').trim().toLowerCase();
                                if (
                                    String(v.name || '').trim().toLowerCase() === targetName || 
                                    String(v.color || '').trim().toLowerCase() === targetName || 
                                    String(v.title || '').trim().toLowerCase() === targetName ||
                                    String(v.variantName || '').trim().toLowerCase() === targetName ||
                                    (v.color && v.size && `${v.color} / ${v.size}`.toLowerCase() === targetName)
                                ) {
                                    match = true;
                                }
                            }
                            if (match) {
                                updated = true;
                                const currentQty = Number(v.quantity ?? v.initialQuantity ?? 0);
                                const restoredQty = currentQty + qtyToRestore;
                                totalUnitsRestored += qtyToRestore;
                                console.log(`[Inventory Restored] Variant "${v.color || v.name || idx}" ${currentQty} -> ${restoredQty}`);
                                return { ...v, quantity: restoredQty };
                            }
                            return v;
                        });

                        if (updated) {
                            updates.variations = newVariations;
                            // Recalculate root quantity as sum of variations
                            if (pData.quantity !== undefined || pData.stock !== undefined) {
                                const totalVarStock = newVariations.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);
                                if (pData.quantity !== undefined) updates.quantity = totalVarStock;
                                if (pData.stock !== undefined) updates.stock = totalVarStock;
                            }
                        }
                    }

                    // 2. Update root quantity if non-variant or not already updated
                    if (!updated && (pData.quantity !== undefined || pData.stock !== undefined)) {
                        const rootField = pData.quantity !== undefined ? 'quantity' : 'stock';
                        const curQ = Number(pData[rootField] || 0);
                        updates[rootField] = curQ + qtyToRestore;
                        updated = true;
                        totalUnitsRestored += qtyToRestore;
                    }

                    if (updated) {
                        await updateDoc(doc(db, pDoc.ref.path), updates);
                    }
                }
            }

            // Mark order doc as inventoryRestored: true
            const orderDocRef = doc(db, 'apiTenantOrders', order.id);
            await updateDoc(orderDocRef, { inventoryRestored: true });
        } catch (err) {
            console.error('Error restoring inventory for cancelled order:', err);
        }
        return totalUnitsRestored;
    };

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

            // If status is changed to Cancelled, restore stock quantity for product & variant in Firebase
            let restoredUnits = 0;
            if (newStatus === 'Cancelled') {
                const targetOrder = orders.find((o) => o.id === orderId) || (selectedOrder?.id === orderId ? selectedOrder : null);
                if (targetOrder) {
                    restoredUnits = await restoreInventoryOnCancellation(targetOrder);
                }
            }

            // Optimistic update local state
            setOrders((prev) =>
                prev.map((o) => (o.id === orderId ? { ...o, status: newStatus, updatedAt: nowIso, ...(newStatus === 'Cancelled' ? { inventoryRestored: true } : {}) } : o))
            );
            setSelectedOrder((prev) =>
                prev && prev.id === orderId ? { ...prev, status: newStatus, updatedAt: nowIso, ...(newStatus === 'Cancelled' ? { inventoryRestored: true } : {}) } : prev
            );

            if (newStatus === 'Cancelled') {
                showToast(`Order Cancelled. ${restoredUnits > 0 ? `Restored +${restoredUnits} units to Firebase inventory!` : 'Inventory updated.'}`, false);
            } else {
                showToast(`Order status updated to "${newStatus}"!`, false);
            }
        } catch (err) {
            console.error('Error updating order status:', err);
            showToast(`Failed to update status: ${err.message || 'Error'}`, true);
        } finally {
            setStatusUpdatingId(null);
        }
    };

    // Open confirmation status popup
    const openStatusPickerModal = (order, preselectedStatus = null) => {
        if (!order) return;
        const current = normalizeStatus(order.status);
        let nextDefault = preselectedStatus;
        if (!nextDefault) {
            const currentIdx = ORDER_STATUSES.indexOf(current);
            if (currentIdx >= 0 && currentIdx < ORDER_STATUSES.length - 2) {
                nextDefault = ORDER_STATUSES[currentIdx + 1];
            } else {
                nextDefault = current;
            }
        }
        setStatusConfirmModal({
            show: true,
            order,
            selectedStatus: nextDefault,
            currentStatus: current,
            saving: false
        });
    };

    const handleSelectStatusInModal = (status) => {
        setStatusConfirmModal((prev) => ({
            ...prev,
            selectedStatus: status
        }));
    };

    const handleConfirmStatusChange = async () => {
        if (!statusConfirmModal.order || !statusConfirmModal.selectedStatus) return;
        const orderId = statusConfirmModal.order.id;
        const newStatus = statusConfirmModal.selectedStatus;
        if (newStatus === statusConfirmModal.currentStatus) {
            setStatusConfirmModal({ show: false, order: null, selectedStatus: '', currentStatus: '', saving: false });
            return;
        }
        setStatusConfirmModal((prev) => ({ ...prev, saving: true }));
        await handleUpdateStatus(orderId, newStatus);
        setStatusConfirmModal({ show: false, order: null, selectedStatus: '', currentStatus: '', saving: false });
    };

    const handleCancelStatusChange = () => {
        setStatusConfirmModal({ show: false, order: null, selectedStatus: '', currentStatus: '', saving: false });
    };

    // Render Confirmation Status Modal (usable in both Order Details and Table View)
    const renderConfirmationModal = () => {
        if (!statusConfirmModal.show || !statusConfirmModal.order) return null;
        return (
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(5px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 99999,
                    padding: '16px'
                }}
                onClick={handleCancelStatusChange}
            >
                <div
                    style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        maxWidth: '500px',
                        width: '100%',
                        padding: '26px 28px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        border: '1px solid #e2e8f0',
                        position: 'relative',
                        animation: 'fadeIn 0.15s ease-out'
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                                style={{
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '12px',
                                    backgroundColor: statusConfirmModal.selectedStatus === 'Cancelled' ? '#fef2f2' : '#eff6ff',
                                    color: statusConfirmModal.selectedStatus === 'Cancelled' ? '#dc2626' : '#2563eb',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '22px',
                                    flexShrink: 0
                                }}
                            >
                                {statusConfirmModal.selectedStatus === 'Cancelled' ? '⚠️' : '🏷️'}
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                                    Confirm Status Change
                                </h3>
                                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>
                                    Order #{statusConfirmModal.order.orderNumber || statusConfirmModal.order.id}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleCancelStatusChange}
                            style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '20px',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                padding: '4px',
                                lineHeight: 1
                            }}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Status Selection Cards */}
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                        Select Target Status:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '16px' }}>
                        {ORDER_STATUSES.map((st) => {
                            const cfg = STATUS_CONFIG[st];
                            const isSelected = statusConfirmModal.selectedStatus === st;
                            const isCurrent = statusConfirmModal.currentStatus === st;

                            return (
                                <div
                                    key={st}
                                    onClick={() => handleSelectStatusInModal(st)}
                                    style={{
                                        padding: '10px 12px',
                                        borderRadius: '10px',
                                        border: isSelected ? `2px solid ${cfg.color}` : '1.5px solid #e2e8f0',
                                        backgroundColor: isSelected ? cfg.badgeBg : '#ffffff',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        transition: 'all 0.15s ease',
                                        boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '15px' }}>{cfg.icon}</span>
                                        <div>
                                            <div style={{ fontSize: '12px', fontWeight: isSelected ? '800' : '600', color: isSelected ? cfg.color : '#1e293b' }}>
                                                {st}
                                            </div>
                                            {isCurrent && (
                                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '500' }}>
                                                    (Current)
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {isSelected && (
                                        <span style={{ color: cfg.color, fontWeight: '800', fontSize: '14px' }}>✓</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Confirmation Alert Message Box */}
                    <div style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        backgroundColor: statusConfirmModal.selectedStatus === 'Cancelled' ? '#fef2f2' : (statusConfirmModal.selectedStatus === statusConfirmModal.currentStatus ? '#f8fafc' : '#f0fdf4'),
                        border: `1px solid ${statusConfirmModal.selectedStatus === 'Cancelled' ? '#fecaca' : (statusConfirmModal.selectedStatus === statusConfirmModal.currentStatus ? '#e2e8f0' : '#bbf7d0')}`,
                        marginBottom: '20px'
                    }}>
                        {statusConfirmModal.selectedStatus === statusConfirmModal.currentStatus ? (
                            <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
                                ℹ️ Order is currently already in <strong>{statusConfirmModal.selectedStatus}</strong> status. Select a different status above to change.
                            </p>
                        ) : statusConfirmModal.selectedStatus === 'Cancelled' ? (
                            <div style={{ fontSize: '12px', color: '#991b1b', lineHeight: '1.5' }}>
                                <strong>⚠️ Stock Restoration & Revenue Notice:</strong>
                                <p style={{ margin: '3px 0 0' }}>
                                    Cancelling this order will immediately restore all variant stock quantities in Firebase inventory, and exclude this order's amount from platform sales and profit calculations.
                                </p>
                            </div>
                        ) : statusConfirmModal.selectedStatus === 'Delivered' ? (
                            <p style={{ margin: 0, fontSize: '12.5px', color: '#15803d', lineHeight: '1.5' }}>
                                ✅ Are you sure you want to mark this order as <strong>Delivered</strong>? This will complete the customer fulfillment lifecycle.
                            </p>
                        ) : (
                            <p style={{ margin: 0, fontSize: '12.5px', color: '#15803d', lineHeight: '1.5' }}>
                                ✅ Are you sure you want to update this order status from <strong>{statusConfirmModal.currentStatus}</strong> to <strong>{statusConfirmModal.selectedStatus}</strong>?
                            </p>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={handleCancelStatusChange}
                            style={{
                                padding: '9px 18px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: '#475569',
                                fontSize: '13px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'background-color 0.15s ease'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={statusConfirmModal.saving || statusConfirmModal.selectedStatus === statusConfirmModal.currentStatus}
                            onClick={handleConfirmStatusChange}
                            style={{
                                padding: '9px 22px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: statusConfirmModal.selectedStatus === 'Cancelled' ? '#dc2626' : '#2563eb',
                                color: '#ffffff',
                                fontSize: '13px',
                                fontWeight: '700',
                                cursor: (statusConfirmModal.saving || statusConfirmModal.selectedStatus === statusConfirmModal.currentStatus) ? 'not-allowed' : 'pointer',
                                opacity: statusConfirmModal.selectedStatus === statusConfirmModal.currentStatus ? 0.45 : 1,
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                transition: 'opacity 0.15s ease'
                            }}
                        >
                            {statusConfirmModal.saving ? 'Updating...' : 'Confirm & Update Status'}
                        </button>
                    </div>
                </div>
            </div>
        );
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
    const isDummyVal = (val) => {
        if (!val) return true;
        const s = String(val).trim().toLowerCase();
        return s === 'test customer' || s === 'unknown' || s === 'customer1022@example.com' || s === 'test@example.com';
    };

    const formatCurrency = (val, orderCurrency = null) => {
        if (val === undefined || val === null || isNaN(val)) {
            const curr = String(orderCurrency || selectedOrder?.currency || '').toUpperCase();
            return (curr === 'USD' || curr === '$') ? '$0.00' : '₹0.00';
        }
        const num = Number(val);
        const curr = String(orderCurrency || selectedOrder?.currency || '').toUpperCase();
        if (curr === 'USD' || curr === '$') {
            return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

    const formatOrderDate = (val) => {
        if (!val) return { date: 'N/A', time: '' };
        try {
            const d = val.toDate ? val.toDate() : (val.toMillis ? new Date(val.toMillis()) : new Date(val));
            if (isNaN(d.getTime())) return { date: String(val), time: '' };
            const date = d.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
            const time = d.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            return { date, time };
        } catch {
            return { date: String(val), time: '' };
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

    // Filter orders by search, status tab, tenant, and date
    const filteredOrders = useMemo(() => {
        return orders.filter((o) => {
            const normStatus = normalizeStatus(o.status);
            if (selectedStatusFilter !== 'ALL' && normStatus !== selectedStatusFilter) {
                return false;
            }

            // Tenant filter (for Admin)
            if (isAdmin && selectedTenantFilter !== 'ALL') {
                if (o.tenantId !== selectedTenantFilter) return false;
            }

            // Date filter (picker: 'YYYY-MM-DD')
            if (selectedDateFilter) {
                let orderDateStr = '';
                if (o.createdAt) {
                    try {
                        const d = o.createdAt.toDate ? o.createdAt.toDate() : (o.createdAt.toMillis ? new Date(o.createdAt.toMillis()) : new Date(o.createdAt));
                        if (!isNaN(d.getTime())) {
                            orderDateStr = d.toISOString().split('T')[0];
                        }
                    } catch (e) {}
                }
                if (orderDateStr !== selectedDateFilter) return false;
            }

            if (!searchQuery.trim()) return true;

            const q = searchQuery.toLowerCase().trim();
            const num = String(o.orderNumber || '').toLowerCase();
            const shopifyId = String(o.shopifyOrderId || '').toLowerCase();
            const cust = String(o.customerName || '').toLowerCase();
            const email = String(o.customerEmail || '').toLowerCase();
            const phone = String(o.customerPhone || o.phone || '').toLowerCase();
            const tDisplay = getTenantDisplay(o);
            const tName = String(tDisplay.name || '').toLowerCase();
            const tCode = String(tDisplay.code || '').toLowerCase();
            const tId = String(o.tenantId || '').toLowerCase();

            // Product code & variant match
            const prodMatch = o.items?.some((i) =>
                (i.productCode || '').toLowerCase().includes(q) ||
                (i.sku || '').toLowerCase().includes(q) ||
                (i.productName || '').toLowerCase().includes(q) ||
                (i.variantName || '').toLowerCase().includes(q) ||
                (i.variantDetails || '').toLowerCase().includes(q)
            );

            // Date text match (e.g. '8 oct', '2026', 'october')
            let dateMatch = false;
            if (o.createdAt) {
                try {
                    const d = o.createdAt.toDate ? o.createdAt.toDate() : (o.createdAt.toMillis ? new Date(o.createdAt.toMillis()) : new Date(o.createdAt));
                    if (!isNaN(d.getTime())) {
                        const dStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).toLowerCase();
                        const fullDStr = d.toISOString().split('T')[0].toLowerCase();
                        if (dStr.includes(q) || fullDStr.includes(q)) dateMatch = true;
                    }
                } catch (e) {}
            }

            return num.includes(q) ||
                shopifyId.includes(q) ||
                cust.includes(q) ||
                email.includes(q) ||
                phone.includes(q) ||
                tName.includes(q) ||
                tCode.includes(q) ||
                tId.includes(q) ||
                prodMatch ||
                dateMatch;
        });
    }, [orders, selectedStatusFilter, selectedTenantFilter, selectedDateFilter, searchQuery, isAdmin, tenantInfoMap, getTenantDisplay]);

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

        // Extract all comprehensive customer details from Shopify order
        let custName = selectedOrder.customerName || '';
        if (isDummyVal(custName)) custName = '';
        if (!custName && selectedOrder.customer) {
            custName = [selectedOrder.customer.first_name, selectedOrder.customer.last_name].filter(Boolean).join(' ') || selectedOrder.customer.name || '';
        }
        if ((!custName || isDummyVal(custName)) && selectedOrder.shipping_address) {
            custName = selectedOrder.shipping_address.name || [selectedOrder.shipping_address.first_name, selectedOrder.shipping_address.last_name].filter(Boolean).join(' ') || '';
        }
        if ((!custName || isDummyVal(custName)) && selectedOrder.shippingAddress) {
            if (typeof selectedOrder.shippingAddress === 'object') {
                custName = selectedOrder.shippingAddress.name || [selectedOrder.shippingAddress.first_name, selectedOrder.shippingAddress.last_name].filter(Boolean).join(' ') || '';
            } else if (typeof selectedOrder.shippingAddress === 'string') {
                const firstPart = selectedOrder.shippingAddress.split(',')[0].trim();
                if (firstPart && !isDummyVal(firstPart) && isNaN(Number(firstPart))) {
                    custName = firstPart;
                }
            }
        }
        if ((!custName || isDummyVal(custName)) && selectedOrder.billingAddress) {
            if (typeof selectedOrder.billingAddress === 'object') {
                custName = selectedOrder.billingAddress.name || [selectedOrder.billingAddress.first_name, selectedOrder.billingAddress.last_name].filter(Boolean).join(' ') || '';
            } else if (typeof selectedOrder.billingAddress === 'string') {
                const firstPart = selectedOrder.billingAddress.split(',')[0].trim();
                if (firstPart && !isDummyVal(firstPart) && isNaN(Number(firstPart))) {
                    custName = firstPart;
                }
            }
        }
        custName = custName.trim() || 'N/A';

        let custEmail = selectedOrder.customerEmail || selectedOrder.email || selectedOrder.customer?.email || selectedOrder.contact_email || '';
        if (isDummyVal(custEmail)) {
            custEmail = selectedOrder.email || selectedOrder.contact_email || '';
        }
        custEmail = custEmail.trim();

        let custPhone = selectedOrder.customerPhone || 
                        selectedOrder.phone || 
                        selectedOrder.customer?.phone || 
                        selectedOrder.shipping_address?.phone || 
                        (typeof selectedOrder.shippingAddress === 'object' ? selectedOrder.shippingAddress?.phone : null) ||
                        selectedOrder.billing_address?.phone ||
                        (typeof selectedOrder.billingAddress === 'object' ? selectedOrder.billingAddress?.phone : null) ||
                        selectedOrder.customer?.default_address?.phone || 
                        '';
        custPhone = custPhone ? String(custPhone).trim() : '';

        // Shipping Address extraction
        let shippingInfo = null;
        if (selectedOrder.shipping_address && typeof selectedOrder.shipping_address === 'object') {
            shippingInfo = selectedOrder.shipping_address;
        } else if (selectedOrder.shippingAddress && typeof selectedOrder.shippingAddress === 'object') {
            shippingInfo = selectedOrder.shippingAddress;
        } else if (typeof selectedOrder.shippingAddress === 'string' && selectedOrder.shippingAddress.trim()) {
            shippingInfo = { fullString: selectedOrder.shippingAddress.trim() };
        } else if (typeof selectedOrder.shipping_address === 'string' && selectedOrder.shipping_address.trim()) {
            shippingInfo = { fullString: selectedOrder.shipping_address.trim() };
        } else if (selectedOrder.address && typeof selectedOrder.address === 'object') {
            shippingInfo = selectedOrder.address;
        } else if (typeof selectedOrder.address === 'string' && selectedOrder.address.trim()) {
            shippingInfo = { fullString: selectedOrder.address.trim() };
        }

        // Billing Address extraction
        let billingInfo = null;
        if (selectedOrder.billing_address && typeof selectedOrder.billing_address === 'object') {
            billingInfo = selectedOrder.billing_address;
        } else if (selectedOrder.billingAddress && typeof selectedOrder.billingAddress === 'object') {
            billingInfo = selectedOrder.billingAddress;
        } else if (typeof selectedOrder.billingAddress === 'string' && selectedOrder.billingAddress.trim()) {
            billingInfo = { fullString: selectedOrder.billingAddress.trim() };
        } else if (typeof selectedOrder.billing_address === 'string' && selectedOrder.billing_address.trim()) {
            billingInfo = { fullString: selectedOrder.billing_address.trim() };
        }

        // Customer notes & special instructions
        const custNote = (selectedOrder.note || selectedOrder.customerNote || selectedOrder.notes || selectedOrder.customer?.note || '').trim();

        // Shopify note attributes (e.g. gift message, GST, delivery date)
        const custNoteAttributes = Array.isArray(selectedOrder.note_attributes) ? selectedOrder.note_attributes : [];

        // Customer & order tags
        let custTags = [];
        if (Array.isArray(selectedOrder.tags)) {
            custTags = selectedOrder.tags;
        } else if (typeof selectedOrder.tags === 'string' && selectedOrder.tags.trim()) {
            custTags = selectedOrder.tags.split(',').map((t) => t.trim()).filter(Boolean);
        } else if (typeof selectedOrder.customer?.tags === 'string' && selectedOrder.customer.tags.trim()) {
            custTags = selectedOrder.customer.tags.split(',').map((t) => t.trim()).filter(Boolean);
        }

        // Payment Gateway / Method
        const paymentGateway = selectedOrder.gateway || 
                               (Array.isArray(selectedOrder.payment_gateway_names) ? selectedOrder.payment_gateway_names.join(', ') : selectedOrder.payment_gateway_names) || 
                               selectedOrder.paymentMethod || 
                               '';

        // Delivery Method
        let shippingMethod = '';
        if (Array.isArray(selectedOrder.shipping_lines) && selectedOrder.shipping_lines.length > 0) {
            shippingMethod = selectedOrder.shipping_lines.map((s) => s.title || s.code).filter(Boolean).join(', ');
        } else if (selectedOrder.shippingMethod) {
            shippingMethod = selectedOrder.shippingMethod;
        }

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

                        {/* Status Change Action Button */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                                Update Status:
                            </label>
                            <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => openStatusPickerModal(selectedOrder)}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    border: '1.5px solid #cbd5e1',
                                    backgroundColor: '#ffffff',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    color: '#0f172a',
                                    cursor: isUpdating ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                    transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.backgroundColor = '#ffffff'; }}
                                title="Click to open status change confirmation popup"
                            >
                                <span>{currentCfg.icon}</span>
                                <span>{currentNormStatus}</span>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>
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
                                justifyContent: 'space-between',
                                gap: '12px',
                                color: '#b91c1c'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '24px' }}>✕</span>
                                <div>
                                    <strong style={{ fontSize: '14px' }}>This order has been cancelled.</strong>
                                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#dc2626' }}>
                                        No further dispatch or fulfillment actions are required. You can restore it to any status above at any time.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => openStatusPickerModal(selectedOrder, 'Pending Payment')}
                                style={{
                                    padding: '8px 14px',
                                    borderRadius: '8px',
                                    border: '1px solid #fca5a5',
                                    backgroundColor: '#ffffff',
                                    color: '#b91c1c',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                Restore Order
                            </button>
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
                                        onClick={() => openStatusPickerModal(selectedOrder, stepName)}
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

                {/* 4 Detail Cards (Customer, Delivery Address, References, Financial) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    {/* Customer Profile & Contact Card */}
                    <div style={detailCardStyle}>
                        <div style={cardHeaderStyle}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            <h3 style={cardTitleStyle}>Customer Details</h3>
                            <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', backgroundColor: '#eff6ff', color: '#2563eb' }}>
                                Shopify Buyer
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <span style={labelStyle}>Customer Name</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '12px', flexShrink: 0 }}>
                                        {(custName.charAt(0) || 'C').toUpperCase()}
                                    </div>
                                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                                        {custName}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <span style={labelStyle}>Email Address</span>
                                {custEmail ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '2px' }}>
                                        <a
                                            href={`mailto:${custEmail}`}
                                            title="Send Email"
                                            style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'none', wordBreak: 'break-all', fontWeight: '500' }}
                                        >
                                            {custEmail}
                                        </a>
                                        <button
                                            type="button"
                                            onClick={() => handleCopyText(custEmail, 'email')}
                                            style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#475569', cursor: 'pointer', flexShrink: 0 }}
                                        >
                                            {copiedField === 'email' ? '✓ Copied' : 'Copy'}
                                        </button>
                                    </div>
                                ) : (
                                    <span style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>
                                        No email provided
                                    </span>
                                )}
                            </div>

                            <div>
                                <span style={labelStyle}>Phone Number</span>
                                {custPhone ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                                        <a
                                            href={`tel:${custPhone}`}
                                            title="Call Customer"
                                            style={{ fontSize: '13.5px', color: '#059669', fontWeight: '600', textDecoration: 'none' }}
                                        >
                                            📞 {custPhone}
                                        </a>
                                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                            <a
                                                href={`https://wa.me/${custPhone.replace(/[^0-9]/g, '')}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                title="Open in WhatsApp"
                                                style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', color: '#16a34a', textDecoration: 'none', fontWeight: '600' }}
                                            >
                                                WhatsApp
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => handleCopyText(custPhone, 'phone')}
                                                style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#475569', cursor: 'pointer' }}
                                            >
                                                {copiedField === 'phone' ? '✓' : 'Copy'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                        Not provided in Shopify checkout
                                    </span>
                                )}
                            </div>

                            {custTags.length > 0 && (
                                <div>
                                    <span style={labelStyle}>Customer Tags</span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                        {custTags.map((t, idx) => (
                                            <span key={idx} style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                                #{t}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Delivery & Shipping Address Card */}
                    <div style={detailCardStyle}>
                        <div style={cardHeaderStyle}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            <h3 style={cardTitleStyle}>Delivery & Shipping Address</h3>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {shippingInfo ? (
                                <>
                                    {shippingInfo.fullString ? (
                                        <div>
                                            <span style={labelStyle}>Shipping Address</span>
                                            <div style={{ fontSize: '13px', color: '#1e293b', lineHeight: 1.5, backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                {shippingInfo.fullString}
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {(shippingInfo.name || shippingInfo.first_name) && (
                                                <div>
                                                    <span style={labelStyle}>Recipient Name</span>
                                                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                                                        {shippingInfo.name || [shippingInfo.first_name, shippingInfo.last_name].filter(Boolean).join(' ')}
                                                        {shippingInfo.company ? ` (${shippingInfo.company})` : ''}
                                                    </div>
                                                </div>
                                            )}

                                            {(shippingInfo.address1 || shippingInfo.address2) && (
                                                <div>
                                                    <span style={labelStyle}>Street Address</span>
                                                    <div style={{ fontSize: '13px', color: '#334155' }}>
                                                        {[shippingInfo.address1, shippingInfo.address2].filter(Boolean).join(', ')}
                                                    </div>
                                                </div>
                                            )}

                                            <div>
                                                <span style={labelStyle}>City, State & Postal Code</span>
                                                <div style={{ fontSize: '13px', color: '#334155' }}>
                                                    {[
                                                        shippingInfo.city,
                                                        shippingInfo.province || shippingInfo.state,
                                                        shippingInfo.zip || shippingInfo.postalCode
                                                    ].filter(Boolean).join(', ') || 'N/A'}
                                                </div>
                                            </div>

                                            {shippingInfo.country && (
                                                <div>
                                                    <span style={labelStyle}>Country</span>
                                                    <div style={{ fontSize: '13px', color: '#334155' }}>
                                                        {shippingInfo.country}
                                                    </div>
                                                </div>
                                            )}

                                            {shippingInfo.phone && (
                                                <div>
                                                    <span style={labelStyle}>Delivery Phone</span>
                                                    <div style={{ fontSize: '13px', color: '#059669', fontWeight: '600' }}>
                                                        📞 {shippingInfo.phone}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {shippingMethod && (
                                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                                            <span style={labelStyle}>Shipping Method</span>
                                            <div style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>
                                                🚚 {shippingMethod}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b' }}>
                                    <div style={{ fontSize: '20px', marginBottom: '4px' }}>📦</div>
                                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>No Physical Shipping Address</div>
                                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Customer may have used digital delivery or store pickup.</div>
                                </div>
                            )}

                            {/* Billing Address snippet if present & different */}
                            {billingInfo && (
                                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                                    <span style={labelStyle}>Billing Address</span>
                                    <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
                                        {billingInfo.fullString || [
                                            billingInfo.address1,
                                            billingInfo.city,
                                            billingInfo.province || billingInfo.state,
                                            billingInfo.zip,
                                            billingInfo.country
                                        ].filter(Boolean).join(', ')}
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
                            {isAdmin && (() => {
                                const tDisplay = getTenantDisplay(selectedOrder);
                                return (
                                    <>
                                        <div>
                                            <span style={labelStyle}>Tenant Name:</span>
                                            <div style={{ fontSize: '13.5px', color: '#0f172a', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>🏢</span>
                                                <span>{tDisplay.name}</span>
                                                {tDisplay.code && (
                                                    <span style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#b89620', fontWeight: '700', border: '1px solid #fde68a' }}>
                                                        {tDisplay.code}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <span style={labelStyle}>Tenant ID:</span>
                                            <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                                                {selectedOrder.tenantId || 'N/A'}
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                            <div>
                                <span style={labelStyle}>Store Domain / ID:</span>
                                <div style={{ fontSize: '13px', color: '#475569' }}>
                                    {selectedOrder.storeId || 'Shopify Store'}
                                </div>
                            </div>
                            {paymentGateway && (
                                <div>
                                    <span style={labelStyle}>Payment Method:</span>
                                    <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '600' }}>
                                        💳 {paymentGateway}
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

                {/* Customer Notes / Special Instructions Banner (If provided in Shopify) */}
                {(custNote || custNoteAttributes.length > 0) && (
                    <div
                        style={{
                            backgroundColor: '#fffbeb',
                            borderRadius: '12px',
                            border: '1px solid #fde68a',
                            padding: '16px 20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '18px' }}>📝</span>
                            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#92400e' }}>
                                Customer Order Notes & Special Instructions (From Shopify)
                            </h4>
                        </div>
                        {custNote && (
                            <p style={{ margin: 0, fontSize: '13px', color: '#78350f', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                {custNote}
                            </p>
                        )}
                        {custNoteAttributes.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                                {custNoteAttributes.map((attr, idx) => (
                                    <div key={idx} style={{ padding: '5px 10px', backgroundColor: '#fef3c7', borderRadius: '6px', border: '1px solid #fcd34d', fontSize: '12px', color: '#78350f' }}>
                                        <strong>{attr.name || attr.key}:</strong> {attr.value}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

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
                                    <th style={thStyle}>SKU / Code</th>
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
                                        const displaySku = item.sku || item.productCode || 'N/A';
                                        const vText = item.variantName && item.variantName !== 'Default Title'
                                            ? item.variantName
                                            : (item.variantDetails || (item.color ? (item.size ? `${item.color} / ${item.size}` : item.color) : ''));

                                        return (
                                            <tr key={idx} style={{ borderTop: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                                <td style={{ ...tdStyle, fontWeight: '600', color: '#0f172a' }}>
                                                    <div>{item.productName || 'Product'}</div>
                                                    {item.sku && item.productCode && item.sku !== item.productCode && (
                                                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '400', marginTop: '2px' }}>
                                                            Base Code: {item.productCode}
                                                        </div>
                                                    )}
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
                                                        {displaySku}
                                                    </span>
                                                </td>
                                                <td style={tdStyle}>
                                                    {vText && vText !== 'Default Title' ? (
                                                        <span style={{
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            backgroundColor: '#ede9fe',
                                                            color: '#6d28d9',
                                                            fontSize: '12px',
                                                            fontWeight: '600',
                                                            display: 'inline-block'
                                                        }}>
                                                            {vText}
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

                {/* Confirmation Status Popup Modal for Order Details View */}
                {renderConfirmationModal()}
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

            {/* Header + Search bar + Tenant & Date Filters + Refresh */}
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
                    {/* Search Input */}
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            placeholder="Search by order #, cust, product code, tenant..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                padding: '8px 28px 8px 12px',
                                fontSize: '13px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                outline: 'none',
                                minWidth: '260px'
                            }}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                style={{
                                    position: 'absolute',
                                    right: '8px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    padding: '2px'
                                }}
                                title="Clear search"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Tenant Dropdown Filter (Admin only) */}
                    {isAdmin && (
                        <select
                            value={selectedTenantFilter}
                            onChange={(e) => setSelectedTenantFilter(e.target.value)}
                            style={{
                                padding: '8px 12px',
                                fontSize: '13px',
                                fontWeight: '600',
                                borderRadius: '8px',
                                border: selectedTenantFilter !== 'ALL' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                                backgroundColor: selectedTenantFilter !== 'ALL' ? '#eff6ff' : '#fff',
                                color: selectedTenantFilter !== 'ALL' ? '#1d4ed8' : '#334155',
                                outline: 'none',
                                cursor: 'pointer',
                                maxWidth: '190px'
                            }}
                            title="Filter by Tenant"
                        >
                            <option value="ALL">🏢 All Tenants ({availableTenants.length})</option>
                            {availableTenants.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name} {t.code ? `(${t.code})` : ''}
                                </option>
                            ))}
                        </select>
                    )}

                    {/* Date Picker Filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                            type="date"
                            value={selectedDateFilter}
                            onChange={(e) => setSelectedDateFilter(e.target.value)}
                            style={{
                                padding: '7px 10px',
                                fontSize: '12.5px',
                                borderRadius: '8px',
                                border: selectedDateFilter ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                                backgroundColor: selectedDateFilter ? '#eff6ff' : '#fff',
                                color: selectedDateFilter ? '#1d4ed8' : '#334155',
                                fontWeight: '500',
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                            title="Filter by Order Date"
                        />
                        {selectedDateFilter && (
                            <button
                                onClick={() => setSelectedDateFilter('')}
                                title="Clear date filter"
                                style={{
                                    padding: '5px 8px',
                                    fontSize: '11px',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    backgroundColor: '#f1f5f9',
                                    color: '#64748b',
                                    cursor: 'pointer',
                                    fontWeight: '700'
                                }}
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Reset All Filters Button */}
                    {(searchQuery || selectedStatusFilter !== 'ALL' || selectedTenantFilter !== 'ALL' || selectedDateFilter) && (
                        <button
                            onClick={() => {
                                setSearchQuery('');
                                setSelectedStatusFilter('ALL');
                                setSelectedTenantFilter('ALL');
                                setSelectedDateFilter('');
                            }}
                            style={{
                                padding: '7px 12px',
                                fontSize: '12px',
                                fontWeight: '600',
                                borderRadius: '8px',
                                border: '1px solid #fecaca',
                                backgroundColor: '#fef2f2',
                                color: '#dc2626',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                            title="Reset all search and filter criteria"
                        >
                            ✕ Reset
                        </button>
                    )}

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
                    padding: '12px 20px',
                    borderBottom: '1px solid #e2e8f0',
                    backgroundColor: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap'
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

            {/* Orders Table Container */}
            <div style={{ width: '100%', overflowX: 'auto', boxSizing: 'border-box', borderTop: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ ...thStyle, width: '8%' }}>Order ID</th>
                            <th style={{ ...thStyle, width: '11%' }}>Date</th>
                            {isAdmin && <th style={{ ...thStyle, width: '13%' }}>Tenant</th>}
                            <th style={{ ...thStyle, width: isAdmin ? '15%' : '18%' }}>Customer</th>
                            <th style={{ ...thStyle, width: isAdmin ? '21%' : '26%' }}>Products</th>
                            <th style={{ ...thStyle, width: '5%', textAlign: 'center' }}>Qty</th>
                            {isAdmin ? (
                                <>
                                    <th style={{ ...thStyle, width: '9%', textAlign: 'right' }}>Purchase</th>
                                    <th style={{ ...thStyle, width: '9%', textAlign: 'right' }}>Selling</th>
                                    <th style={{ ...thStyle, width: '9%', textAlign: 'right', color: '#16a34a' }}>Profit</th>
                                </>
                            ) : (
                                <>
                                    <th style={{ ...thStyle, width: '9%', textAlign: 'right' }}>Base Price</th>
                                    <th style={{ ...thStyle, width: '9%', textAlign: 'right' }}>Selling Price</th>
                                    <th style={{ ...thStyle, width: '9%', textAlign: 'right', color: '#16a34a' }}>Profit</th>
                                </>
                            )}
                            <th style={{ ...thStyle, width: '8%', textAlign: 'center' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredOrders.length === 0 ? (
                            <tr>
                                <td colSpan={isAdmin ? 10 : 9} style={{ padding: '60px 24px', textAlign: 'center', color: '#64748b' }}>
                                    <div style={{ fontSize: '36px', marginBottom: '10px' }}>📦</div>
                                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>
                                        {searchQuery || selectedStatusFilter !== 'ALL' || selectedTenantFilter !== 'ALL' || selectedDateFilter
                                            ? 'No orders match your filter criteria.'
                                            : 'No orders recorded yet.'}
                                    </div>
                                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                                        Try adjusting your search query, status filters, or date range.
                                    </p>
                                    {(searchQuery || selectedStatusFilter !== 'ALL' || selectedTenantFilter !== 'ALL' || selectedDateFilter) && (
                                        <button
                                            onClick={() => {
                                                setSearchQuery('');
                                                setSelectedStatusFilter('ALL');
                                                setSelectedTenantFilter('ALL');
                                                setSelectedDateFilter('');
                                            }}
                                            style={{
                                                marginTop: '16px',
                                                padding: '7px 16px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                backgroundColor: '#fff',
                                                fontSize: '12.5px',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                color: '#2563eb',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
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
                                const statusCfg = STATUS_CONFIG[normStatus] || STATUS_CONFIG['Pending Payment'];

                                return (
                                    <tr
                                        key={order.id}
                                        onClick={() => setSelectedOrder(order)}
                                        style={{
                                            borderBottom: '1px solid #f1f5f9',
                                            backgroundColor: i % 2 === 0 ? '#ffffff' : '#fcfcfd',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.12s ease'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = i % 2 === 0 ? '#ffffff' : '#fcfcfd'; }}
                                    >
                                        {/* Order ID */}
                                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                backgroundColor: '#eff6ff',
                                                color: '#1d4ed8',
                                                fontWeight: '700',
                                                fontSize: '12px',
                                                border: '1px solid #dbeafe',
                                                fontFamily: 'monospace'
                                            }}>
                                                #{order.orderNumber || 'N/A'}
                                            </span>
                                        </td>

                                        {/* Date */}
                                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                            {(() => {
                                                const { date, time } = formatOrderDate(order.createdAt);
                                                return (
                                                    <div>
                                                        <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '12px' }}>{date}</div>
                                                        {time && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>{time}</div>}
                                                    </div>
                                                );
                                            })()}
                                        </td>

                                        {/* Tenant Name (Admin Only) */}
                                        {isAdmin && (() => {
                                            const tDisplay = getTenantDisplay(order);
                                            return (
                                                <td style={tdStyle} title={`Tenant: ${tDisplay.name}\nTenant ID: ${order.tenantId || 'N/A'}`}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                        <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            <span style={{ fontSize: '13px' }}>🏪</span>
                                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                                                                {tDisplay.name}
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            {tDisplay.code && (
                                                                <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#b89620', fontWeight: '700', border: '1px solid #fde68a' }}>
                                                                    {tDisplay.code}
                                                                </span>
                                                            )}
                                                            {order.tenantId && (
                                                                <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                                                                    {order.tenantId.substring(0, 8)}...
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            );
                                        })()}

                                        {/* Customer */}
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '12.5px', lineHeight: '1.2' }}>
                                                {(() => {
                                                    const raw = order.customerName;
                                                    if (raw && !isDummyVal(raw)) return raw;
                                                    if (order.shipping_address?.name) return order.shipping_address.name;
                                                    if (typeof order.shippingAddress === 'string') {
                                                        const p = order.shippingAddress.split(',')[0].trim();
                                                        if (p && !isDummyVal(p) && isNaN(Number(p))) return p;
                                                    }
                                                    return raw || 'N/A';
                                                })()}
                                            </div>
                                            {(() => {
                                                const em = order.customerEmail || order.email || order.contact_email;
                                                if (!em || isDummyVal(em)) return null;
                                                return (
                                                    <div style={{ fontSize: '11px', color: '#64748b', wordBreak: 'break-all', marginTop: '2px', lineHeight: '1.2' }}>
                                                        {em}
                                                    </div>
                                                );
                                            })()}
                                            {(order.customerPhone || order.phone || order.shipping_address?.phone) && (
                                                <div style={{ fontSize: '11px', color: '#059669', marginTop: '2px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <span>📞</span>
                                                    <span>{order.customerPhone || order.phone || order.shipping_address?.phone}</span>
                                                </div>
                                            )}
                                        </td>

                                        {/* Products List */}
                                        <td style={tdStyle}>
                                            {order.items && order.items.length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', lineHeight: '1.3' }}>
                                                    {order.items.slice(0, 2).map((item, idx) => {
                                                        const displaySku = item.sku || item.productCode || 'ITEM';
                                                        const vText = item.variantName && item.variantName !== 'Default Title'
                                                            ? item.variantName
                                                            : (item.variantDetails || (item.color ? (item.size ? `${item.color} / ${item.size}` : item.color) : ''));
                                                        return (
                                                            <div key={idx} style={{ wordBreak: 'break-word', color: '#334155' }}>
                                                                <strong style={{ color: '#0f172a', fontFamily: 'monospace', backgroundColor: '#f1f5f9', padding: '1px 4px', borderRadius: '3px' }}>
                                                                    {displaySku}
                                                                </strong>{' '}
                                                                - {item.productName || 'Product'}
                                                                {vText && vText !== 'Default Title' ? (
                                                                    <span style={{ color: '#6d28d9', fontWeight: '600', fontSize: '10.5px' }}> ({vText})</span>
                                                                ) : null}
                                                                <span style={{ color: '#0f172a', fontWeight: '700' }}> ×{item.quantity || 1}</span>
                                                            </div>
                                                        );
                                                    })}
                                                    {order.items.length > 2 && (
                                                        <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: '600', backgroundColor: '#eff6ff', padding: '1px 6px', borderRadius: '10px', width: 'fit-content' }}>
                                                            +{order.items.length - 2} more item{order.items.length - 2 > 1 ? 's' : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span style={{ color: '#94a3b8', fontSize: '11px' }}>No items</span>
                                            )}
                                        </td>

                                        {/* Qty */}
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                minWidth: '24px',
                                                height: '24px',
                                                borderRadius: '12px',
                                                backgroundColor: '#f1f5f9',
                                                color: '#0f172a',
                                                fontWeight: '700',
                                                fontSize: '12px'
                                            }}>
                                                {totalQty}
                                            </span>
                                        </td>

                                        {/* Financial Columns */}
                                        {isAdmin ? (
                                            <>
                                                <td style={{ ...tdStyle, whiteSpace: 'nowrap', textAlign: 'right', color: '#64748b' }}>
                                                    {formatCurrency(order.totalPurchasePrice)}
                                                </td>
                                                <td style={{ ...tdStyle, fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', textAlign: 'right' }}>
                                                    {formatCurrency(order.totalSellingPrice)}
                                                </td>
                                                <td style={{ ...tdStyle, whiteSpace: 'nowrap', textAlign: 'right' }}>
                                                    <span style={{
                                                        padding: '3px 8px',
                                                        borderRadius: '6px',
                                                        backgroundColor: '#ecfdf5',
                                                        color: '#059669',
                                                        fontWeight: '700',
                                                        fontSize: '12px',
                                                        border: '1px solid #a7f3d0'
                                                    }}>
                                                        {formatCurrency(order.totalAdminProfit)}
                                                    </span>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td style={{ ...tdStyle, whiteSpace: 'nowrap', textAlign: 'right', color: '#64748b' }}>
                                                    {formatCurrency(order.totalBasePrice)}
                                                </td>
                                                <td style={{ ...tdStyle, fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', textAlign: 'right' }}>
                                                    {formatCurrency(order.totalSellingPrice)}
                                                </td>
                                                <td style={{ ...tdStyle, whiteSpace: 'nowrap', textAlign: 'right' }}>
                                                    <span style={{
                                                        padding: '3px 8px',
                                                        borderRadius: '6px',
                                                        backgroundColor: '#ecfdf5',
                                                        color: '#059669',
                                                        fontWeight: '700',
                                                        fontSize: '12px',
                                                        border: '1px solid #a7f3d0'
                                                    }}>
                                                        {formatCurrency(order.totalProfit)}
                                                    </span>
                                                </td>
                                            </>
                                        )}

                                        {/* ACTION */}
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedOrder(order);
                                                }}
                                                style={{
                                                    padding: '6px 12px',
                                                    fontSize: '11px',
                                                    fontWeight: '700',
                                                    borderRadius: '6px',
                                                    backgroundColor: '#ffffff',
                                                    color: '#0f172a',
                                                    border: '1px solid #cbd5e1',
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                                    transition: 'all 0.15s ease'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#0f172a';
                                                    e.currentTarget.style.color = '#ffffff';
                                                    e.currentTarget.style.borderColor = '#0f172a';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#ffffff';
                                                    e.currentTarget.style.color = '#0f172a';
                                                    e.currentTarget.style.borderColor = '#cbd5e1';
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

            {/* Confirmation Status Popup Modal for Table View */}
            {renderConfirmationModal()}
        </div>
    );
}

const thStyle = {
    padding: '12px 12px',
    fontSize: '11px',
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap'
};

const tdStyle = {
    padding: '12px 12px',
    fontSize: '12px',
    color: '#334155',
    verticalAlign: 'middle'
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
