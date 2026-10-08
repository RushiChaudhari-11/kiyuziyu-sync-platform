import React, { useEffect, useState } from "react";
import {
    collection,
    getDocs,
    updateDoc,
    doc,runTransaction,
    getDoc
} from "firebase/firestore";

import { db } from "../firebase";

import jsPDF from "jspdf";

import "./AdminStoreOrders.css";

const AdminStoreOrders = () => {

    const [orders, setOrders] = useState([]);
    const [sellers, setSellers] = useState({});
    const [expandedOrder, setExpandedOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter,setStatusFilter] = useState("All");
    const [downloadingId, setDownloadingId] = useState(null);
    const [sellerFilter, setSellerFilter] = useState("All");
    /* ================= LOAD DATA ================= */

    useEffect(() => {

        const loadData = async () => {

            try {

                const ordersSnap = await getDocs(collection(db, "storeOrders"));

                const ordersList = ordersSnap.docs
                    .map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }))
                    .sort((a, b) => {

                        const aTime = a.createdAt?.seconds || 0;
                        const bTime = b.createdAt?.seconds || 0;

                        return bTime - aTime; // newest first

                    });

   await calculateAdminProfits(ordersList);

setOrders(ordersList);


                /* SELLERS */

                const sellersSnap = await getDocs(collection(db, "users"));

                const sellerMap = {};

                sellersSnap.docs.forEach(doc => {
                    sellerMap[doc.id] = doc.data();
                });

                setSellers(sellerMap);

            } catch (err) {
                console.error("Admin orders load error:", err);
            }

            setLoading(false);

        };

        loadData();

    }, []);

    /* ================= PROFIT ================= */

   const calculateOrderSummary = (order)=>{

let costTotal = 0;
let sellingTotal = 0;
let totalQty = 0;

(order.items || []).forEach(item=>{

const qty = item.quantity || 0;

costTotal += (item.costPrice || 0) * qty;
sellingTotal += (item.priceAtTimeOfOrder || 0) * qty;
totalQty += qty;

});

const profit = sellingTotal - costTotal;

const shipping = order.shippingFee || 0;

const payableToAdmin = costTotal + shipping;

return {
costTotal,
sellingTotal,
profit,
shipping,
payableToAdmin,
totalQty
};

};

    /* ================= UPDATE STATUS ================= */
