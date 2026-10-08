import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";

import "./AdminSellerProfits.css";

const AdminSellerProfits = () => {

  const [sellers, setSellers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  /* =========================
     LOAD DATA
  ========================= */

  useEffect(() => {

    const loadData = async () => {

      try {

        /* SELLERS */

        const sellersSnap = await getDocs(
          collection(db, "users")
        );

        const sellersList = sellersSnap.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter(u => u.role === "dropshipper");

        /* ORDERS */

        const ordersSnap = await getDocs(
          collection(db, "storeOrders")
        );

        const ordersList = ordersSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        /* PAYMENTS */

        const paymentsSnap = await getDocs(
          collection(db, "adminPayments")
        );

        const paymentsList = paymentsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setSellers(sellersList);
        setOrders(ordersList);
        setPayments(paymentsList);

      } catch (err) {

        console.error(
          "Admin seller payments load error:",
          err
        );

      }

      setLoading(false);

    };

    loadData();

  }, []);

  /* =========================
     ORDER CALCULATION
  ========================= */

  const calculateOrder = (order) => {

    let costTotal = 0;
    let sellingTotal = 0;
    let totalQty = 0;

    (order.items || []).forEach(item => {

      const qty = item.quantity || 0;

      costTotal +=
        (item.costPrice || 0) * qty;

      sellingTotal +=
        (item.priceAtTimeOfOrder || 0) * qty;

      totalQty += qty;

    });

    const profit = sellingTotal - costTotal;

    const shipping = order.shippingFee || 0;

    const payableToAdmin =
      costTotal + shipping;

    return {
      costTotal,
      sellingTotal,
      profit,
      shipping,
      payableToAdmin,
      totalQty
    };

  };

  /* =========================
     SELLER STATS
  ========================= */

  const getSellerStats = (sellerId) => {

    const sellerOrders = orders.filter(
      o =>
        o.sellerId === sellerId &&
        o.status !== "Cancelled"
    );

    let totalOrders = 0;
    let totalQty = 0;

    let totalCost = 0;
    let totalSelling = 0;
    let totalProfit = 0;
    let totalShipping = 0;
    let totalPayable = 0;

    sellerOrders.forEach(order => {

      const calc = calculateOrder(order);

      totalOrders += 1;

      totalQty += calc.totalQty;

      totalCost += calc.costTotal;

      totalSelling += calc.sellingTotal;

      totalProfit += calc.profit;

      totalShipping += calc.shipping;

      totalPayable += calc.payableToAdmin;

    });

    /* PAYMENTS */

    const sellerPayments = payments.filter(
      p => p.sellerId === sellerId
    );

    const totalPaid = sellerPayments.reduce(
      (sum, p) => sum + (p.amount || 0),
      0
    );

    /* PENDING */

    const pending = totalPayable - totalPaid;

    return {
      totalOrders,
      totalQty,
      totalCost,
      totalSelling,
      totalProfit,
      totalShipping,
      totalPayable,
      totalPaid,
      pending
    };

  };

  /* =========================
     LOADING
  ========================= */

  if (loading) {
    return (
      <div className="admin-loading">
        Loading...
      </div>
    );
  }

  /* =========================
     UI
  ========================= */

  return (

    <div className="seller-profits">

      <h1>Seller Payments</h1>

      <div className="profits-table">

        {/* HEADER */}

        <div className="table-header">

          <div>Seller</div>

          <div>Total Orders</div>

          <div>Total Qty</div>

          <div>Cost Total</div>

          <div>Selling Total</div>

          <div>Profit</div>

          <div>Shipping</div>

          <div>Payable To Admin</div>

          <div>Paid</div>

          <div>Pending</div>

        </div>

        {/* ROWS */}

        {sellers.map(seller => {

          const stats = getSellerStats(seller.id);

          return (

            <div
  key={seller.id}
  className="table-row clickable"
  onClick={() =>
    navigate(
      `/admin/reseller-payments/${seller.id}`
    )
  }
>

              <div>
                {seller.name ||
                  seller.storeName ||
                  "Seller"}
              </div>

              <div>
                {stats.totalOrders}
              </div>

              <div>
                {stats.totalQty}
              </div>

              <div>
                ₹{Number(
                  stats.totalCost
                ).toFixed(2)}
              </div>

              <div>
                ₹{Number(
                  stats.totalSelling
                ).toFixed(2)}
              </div>

              <div className="profit">
                ₹{Number(
                  stats.totalProfit
                ).toFixed(2)}
              </div>

              <div>
                ₹{Number(
                  stats.totalShipping
                ).toFixed(2)}
              </div>

              <div className="admin-payable">
                ₹{Number(
                  stats.totalPayable
                ).toFixed(2)}
              </div>

              <div className="paid">
                ₹{Number(
                  stats.totalPaid
                ).toFixed(2)}
              </div>

              <div className="pending">
                ₹{Number(
                  stats.pending
                ).toFixed(2)}
              </div>

            </div>

          );

        })}

      </div>

    </div>

  );

};

export default AdminSellerProfits;