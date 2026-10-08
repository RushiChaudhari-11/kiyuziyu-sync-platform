import React, { useEffect, useState } from "react";
import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    doc, runTransaction

} from "firebase/firestore";

import { db } from "../../firebase";
import { useStoreAuth } from "./StoreAuthContext";

import "./StoreOrders.css";

const StoreMyOrders = () => {

    const { user } = useStoreAuth();

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);

    /* ================= LOAD ORDERS ================= */

    useEffect(() => {

        const loadOrders = async () => {

            if (!user) {
                setLoading(false);
                return;
            }

            try {

                const q = query(
                    collection(db, "storeOrders"),
                    where("customerId", "==", user.uid),
                    orderBy("createdAt", "desc")
                );

                const snap = await getDocs(q);

                const list = snap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                setOrders(list);

            } catch (err) {
                console.error("Orders load error:", err);
            }

            setLoading(false);

        };

        loadOrders();

    }, [user]);

    /* ================= DATE FORMAT ================= */

    const formatDate = (timestamp) => {

        if (!timestamp) return "";

        try {
            return new Date(timestamp.seconds * 1000)
                .toLocaleString();
        } catch {
            return "";
        }

    };
    const cancelOrder = async (order) => {

        console.log("🚨 Cancel order clicked:", order);

        try {

            await runTransaction(db, async (transaction) => {

                /* =====================
                READ PRODUCTS
                ===================== */

                const productDocs = [];

                for (const item of order.items) {

                    console.log("📦 Processing item:", item);

                    const ref = doc(
                        db,
                        "collections",
                        item.collectionId,
                        "subcollections",
                        item.subcollectionId,
                        "products",
                        item.productId
                    );

                    const snap = await transaction.get(ref);

                    if (!snap.exists()) {
                        console.log("❌ Product not found:", item.productId);
                        continue;
                    }

                    productDocs.push({
                        ref,
                        data: snap.data(),
                        item
                    });

                }

                /* =====================
                GROUP ITEMS BY PRODUCT
                ===================== */

                const groupedProducts = {};

                productDocs.forEach(p => {

                    const key = p.ref.path;

                    if (!groupedProducts[key]) {
                        groupedProducts[key] = {
                            ref: p.ref,
                            data: JSON.parse(JSON.stringify(p.data)),
                            items: []
                        };
                    }

                    groupedProducts[key].items.push(p.item);

                });

                /* =====================
                UPDATE STOCK
                ===================== */

                for (const group of Object.values(groupedProducts)) {

                    const { ref, data, items } = group;

                    console.log("📦 Updating grouped product:", ref.path);

                    /* ===== VARIANT PRODUCT ===== */

                    /* ===== VARIANT PRODUCT ===== */

                    if (data.variations && data.variations.length > 0) {

                        let updatedVariations = [...data.variations];

                        items.forEach(item => {

                            if (!item.variation) return;

                            const matchIndex = updatedVariations.findIndex(v =>
                                Object.keys(item.variation)
                                    .filter(k => k !== "quantity")
                                    .every(key => v[key] === item.variation[key])
                            );

                            if (matchIndex === -1) {
                                console.log("❌ Variant not found", item.variation);
                                return;
                            }

                            const currentQty = updatedVariations[matchIndex].quantity || 0;
                            const newQty = currentQty + item.quantity;

                            updatedVariations[matchIndex] = {
                                ...updatedVariations[matchIndex],
                                quantity: newQty
                            };

                        });

                        transaction.update(ref, {
                            variations: updatedVariations
                        });

                    }

                    /* ===== NORMAL PRODUCT ===== */

                    else {

                        let newStock = data.quantity || 0;

                        items.forEach(item => {
                            newStock += item.quantity;
                        });

                        console.log(`📈 Normal stock updated to: ${newStock}`);

                        transaction.update(ref, {
                            quantity: newStock
                        });

                    }

                }

                /* =====================
                UPDATE ORDER STATUS
                ===================== */

                const orderRef = doc(db, "storeOrders", order.id);

                console.log("🧾 Updating order status → Cancelled");

                transaction.update(orderRef, {
                    status: "Cancelled",
                    cancelledAt: Date.now()
                });

            });

            console.log("✅ Transaction finished");

            /* =====================
            UPDATE UI STATE
            ===================== */

            setOrders(prev =>
                prev.map(o =>
                    o.id === order.id
                        ? { ...o, status: "Cancelled" }
                        : o
                )
            );

            setSelectedOrder(prev =>
                prev?.id === order.id
                    ? { ...prev, status: "Cancelled" }
                    : prev
            );

        } catch (err) {

            console.error("❌ Cancel order failed:", err);

        }

    };

    /* ================= LOADING ================= */

    if (loading) {
        return <div className="orders-loading">Loading your orders...</div>;
    }

    /* ================= UI ================= */

    return (

        <div className="store-orders-page">

            <h2>My Orders</h2>

            {orders.length === 0 && (
                <p className="no-orders">
                    You haven't placed any orders yet
                </p>
            )}

            <div className="orders-list">

                {orders.map(order => {

                    const totalUnits = order.items?.reduce(
                        (sum, i) => sum + (i.quantity || 0), 0
                    );

                    return (

                        <div
                            key={order.id}
                            className="order-card"
                            onClick={() => setSelectedOrder(order)}
                        >

                            <div className="order-top">

                                <div className="order-id">
                                    Order #{order.id.slice(0, 8)}
                                </div>

                                <div className={`order-status status-${(order.status || "pending").toLowerCase()}`}>
                                    {order.status || "Pending"}
                                </div>


                            </div>

                            <div className="order-meta">

                                <span>Date: {formatDate(order.createdAt)}</span>

                                <span>{totalUnits} items</span>

                                <span>Total: ₹{order.totalAmount}</span>

                            </div>

                            <div className="order-preview">

                                {order.items?.slice(0, 3).map((item, i) => (
                                    <img
                                        key={i}
                                        src={item.images?.[0]?.url || item.image}
                                        alt=""
                                    />
                                ))}


                            </div>

                        </div>

                    );

                })}

            </div>


            {/* ================= ORDER MODAL ================= */}

            {selectedOrder && (

                <div
                    className="order-modal-overlay"
                    onClick={() => setSelectedOrder(null)}
                >

                    <div
                        className="order-modal"
                        onClick={(e) => e.stopPropagation()}
                    >

                        <div className="modal-header">

                            <h3>
                                Order #{selectedOrder.id.slice(0, 8)}
                            </h3>

                            <button
                                className="modal-close"
                                onClick={() => setSelectedOrder(null)}
                            >
                                ✕
                            </button>

                        </div>

                        <div className="modal-meta">

                            <div>Status:
                                <span className={`order-status status-${(selectedOrder.status || "pending").toLowerCase()}`}>
                                    {selectedOrder.status}
                                </span>
                            </div>

                            <div>Date: {formatDate(selectedOrder.createdAt)}</div>

                        </div>


                        {/* PRODUCTS */}

                        <div className="modal-products">

                            {selectedOrder.items?.map((item, i) => (

                                <div key={i} className="modal-product">

                                    <img
                                        src={item.images?.[0]?.url || item.image}
                                        alt={item.productName}
                                    />

                                    <div className="modal-product-info">

                                        <div className="product-name">
                                            {item.productName}
                                        </div>

                                        <div className="product-meta">
                                            Code: {item.productCode}
                                        </div>

                                        {item.variationLabel && (
                                            <div className="product-meta">
                                                {item.variationLabel}
                                            </div>
                                        )}

                                        <div className="product-meta">
                                            Qty: {item.quantity}
                                        </div>

                                        <div className="product-meta">
                                            Price: ₹{item.priceAtTimeOfOrder}
                                        </div>

                                    </div>

                                </div>

                            ))}

                        </div>


                        {/* TOTAL */}

                        <div className="modal-total">

                            <div>Subtotal: ₹{selectedOrder.subtotal}</div>

<div>
  Shipping: {
    Number(selectedOrder.shippingFee) === 0
      ? "Applicable as per distance"
      : `₹${selectedOrder.shippingFee}`
  }
</div>
                            <div className="modal-total-final">
                                Total: ₹{selectedOrder.totalAmount}
                            </div>
                            {/* {selectedOrder?.status === "Pending" && (

                                <button
                                    className="cancel-order-btn"
                                    onClick={() => cancelOrder(selectedOrder)}
                                >
                                    Cancel Order
                                </button>

                            )} */}
                        </div>

                    </div>

                </div>

            )}

        </div>

    );

};

export default StoreMyOrders;