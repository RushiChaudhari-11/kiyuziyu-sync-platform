import React, { useEffect, useState } from "react";
import {
  collection,
  collectionGroup,
  getDocs
} from "firebase/firestore";
import { db } from "../firebase";
import "./InventorySummaryPage.css";
const InventorySummaryPage = () => {

  const [rows, setRows] = useState([]);
  const [totalQty, setTotalQty] = useState(0);
  const [totalValue, setTotalValue] = useState(0);

  const getProductQty = (product) => {

  const variants =
    product.variations ||
    product.variants ||
    product.variation ||
    [];

  if (Array.isArray(variants) && variants.length > 0) {

    let total = 0;

    for (const v of variants) {
      total += Number(v.quantity || 0);
    }

    return total;
  }

  return Number(product.quantity || 0);
};

  const loadInventory = async () => {

    const stats = {};

    // 1️⃣ Fetch all collections
    const collectionsSnap = await getDocs(collection(db, "collections"));

    const subcollectionMap = {};

    for (const colDoc of collectionsSnap.docs) {

      const collectionId = colDoc.id;
      const collectionName =
        colDoc.data().title || colDoc.data().name || collectionId;

      const subSnap = await getDocs(
        collection(db, "collections", collectionId, "subcollections")
      );

      subSnap.forEach(subDoc => {

        const subcollectionId = subDoc.id;

        subcollectionMap[`${collectionId}_${subcollectionId}`] = {
          collectionName,
          subcollectionName: subDoc.data().name,
          purchaseRate: Number(subDoc.data().purchaseRate || 0)
        };

      });

    }

    // 2️⃣ Fetch all products
    const productSnap = await getDocs(collectionGroup(db, "products"));

    productSnap.forEach(docSnap => {

      const product = docSnap.data();

      const pathParts = docSnap.ref.path.split("/");

      const collectionId =
        pathParts[pathParts.indexOf("collections") + 1];

      const subcollectionId =
        pathParts[pathParts.indexOf("subcollections") + 1];

      const key = `${collectionId}_${subcollectionId}`;

      const meta = subcollectionMap[key];

      if (!meta) return;

      const qty = getProductQty(product);

      if (qty <= 0) return;

      const value = qty * meta.purchaseRate;

      const statsKey = `${meta.collectionName}_${meta.subcollectionName}`;

      if (!stats[statsKey]) {

        stats[statsKey] = {
          collection: meta.collectionName,
          subcollection: meta.subcollectionName,
          qty: 0,
          value: 0
        };

      }

      stats[statsKey].qty += qty;
      stats[statsKey].value += value;

    });

    const result = Object.values(stats);

    const totalQtyCalc =
      result.reduce((sum, r) => sum + r.qty, 0);

    const totalValueCalc =
      result.reduce((sum, r) => sum + r.value, 0);

    setRows(result);
    setTotalQty(totalQtyCalc);
    setTotalValue(totalValueCalc);

  };

  useEffect(() => {
    loadInventory();
  }, []);

 return (
  <div className="inventory-container">

    <h2 className="inventory-header-title">
      Inventory Summary
    </h2>
    <div className="inventory-stats">

  <div className="inventory-stat-card">

    <span className="inventory-stat-title">
      Total Inventory Value
    </span>

    <span className="inventory-stat-value">
      ₹{totalValue.toLocaleString()}
    </span>

  </div>

  <div className="inventory-stat-card">

    <span className="inventory-stat-title">
      Total Units in Stock
    </span>

    <span className="inventory-stat-value">
      {totalQty.toLocaleString()}
    </span>

  </div>

  <div className="inventory-stat-card">

    <span className="inventory-stat-title">
      Total Collections
    </span>

    <span className="inventory-stat-value">
      {
        Object.keys(
          rows.reduce((acc, r) => {
            acc[r.collection] = true;
            return acc;
          }, {})
        ).length
      }
    </span>

  </div>

</div>

    {Object.entries(
      rows.reduce((grouped, row) => {

        if (!grouped[row.collection]) {
          grouped[row.collection] = [];
        }

        grouped[row.collection].push(row);

        return grouped;

      }, {})
    ).map(([collectionName, subcollections]) => {

      const collectionQty =
        subcollections.reduce((sum, item) => sum + item.qty, 0);

      const collectionValue =
        subcollections.reduce((sum, item) => sum + item.value, 0);

      return (

        <details
          key={collectionName}
          className="inventory-collection-card"
        >

          <summary className="inventory-collection-header">

            <span className="inventory-collection-name">
              {collectionName}
            </span>

            <span className="inventory-collection-qty">
              {collectionQty}
            </span>

            <span className="inventory-collection-value">
              ₹{collectionValue.toLocaleString()}
            </span>

          </summary>

          <div className="inventory-subcollection-wrapper">

            {subcollections.map((subItem, index) => (
              <div
                key={index}
                className="inventory-subcollection-row"
              >

                <span className="inventory-subcollection-name">
                  {subItem.subcollection}
                </span>

                <span className="inventory-subcollection-qty">
                  {subItem.qty}
                </span>

                <span className="inventory-subcollection-value">
                  ₹{subItem.value.toLocaleString()}
                </span>

              </div>
            ))}

          </div>

        </details>

      );

    })}

    <div className="inventory-grand-total">

      <span className="inventory-total-label">
        Total
      </span>

      <span className="inventory-total-qty">
        {totalQty}
      </span>

      <span className="inventory-total-value">
        ₹{totalValue.toLocaleString()}
      </span>

    </div>

  </div>
);
};

export default InventorySummaryPage;