import React, { useEffect, useState } from "react";
import {
    collection,
    getDocs,
    query,
    where
} from "firebase/firestore";
import { db } from "../firebase";
import "./ProductSalesPage.css"
import { Timestamp } from "firebase/firestore";
const ProductSalesPage = () => {

    const [collections, setCollections] = useState([]);
    const [subcollections, setSubcollections] = useState([]);
    const [products, setProducts] = useState([]);
    const [productSearch, setProductSearch] = useState("");
    const [showProductDropdown, setShowProductDropdown] = useState(false);

    const [selectedCollection, setSelectedCollection] = useState("");
    const [selectedSubcollection, setSelectedSubcollection] = useState("");
    const [selectedProduct, setSelectedProduct] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [sales, setSales] = useState([]);
    const [totalQty, setTotalQty] = useState(0);
    const [totalValue, setTotalValue] = useState(0);
const [stockLedger, setStockLedger] = useState([]);


    /* -----------------------------
    LOAD COLLECTIONS
    ----------------------------- */

    useEffect(() => {

        const loadCollections = async () => {

            const snap = await getDocs(collection(db, "collections"));

            setCollections(
                snap.docs.map(d => ({
                    id: d.id,
                    name: d.data().title || d.data().name
                }))
            );

        };

        loadCollections();

    }, []);



    /* -----------------------------
    LOAD SUBCOLLECTIONS
    ----------------------------- */

    useEffect(() => {

        if (!selectedCollection) return;

        const loadSubcollections = async () => {

            const snap = await getDocs(
                collection(db, "collections", selectedCollection, "subcollections")
            );

            setSubcollections(
                snap.docs.map(d => ({
                    id: d.id,
                    name: d.data().name
                }))
            );

        };

        loadSubcollections();

    }, [selectedCollection]);


const getInitialQty = (product) => {

  const variants =
    product.variations ||
    product.variants ||
    product.variation ||
    [];

  if (Array.isArray(variants) && variants.length > 0) {
    return variants.reduce(
      (sum, v) => sum + Number(v.initialQuantity || 0),
      0
    );
  }

  return Number(product.initialQuantity || 0);
};
    /* -----------------------------
    LOAD PRODUCTS
    ----------------------------- */

    useEffect(() => {

        if (!selectedCollection || !selectedSubcollection) return;

        const loadProducts = async () => {

            const snap = await getDocs(
                collection(
                    db,
                    "collections",
                    selectedCollection,
                    "subcollections",
                    selectedSubcollection,
                    "products"
                )
            );

          setProducts(
  snap.docs.map(d => {

    const data = d.data();

return {
  id: d.id,
  name: data.productName,
  productCode: data.productCode || "",
  type: data.type || "",

  initialQty: getInitialQty(data),

  availableQty:
    data.variations && data.variations.length > 0
      ? data.variations.reduce(
          (sum, v) => sum + Number(v.quantity || 0),
          0
        )
      : Number(data.quantity || 0)
};

  })
);

        };

        loadProducts();

    }, [selectedSubcollection]);



    /* -----------------------------
    DATE RANGE HELPER
    ----------------------------- */




    /* -----------------------------
    LOAD SALES
    ----------------------------- */

    useEffect(() => {



        if (!selectedProduct || !startDate || !endDate) return;

        const loadSales = async () => {



            const start = new Date(startDate + "T00:00:00");
            const end = new Date(endDate + "T23:59:59");

          const ordersQuery = query(
    collection(db, "orders"),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<=", Timestamp.fromDate(end))
);

const storeOrdersQuery = query(
    collection(db, "storeOrders"),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<=", Timestamp.fromDate(end))
);

const [ordersSnap, storeOrdersSnap] = await Promise.all([
    getDocs(ordersQuery),
    getDocs(storeOrdersQuery)
]);

            const rows = [];
const movements = [];

let qty = 0;
let value = 0;

           const processOrders = (snap, sourceType) => {

    snap.forEach(docSnap => {

        const order = docSnap.data();

        (order.items || []).forEach(item => {

            if (String(item.productId).trim() === String(selectedProduct).trim()) {

                const total = item.quantity * item.priceAtTimeOfOrder;

                rows.push({
                    orderId: docSnap.id,
                    source: sourceType,
                    status:
        order.status,
                    customerName:
                        order.billingInfo?.fullName ||
                        order.customerName ||
                        "Walk-in Customer",

                    date: order.createdAt?.toDate(),

                    productCode: item.productCode,

                    variant: {
                        color: item.variation?.color || "",
                        size: item.variation?.size || ""
                    },

                    qty: item.quantity,
                    price: item.priceAtTimeOfOrder,
                    total
                });
movements.push({
    date: order.createdAt?.toDate(),
    orderId: docSnap.id,
    customer:
        order.billingInfo?.fullName ||
        order.customerName ||
        "Walk-in Customer",
    source: sourceType,
    qty: Number(item.quantity),
    type: "SALE"
});
if (
  order.status === "Cancelled" ||
  order.status === "Canceled"
) {
  const cancelledDate =
    order.cancelledAt?.toDate
      ? order.cancelledAt.toDate()
      : new Date(order.cancelledAt);

 movements.push({
    date: cancelledDate,
    orderId: docSnap.id,
    customer:
        order.billingInfo?.fullName ||
        order.customerName ||
        "Walk-in Customer",
    source: sourceType,
    qty: Number(item.quantity),
    type: "CANCELLED"
});
}
                qty += item.quantity;
                value += total;
            }

        });

    });

};

processOrders(ordersSnap, "Online");
processOrders(storeOrdersSnap, "Store");
const selectedProductData = products.find(
  p => p.id === selectedProduct
);

const openingStock =
  Number(selectedProductData?.initialQty || 0);

movements.sort(
  (a, b) => new Date(a.date) - new Date(b.date)
);

let runningBalance = openingStock;

const ledgerRows = [
  {
    date: null,
    description: "Opening Stock",
    change: openingStock,
    balance: openingStock
  }
];

movements.forEach(m => {

  if (m.type === "SALE") {

    runningBalance -= m.qty;

    ledgerRows.push({
      date: m.date,
      description: `${m.customer} (${m.source})`,
      change: -m.qty,
      balance: runningBalance
    });

  }

  else if (m.type === "CANCELLED") {

    runningBalance += m.qty;

    ledgerRows.push({
      date: m.date,
      description: `${m.customer} (${m.source}) - Cancelled`,
      change: +m.qty,
      balance: runningBalance
    });

  }

});
            rows.sort((a, b) => {
                const dateA = a.date ? new Date(a.date).getTime() : 0;
                const dateB = b.date ? new Date(b.date).getTime() : 0;
                return dateB - dateA;
            });
setStockLedger(ledgerRows);
            setSales(rows);
            setTotalQty(qty);
            setTotalValue(value);

        };

        loadSales();

    }, [selectedProduct, startDate, endDate]);


    const filteredProducts = products.filter(p =>
        (`${p.productCode} ${p.name} ${p.type || ""}`)
            .toLowerCase()
            .includes(productSearch.toLowerCase())
    );

    const selectedProductData = products.find(p => p.id === selectedProduct);
    /* -----------------------------
    UI
    ----------------------------- */

    return (

        <div className="sales-page">

            <h2>Product Sales Tracker</h2>



            {/* COLLECTION */}

            <select
                value={selectedCollection}
                onChange={e => setSelectedCollection(e.target.value)}
            >

                <option value="">Select Collection</option>

                {collections.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                ))}

            </select>



            {/* SUBCOLLECTION */}

            <select
                value={selectedSubcollection}
                onChange={e => setSelectedSubcollection(e.target.value)}
            >

                <option value="">Select Subcollection</option>

                {subcollections.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                ))}

            </select>



            {/* PRODUCT */}
            {/* PRODUCT SEARCH */}

            {/* PRODUCT SEARCH DROPDOWN */}