const calculateAdminProfits = async (ordersList) => {

const subcollections = new Set();

/* COLLECT UNIQUE SUBCOLLECTIONS */

ordersList.forEach(order => {
(order.items || []).forEach(item => {
subcollections.add(`${item.collectionId}_${item.subcollectionId}`);
});
});

/* FETCH PURCHASE RATES ONCE */

const purchaseRateMap = {};

await Promise.all(

[...subcollections].map(async key => {

const [collectionId, subcollectionId] = key.split("_");

const ref = doc(
db,
"collections",
collectionId,
"subcollections",
subcollectionId
);

const snap = await getDoc(ref);

purchaseRateMap[key] = snap.exists()
? snap.data().purchaseRate || 0
: 0;

})

);

/* CALCULATE PROFITS */

ordersList.forEach(order => {

if (order.adminProfit !== undefined) return;

let storeCostTotal = 0;
let adminPurchaseTotal = 0;

(order.items || []).forEach(item => {

const qty = item.quantity || 0;

const key = `${item.collectionId}_${item.subcollectionId}`;

const purchaseRate = purchaseRateMap[key] || 0;

storeCostTotal += (item.costPrice || 0) * qty;
adminPurchaseTotal += purchaseRate * qty;

});

order.adminProfit = storeCostTotal - adminPurchaseTotal;
order.adminPurchaseTotal = adminPurchaseTotal;

});

/* SAVE TO FIRESTORE */

await Promise.all(

ordersList
.filter(order => order.adminProfit !== undefined)
.map(order =>

updateDoc(doc(db, "storeOrders", order.id), {
adminProfit: order.adminProfit,
adminPurchaseTotal: order.adminPurchaseTotal
})

)

);

};
    const updateOrderStatus = async (order, status) => {

        try {

            const orderRef = doc(db, "storeOrders", order.id);

            await updateDoc(orderRef, {
                status: status,
                updatedAt: Date.now()
            });

            setOrders(prev =>
                prev.map(o =>
                    o.id === order.id
                        ? { ...o, status }
                        : o
                )
            );

        } catch (err) {
            console.error("Status update failed", err);
        }

    };

    /* ================= PDF ================= */

    const getBase64FromUrl = async (url) => {

        const data = await fetch(url);
        const blob = await data.blob();

        return new Promise(resolve => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => resolve(reader.result);
        });

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
const sellerOptions = Array.from(
  new Map(
    orders.map(order => {
      const seller = sellers[order.sellerId];
      

      return [
        order.sellerId,
        {
          id: order.sellerId,
          name:
            seller?.storeName ||
            seller?.name ||
            "Unknown Seller"
        }
      ];
    })
  ).values()
);
  const filteredOrders = orders.filter(order => {

  const seller = sellers[order.sellerId];

  const searchText = search.toLowerCase();

  const matchesSearch =
    order.id.toLowerCase().includes(searchText) ||
    order.billingInfo?.fullName?.toLowerCase().includes(searchText) ||
    seller?.name?.toLowerCase().includes(searchText) ||
    seller?.storeName?.toLowerCase().includes(searchText);

  const matchesStatus =
    statusFilter === "All" || order.status === statusFilter;

  const matchesSeller =
    sellerFilter === "All" ||
    order.sellerId === sellerFilter;

  return matchesSearch && matchesStatus && matchesSeller;

});
    /* ================= DATE ================= */

    const formatDate = (timestamp) => {

        if (!timestamp) return "";

        try {
            return new Date(timestamp.seconds * 1000).toLocaleString();
        } catch {
            return "";
        }

    };

    const getOrderDate = (order) => {
  if (!order.createdAt?.seconds) return "Unknown Date";

  return new Date(
    order.createdAt.seconds * 1000
  ).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};
    if (loading) {
        return <div className="admin-loading">Loading orders...</div>;
    }

    /* ================= UI ================= */

    return (

        <div className="admin-orders">

            <h1>Marketplace Orders</h1>
           <div className="orders-toolbar">

  {/* SELLER FILTER */}
  <select
    value={sellerFilter}
    onChange={(e) => setSellerFilter(e.target.value)}
    className="orders-filter"
  >
    <option value="All">All Sellers</option>

    {sellerOptions.map((seller) => (
      <option
        key={seller.id}
        value={seller.id}
      >
        {seller.name}
      </option>
    ))}
  </select>

  {/* STATUS FILTER */}
  <select
    value={statusFilter}
    onChange={(e) => setStatusFilter(e.target.value)}
    className="orders-filter"
  >
    <option value="All">All Orders</option>
    <option value="Pending">Pending</option>
    <option value="ReadyToPack">Ready To Pack</option>
    <option value="Packed">Packed</option>
    <option value="Dispatched">Dispatched</option>
    <option value="Cancelled">Cancelled</option>
  </select>

  {/* SEARCH */}
  <input
    type="text"
    placeholder="Search order / customer / seller"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="orders-search"
  />

</div>

            <div className="orders-table">

                {filteredOrders.map((order, index) => {

   const seller = sellers[order.sellerId];

const summary = calculateOrderSummary(order);
const profit = summary.profit;
const adminProfit = order.adminProfit || 0;

const isExpanded = expandedOrder === order.id;

const currentDate = getOrderDate(order);

const previousDate =
    index > 0
        ? getOrderDate(filteredOrders[index - 1])
        : null;

const showDateHeader =
    index === 0 || currentDate !== previousDate;

/* ADD HERE */

    return (
        <React.Fragment key={order.id}>

            {showDateHeader && (
  <div className="orders-date-divider">

    <div>
      <strong>{currentDate}</strong>
    </div>

    <div
     
    >
    
    </div>

  </div>
)}

            <div className="order-row">

                            {/* SUMMARY */}

                            <div
                                className="order-summary"
                                onClick={() => setExpandedOrder(
                                    isExpanded ? null : order.id
                                )}
                            >

                                <div className="order-id">
                                    #{order.id.slice(0, 8)}
                                </div>

                                <div className="order-seller">
                                    {seller?.name || seller?.storeName || "Seller"}
                                </div>

                                <div className="order-customer">
                                    {order.billingInfo?.fullName}
                                </div>

                                <div className={`order-status status-${(order.status || "pending").toLowerCase()}`}>
                                    {order.status}
                                </div>

                                <div className="order-total">
                                    ₹{order.totalAmount}
                                </div>

                                <div className="order-profit">
₹{profit}
</div>

<div className="order-payable">
₹{summary.payableToAdmin}
</div>
<div className="order-profit">
₹{adminProfit}
</div>




                            </div>

                            {/* EXPANDED */}

                            {isExpanded && (

                                <div className="order-details">

                                    {/* CUSTOMER */}

                                    <div className="customer-block">

                                        <h3>Customer Details</h3>

                                        <p><strong>Name:</strong> {order.billingInfo?.fullName}</p>

                                        <p><strong>Email:</strong> {order.billingInfo?.email}</p>

                                        <p><strong>Phone:</strong> {order.billingInfo?.phoneNumber}</p>

                                        <p><strong>Address:</strong> {order.billingInfo?.addressLine1}</p>

                                        <p><strong>City:</strong> {order.billingInfo?.city}</p>

                                        <p><strong>Date:</strong> {formatDate(order.createdAt)}</p>
                                                    <p><strong>Admin Profit:</strong> ₹{order.adminProfit || 0}</p>

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
                                                    onClick={() => updateOrderStatus(order, "ReadyToPack")}
                                                >
                                                    Mark Paid
                                                </button>

                                            )}
                                            {order.status === "ReadyToPack" && (
  <button
    className="btn-paid"
    onClick={() => updateOrderStatus(order, "Packed")}
  >
    Mark Packed
  </button>
)}

{order.status === "Packed" && (
  <button
    className="btn-paid"
    onClick={() => updateOrderStatus(order, "Dispatched")}
  >
    Mark Dispatched
  </button>
)}

                                            {order.status !== "Cancelled" && (

                                                <button
                                                    className="btn-cancel"
                                                    onClick={() => cancelOrder(order)}
                                                >
                                                    Cancel Order
                                                </button>

                                            )}

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

                                                </div>

                                            </div>

                                        ))}

                                    </div>

                                    {/* TOTALS */}

                                    <div className="order-summary-totals">

                                        <p><strong>Subtotal:</strong> ₹{order.subtotal}</p>

                                        <p><strong>Shipping:</strong> ₹{order.shippingFee}</p>

                                        <p><strong>Total:</strong> ₹{order.totalAmount}</p>

                                        <p><strong>Seller Profit:</strong> ₹{profit}</p>

<p><strong>Admin Payable:</strong> ₹{summary.payableToAdmin}</p>


                                    </div>

                                </div>

                            )}

                        </div>
  </React.Fragment>
                    );

                })}

            </div>

        </div>

    );

};

export default AdminStoreOrders;