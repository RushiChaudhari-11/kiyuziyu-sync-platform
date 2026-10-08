import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";

import { db } from "../firebase";
import "./StockCheckPage.css";
import * as XLSX from "xlsx";

const StockCheckPage = () => {

  const [collections, setCollections] = useState([]);
  const [subcollections, setSubcollections] = useState([]);
  const [products, setProducts] = useState([]);

  const [selectedCollection, setSelectedCollection] = useState("");
  const [selectedSubcollection, setSelectedSubcollection] = useState("");

  const [rows, setRows] = useState([]);
const [search, setSearch] = useState("");
  /* =========================
     LOAD COLLECTIONS
  ========================= */

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

  /* =========================
     LOAD SUBCOLLECTIONS
  ========================= */

  useEffect(() => {

    if (!selectedCollection) return;

    const loadSubcollections = async () => {

      const snap = await getDocs(
        collection(
          db,
          "collections",
          selectedCollection,
          "subcollections"
        )
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

  /* =========================
     LOAD PRODUCTS + STOCK CHECK
  ========================= */

  useEffect(() => {

    if (!selectedCollection || !selectedSubcollection) return;

    const loadData = async () => {

      /* -------------------------
         LOAD PRODUCTS
      ------------------------- */

      const productSnap = await getDocs(
        collection(
          db,
          "collections",
          selectedCollection,
          "subcollections",
          selectedSubcollection,
          "products"
        )
      );

      const loadedProducts = productSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      setProducts(loadedProducts);

      /* -------------------------
         LOAD PENDING ORDERS
      ------------------------- */

      const pendingOrdersQ = query(
        collection(db, "orders"),
        where("status", "==", "Pending")
      );

      const pendingStoreOrdersQ = query(
        collection(db, "storeOrders"),
        where("status", "==", "Pending")
      );

      const [ordersSnap, storeOrdersSnap] = await Promise.all([
        getDocs(pendingOrdersQ),
        getDocs(pendingStoreOrdersQ)
      ]);

      const finalRows = [];

      /* =========================
         BUILD PRODUCT ROWS
      ========================= */

      loadedProducts.forEach(product => {

        const variations = product.variations || [];

        /* -------------------------
           VARIANT PRODUCTS
        ------------------------- */

        if (variations.length > 0) {

          variations.forEach(variation => {

            let pendingQty = 0;
            let storePendingQty = 0;

            /* ONLINE PENDING */

            ordersSnap.forEach(orderDoc => {

              const order = orderDoc.data();

              (order.items || []).forEach(item => {

                const sameProduct =
                  String(item.productId) === String(product.id);

                const sameVariant =
                  item.variation?.color === variation.color &&
                  item.variation?.size === variation.size;

                if (sameProduct && sameVariant) {
                  pendingQty += Number(item.quantity || 0);
                }

              });

            });

            /* STORE PENDING */

            storeOrdersSnap.forEach(orderDoc => {

              const order = orderDoc.data();

              (order.items || []).forEach(item => {

                const sameProduct =
                  String(item.productId) === String(product.id);

                const sameVariant =
                  item.variation?.color === variation.color &&
                  item.variation?.size === variation.size;

                if (sameProduct && sameVariant) {
                  storePendingQty += Number(item.quantity || 0);
                }

              });

            });

            const availableQty = Number(variation.quantity || 0);

            const totalBlocked =
              pendingQty + storePendingQty;
            if ((availableQty + totalBlocked) > 0) {
            finalRows.push({
              productName: product.productName,
              productCode: product.productCode,

              variant:
                `${variation.color || ""} ${variation.size || ""}`,

              availableQty,
              pendingQty,
              storePendingQty,
              totalBlocked,

              netAvailable:
                availableQty + totalBlocked
            });
        }



          });

        }

        /* -------------------------
           SIMPLE PRODUCTS
        ------------------------- */

        else {

          let pendingQty = 0;
          let storePendingQty = 0;

          ordersSnap.forEach(orderDoc => {

            const order = orderDoc.data();

            (order.items || []).forEach(item => {

              if (
                String(item.productId) === String(product.id)
              ) {
                pendingQty += Number(item.quantity || 0);
              }

            });

          });

          storeOrdersSnap.forEach(orderDoc => {

            const order = orderDoc.data();

            (order.items || []).forEach(item => {

              if (
                String(item.productId) === String(product.id)
              ) {
                storePendingQty += Number(item.quantity || 0);
              }

            });

          });

          const availableQty =
            Number(product.quantity || 0);

          const totalBlocked =
            pendingQty + storePendingQty;

          if ((availableQty + totalBlocked) > 0) {

  finalRows.push({
    productName: product.productName,
    productCode: product.productCode,

    variant: "-",

    availableQty,
    pendingQty,
    storePendingQty,
    totalBlocked,

    netAvailable:
      availableQty + totalBlocked
  });

}

        }

      });

      setRows(finalRows);

    };

    loadData();

  }, [selectedCollection, selectedSubcollection]);

  /* =========================
     UI
  ========================= */
const exportToExcel = () => {

  const exportData = rows.map(r => ({
    Product: r.productName,
    Code: r.productCode,
    Variant: r.variant,
    Available: r.availableQty,
    Pending: r.pendingQty,
    "Store Pending": r.storePendingQty,
    "Total Blocked": r.totalBlocked,
    "Net Available At Store": r.netAvailable
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Stock Check"
  );

  XLSX.writeFile(
    workbook,
    "stock-check.xlsx"
  );

};
const filteredRows = rows.filter(r => {

  const text = `
    ${r.productName}
    ${r.productCode}
    ${r.variant}
  `.toLowerCase();

  return text.includes(search.toLowerCase());

});
  return (

    <div className="stock-check-page">

      <h2>Stock Check</h2>

      {/* COLLECTION */}

      <select
        value={selectedCollection}
        onChange={e => setSelectedCollection(e.target.value)}
      >

        <option value="">Select Collection</option>

        {collections.map(c => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}

      </select>

      {/* SUBCOLLECTION */}

      <select
        value={selectedSubcollection}
        onChange={e => setSelectedSubcollection(e.target.value)}
      >

        <option value="">Select Subcollection</option>

        {subcollections.map(s => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}

      </select>

      {/* TABLE */}
<div className="stock-top-bar">

  <input
    type="text"
    placeholder="Search product / code / variant"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="stock-search"
  />

  <button
    className="export-btn"
    onClick={exportToExcel}
  >
    Export Excel
  </button>

</div>
      <table className="stock-table">

        <thead>

          <tr>
            <th>Product</th>
            <th>Code</th>
            <th>Variant</th>
            <th>Available</th>
            <th>Pending</th>
            <th>Store Pending</th>
            <th>Total Blocked</th>
            <th>Net Available At Store</th>
          </tr>

        </thead>

        <tbody>

          {filteredRows.map((r, i) => (

            <tr key={i}>

              <td>{r.productName}</td>

              <td>{r.productCode}</td>

              <td>{r.variant}</td>

              <td>{r.availableQty}</td>

              <td>{r.pendingQty}</td>

              <td>{r.storePendingQty}</td>

              <td>{r.totalBlocked}</td>

              <td>{r.netAvailable}</td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  );

};

export default StockCheckPage;