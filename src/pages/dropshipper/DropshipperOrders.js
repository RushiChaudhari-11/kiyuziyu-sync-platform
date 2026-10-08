import React, { useEffect, useState } from "react";
import {
    collection,
    query,
    where,
    getDocs,
    orderBy, updateDoc
} from "firebase/firestore";

import { db } from "../../firebase";
import { useAuth } from "../../components/AuthContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./DropshipperOrders.css";
import { runTransaction, doc } from "firebase/firestore";
const DropshipperOrders = () => {

    const { currentUser } = useAuth();

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedOrder, setExpandedOrder] = useState(null);
const [downloadingId, setDownloadingId] = useState(null);
    /* =========================
    LOAD SELLER ORDERS
    ========================= */

    useEffect(() => {

        const loadOrders = async () => {

            if (!currentUser) return;

            try {

                const q = query(
                    collection(db, "storeOrders"),
                    where("sellerId", "==", currentUser.uid),
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

    }, [currentUser]);

    /* =========================
    CALCULATE PROFIT
    ========================= */

    const calculateOrderProfit = (order) => {

        let profit = 0;

        (order.items || []).forEach(item => {

            const sellingPrice = item.priceAtTimeOfOrder || 0;
            const costPrice = item.costPrice || 0;

            profit += (sellingPrice - costPrice) * (item.quantity || 0);

        });

        return profit;

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



} catch (err) {

console.error("❌ Cancel order failed:", err);

}

};

    const markPaid = async (order) => {

        try {

            const orderRef = doc(db, "storeOrders", order.id);

            await updateDoc(orderRef, {
                status: "ReadyToPack",
                paidAt: Date.now()
            });

            setOrders(prev =>
                prev.map(o =>
                    o.id === order.id
                        ? { ...o, status: "ReadyToPack" }
                        : o
                )
            );

            console.log("✅ Order marked as ReadyToPack");

        } catch (err) {

            console.error("❌ Mark paid failed:", err);

        }

    };
    const getBase64FromUrl = async (url) => {
        const data = await fetch(url);
        const blob = await data.blob();

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => resolve(reader.result);
        });
    };
    const generateOrderPDF = async (order) => {
    
        setDownloadingId(order.id);
    
        try {
    
            const docPdf = new jsPDF();
    
            /* HEADER */
    
            docPdf.setFontSize(18);
            docPdf.text("Order Invoice", 14, 20);
    
            docPdf.setFontSize(11);
            docPdf.text(`Order ID: ${order.id}`, 14, 35);
            docPdf.text(`Customer: ${order.billingInfo?.fullName || ""}`, 14, 42);
            docPdf.text(`Phone: ${order.billingInfo?.phoneNumber || ""}`, 14, 49);
            docPdf.text(`City: ${order.billingInfo?.city || ""}`, 14, 56);
    
            let y = 70;
    
            /* TABLE HEADER */
    
            docPdf.setFontSize(11);
    
            docPdf.text("Image", 14, y);
            docPdf.text("Product", 35, y);
            docPdf.text("Code", 120, y);
            docPdf.text("Qty", 150, y);
            docPdf.text("Price", 170, y);
    
            y += 4;
            docPdf.line(14, y, 196, y);
            y += 8;
    
            docPdf.setFontSize(10);
    
            /* PRODUCTS */
    
            for (const item of order.items || []) {
    
                if (y > 260) {
    
                    docPdf.addPage();
                    y = 20;
    
                    docPdf.setFontSize(11);
                    docPdf.text("Image", 14, y);
                    docPdf.text("Product", 35, y);
                    docPdf.text("Code", 120, y);
                    docPdf.text("Qty", 150, y);
                    docPdf.text("Price", 170, y);
    
                    y += 4;
                    docPdf.line(14, y, 196, y);
                    y += 8;
    
                    docPdf.setFontSize(10);
                }
    
                /* IMAGE */
    
                try {
    
                    const imgUrl = item.images?.[0]?.url || item.image;
    
                    if (imgUrl) {
    
                        const res = await fetch(imgUrl);
                        const blob = await res.blob();
    
                        const reader = new FileReader();
    
                        const base64 = await new Promise(resolve => {
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
    
                        docPdf.addImage(base64, "JPEG", 14, y - 4, 16, 16);
                    }
    
                } catch (e) {
                    console.log("Image load failed");
                }
    
                /* PRODUCT TEXT */
    
                let productText = item.productName || "-";
    
                if (item.variationLabel) {
                    productText += ` (${item.variationLabel})`;
                }
    
                const wrappedText = docPdf.splitTextToSize(productText, 75);
    
                docPdf.text(wrappedText, 35, y);
    
                docPdf.text(item.productCode || "-", 120, y);
                docPdf.text(String(item.quantity || 0), 150, y);
    
                const price = Number(item.priceAtTimeOfOrder || 0)
                    .toLocaleString("en-IN");
    
                docPdf.text(`Rs ${price}`, 170, y);
    
                y += Math.max(wrappedText.length * 6, 18);
            }
    
            /* TOTALS */
    
            y += 10;
    
            if (y > 260) {
                docPdf.addPage();
                y = 20;
            }
    
            const subtotal = Number(order.subtotal || 0).toLocaleString("en-IN");
            const shipping = Number(order.shippingFee || 0).toLocaleString("en-IN");
            const total = Number(order.totalAmount || 0).toLocaleString("en-IN");
    
            docPdf.setFontSize(12);
    
            docPdf.text(`Subtotal: Rs ${subtotal}`, 14, y);
            docPdf.text(`Shipping: Rs ${shipping}`, 14, y + 8);
            docPdf.text(`Total: Rs ${total}`, 14, y + 16);
    
            /* OPEN PDF */
    
            const pdfBlobUrl = docPdf.output("bloburl");
            window.open(pdfBlobUrl);
    
        } finally {
    
            setDownloadingId(null);
    
        }
    };

    /* =========================
    FORMAT DATE
    ========================= */

    const formatDate = (timestamp) => {

        if (!timestamp) return "";

        try {
            return new Date(timestamp.seconds * 1000)
                .toLocaleString();
        } catch {
            return "";
        }

    };

    /* =========================
    LOADING
    ========================= */

    if (loading) {
        return <div className="orders-loading">Loading orders...</div>;
    }

    /* =========================
    UI
    ========================= */

    return (

        <div className="dropshipper-orders">

            <h1>Orders</h1>

            {orders.length === 0 && (

                <div className="no-orders">
                    No orders yet
                </div>
            )}

            <div className="orders-table">

                {orders.map(order => {

                    const profit = calculateOrderProfit(order);
                    const isExpanded = expandedOrder === order.id;

                    return (

                        <div key={order.id} className="order-row">

                            {/* SUMMARY */}

                            <div
                                className="order-summary"
                                onClick={() => setExpandedOrder(
                                    isExpanded ? null : order.id
                                )}
                            >

                                <div className="order-id">
                                    #{order.orderNumber || order.id.slice(0, 8)}
                                </div>

                                <div className="order-customer">
                                    {order.billingInfo?.fullName || "Customer"}
                                </div>

                                <div className={`order-status status-${(order.status || "pending").toLowerCase()}`}>
                                    {order.status || "Pending"}
                                </div>

                                <div className="order-total">
                                    ₹{order.totalAmount || 0}
                                </div>

                                <div className="order-profit">
                                    ₹{profit}
                                </div>




                            </div>

                            {/* EXPANDED DETAILS */}

                            {isExpanded && (

                                <div className="order-details">

                                    {/* CUSTOMER */}

                                    <div className="customer-block">

                                        <h3>Customer Details</h3>

                                        <p>
                                            <strong>Name:</strong> {order.billingInfo?.fullName}
                                        </p>

                                        <p>
                                            <strong>Email:</strong> {order.billingInfo?.email}
                                        </p>

                                        <p>
                                            <strong>Phone:</strong> {order.billingInfo?.phoneNumber}
                                        </p>

                                        <p>
                                            <strong>Address:</strong>{" "}
                                            {order.billingInfo?.addressLine1}{" "}
                                            {order.billingInfo?.addressLine2}
                                        </p>

                                        <p>
                                            <strong>City:</strong> {order.billingInfo?.city}
                                        </p>

                                        <p>
                                            <strong>State:</strong> {order.billingInfo?.state}
                                        </p>

                                        <p>
                                            <strong>Pincode:</strong> {order.billingInfo?.pincode}
                                        </p>

                                        <p>
                                            <strong>Date:</strong> {formatDate(order.createdAt)}
                                        </p>
                                        <div className="order-actions">
                                        <button
disabled={downloadingId === order.id}
onClick={(e) => {
    e.stopPropagation();
    generateOrderPDF(order);
}}
>
{downloadingId === order.id ? "Downloading PDF..." : "View PDF"}
</button>
                                        {order.status === "Pending" && (

                                            <button
                                                className="btn-paid"
                                                onClick={() => markPaid(order)}
                                            >
                                                Mark Paid
                                            </button>

                                        )}
                                        {/* {order.status === "Pending" && (

                                            <button
                                                className="btn-cancel"
                                                onClick={() => cancelOrder(order)}
                                            >
                                                Cancel Order
                                            </button>

                                        )} */}
                                         </div>

                                    </div>

                                    {/* PRODUCTS */}

                                    <div className="items-block">

                                        <h3>Products</h3>

                                        {(order.items || []).map((item, i) => (

                                            <div key={i} className="order-item">

                                                <img
                                                    src={item.images?.[0]?.url || item.image}
                                                    alt={item.productName}
                                                />

                                                <div className="item-info">

                                                    <div className="item-name">
                                                        {item.productName}
                                                    </div>

                                                    <div className="item-meta">
                                                        Code: {item.productCode}
                                                    </div>

                                                    {/* VARIANT */}

                                                    {item.variationLabel && (

                                                        <div className="item-meta">
                                                            {item.variationLabel}
                                                        </div>
                                                    )}

                                                    <div className="item-meta">
                                                        Qty: {item.quantity}
                                                    </div>

                                                    <div className="item-meta">
                                                        Price: ₹{item.priceAtTimeOfOrder}
                                                    </div>

                                                    <div className="item-meta">
                                                        Cost: ₹{item.costPrice}
                                                    </div>

                                                    <div className="item-meta">
                                                        Subtotal: ₹{(item.priceAtTimeOfOrder * item.quantity).toFixed(2)}
                                                    </div>

                                                </div>

                                            </div>

                                        ))}

                                    </div>

                                    {/* ORDER TOTALS */}

                                    <div className="order-summary-totals">

                                        <p>
                                            <strong>Subtotal:</strong> ₹{order.subtotal || 0}
                                        </p>

                                        <p>
                                            <strong>Shipping:</strong> ₹{order.shippingFee || 0}
                                        </p>

                                        <p>
                                            <strong>Total:</strong> ₹{order.totalAmount || 0}
                                        </p>

                                        <p>
                                            <strong>Total Profit:</strong> ₹{profit}
                                        </p>

                                    </div>

                                </div>

                            )}

                        </div>

                    );

                })}

            </div>

        </div>

    );

};

export default DropshipperOrders;