<div className="product-search-wrapper">

<input
type="text"
placeholder="Search product code / name"
value={productSearch}
onChange={(e)=>{
setProductSearch(e.target.value);
setShowProductDropdown(true);
}}
onFocus={()=>setShowProductDropdown(true)}
className="product-search-input"
/>

{showProductDropdown && (

<div className="product-search-dropdown">

{filteredProducts.length === 0 && (
<div className="product-search-empty">
No products found
</div>
)}

{filteredProducts.map(p => (

<div
key={p.id}
className="product-search-item"
onClick={()=>{
setSelectedProduct(p.id);
setProductSearch(`${p.productCode} — ${p.name}`);
setShowProductDropdown(false);
}}
>

<span className="product-code">{p.productCode}</span>

<span className="product-name">{p.name}</span>

{p.type && (
<span className="product-type">{p.type}</span>
)}


</div>

))}

</div>

)}

</div>
{selectedProductData && (
  <div className="stock-info">

    <div>
      Initial Stock: {selectedProductData.initialQty}
    </div>

    <div>
      Available Stock: {selectedProductData.availableQty}
    </div>

    <div>
      Sold In Selected Range: {totalQty}
    </div>

  </div>
)}

            {/* RANGE BUTTONS */}

            <div className="date-range">

                <label>Start Date</label>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                />

                <label>End Date</label>
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                />

            </div>


            {/* SALES TABLE */}

            <table className="sales-table">

                <thead>

                    <tr>
                        <th>Date</th>
<th>Order</th>
<th>Source</th>
<th>Customer</th>
<th>Variant</th>
<th>Qty</th>
<th>Status</th>
<th>Price</th>
<th>Total</th>

                    </tr>
                </thead>

                <tbody>

                    {sales.map((s, i) => (
                        <tr key={i}>
                            <td>
  {s.date
    ? new Date(s.date).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "-"}
</td>

                            <td>{s.orderId}</td>
                            <td>{s.source}</td>

                            <td>{s.customerName}</td>
                            <td>
{s.variant?.color} {s.variant?.size}
</td>

                            <td>{s.qty}</td>
                            <td>{s.status}</td>

                            <td>₹{s.price}</td>

                            <td>₹{s.total}</td>
                        </tr>
                    ))}

                </tbody>

            </table>



            <div className="sales-summary">

                <div>Total Sold: {totalQty}</div>

                <div>Total Revenue: ₹{totalValue}</div>

            </div>
            {stockLedger.length > 0 && (

<div className="ledger-section">

<h3>Stock Movement Ledger</h3>

<table className="ledger-table">

<thead>
<tr>
<th>Date</th>
<th>Description</th>
<th>Change</th>
<th>Balance</th>
</tr>
</thead>

<tbody>

{stockLedger.map((row, index) => (

<tr key={index}>

<td>
  {row.date
    ? new Date(row.date).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "-"}
</td>

<td>{row.description}</td>

<td>
{row.change > 0
? `+${row.change}`
: row.change}
</td>

<td>{row.balance}</td>

</tr>

))}

</tbody>

</table>

</div>

)}



        </div>

    );

};

export default ProductSalesPage;