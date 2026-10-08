import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import './UserOrdersPage.css';

/* ------------------ HELPERS ------------------ */
const formatDate = (timestamp) => {
  if (!timestamp) return '—';
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toLocaleDateString('en-IN');
  }
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000).toLocaleDateString('en-IN');
  }
  return new Date(timestamp).toLocaleDateString('en-IN');
};

const deepClone = (obj) => structuredClone(obj);

const getMillis = (ts) => {
  if (!ts) return 0;
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (ts.seconds) return ts.seconds * 1000;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? 0 : d.getTime();
};

/* ------------------ COMPONENT ------------------ */
export default function OrderEditPage() {
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editableOrder, setEditableOrder] = useState(null);

  // ✅ DATE FILTER STATE
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  /* ------------------ FETCH ORDERS ------------------ */
  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'orders'));
        const data = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        setOrders(data);
      } catch (err) {
        console.error('Failed to load orders:', err);
      }
      setLoading(false);
    };

    fetchOrders();
  }, []);

  const toggleOrder = (orderId) => {
    if (editingOrderId) return;
    setExpandedOrderId(prev => (prev === orderId ? null : orderId));
  };

  /* ------------------ FILTER BY DATE ------------------ */
  const filteredOrders = orders.filter(order => {
    if (!order.createdAt) return false;
    const orderTime = getMillis(order.createdAt);

    if (fromDate) {
      const fromTime = new Date(fromDate).setHours(0, 0, 0, 0);
      if (orderTime < fromTime) return false;
    }

    if (toDate) {
      const toTime = new Date(toDate).setHours(23, 59, 59, 999);
      if (orderTime > toTime) return false;
    }

    return true;
  });

  /* ------------------ PROFIT CALCULATIONS ------------------ */
  const totalProfit = filteredOrders.reduce(
    (sum, o) => sum + Number(o.orderProfit || 0),
    0
  );

  const cancelledProfit = filteredOrders
    .filter(o => o.status?.toLowerCase() === 'cancelled')
    .reduce((sum, o) => sum + Number(o.orderProfit || 0), 0);

  const netProfit = totalProfit - cancelledProfit;
const totalSales = filteredOrders
  .filter(o => o.status !== 'Cancelled')
  .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

const totalShipping = filteredOrders
  .filter(o => o.status !== 'Cancelled')
  .reduce((sum, o) => sum + Number(o.shippingFee || 0), 0);

const totalOrders = filteredOrders.filter(
  o => o.status !== 'Cancelled'
).length;
  /* ------------------ RECALCULATION ------------------ */
  const recalculateOrder = (order) => {
  let subtotal = 0;
  let purchaseCost = 0;

  const updatedItems = order.items.map(item => {
    const qty = Number(item.quantity || 0);
    const sell = Number(item.priceAtTimeOfOrder || 0);
    const cost = Number(item.purchaseRateAtOrder || 0);

    const itemSubtotal = qty * sell;
    const itemPurchase = qty * cost;
    const itemProfit = itemSubtotal - itemPurchase;

    subtotal += itemSubtotal;
    purchaseCost += itemPurchase;

    return { ...item, itemProfit };
  });

  const shippingFee = Number(order.shippingFee || 0);
  const couponDiscount = Number(order.couponDiscount || 0);

  // ✅ FIXED TOTAL
  const totalAmount =
    Math.max(0, subtotal - couponDiscount + shippingFee);

  // ✅ FIXED PROFIT
  const orderProfit =
    Math.max(0, subtotal - couponDiscount - purchaseCost);

  return {
    items: updatedItems,
    subtotal,
    couponDiscount,
    totalAmount,
    orderPurchaseCost: purchaseCost,
    orderProfit,
  };
};


  /* ------------------ SAVE EDIT ------------------ */
  const saveEditedOrder = async () => {
    const recalculated = recalculateOrder(editableOrder);
    const orderRef = doc(db, 'orders', editableOrder.id);

  await updateDoc(orderRef, {
  items: recalculated.items,
  subtotal: recalculated.subtotal,
  couponDiscount: recalculated.couponDiscount || 0,
  totalAmount: recalculated.totalAmount,
  orderPurchaseCost: recalculated.orderPurchaseCost,
  orderProfit: recalculated.orderProfit,
  editedManually: true,
  updatedAt: serverTimestamp(),
});


    setOrders(prev =>
      prev
        .map(o =>
          o.id === editableOrder.id
            ? { ...o, ...recalculated, editedManually: true }
            : o
        )
        .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt))
    );

    setEditingOrderId(null);
    setEditableOrder(null);
  };

  if (loading) return <p className="loading">Loading orders…</p>;

  /* ------------------ UI ------------------ */
  return (
    <div className="user-orders-page">
      <button className="back-btn" onClick={() => navigate(-1)}>
        ← Back
      </button>

      {/* ===== HEADER ===== */}
      <div className="orders-header">
        <div>
          <h2>Order Edit Panel</h2>
          <div className="date-filters">
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
            />
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
            />
          </div>
        </div>

        <div className="profit-summary">
          <div>
  <span>Total Sales</span>
   <strong>₹{totalSales.toFixed(2)}</strong>
</div>

<div>
  <span>Total Shipping</span>
  <strong>₹{totalShipping}</strong>
</div>

<div>
  <span>Total Orders</span>
  <strong>{totalOrders}</strong>
</div>
          <div>
            <span>Total Profit</span>
            <strong>₹{totalProfit}</strong>
          </div>
          <div className="loss">
            <span>Cancelled Profit</span>
            <strong>− ₹{cancelledProfit}</strong>
          </div>
          <div className="net">
            <span>Net Profit</span>
            <strong>₹{netProfit}</strong>
          </div>
        </div>
      </div>

      {/* ===== ORDER LIST ===== */}
      <div className="orders-list">
        {filteredOrders.map(order => {
          const isOpen = expandedOrderId === order.id;
          const isEditing = editingOrderId === order.id;

          return (
            <div
              key={order.id}
              className={`order-card ${isOpen ? 'expanded' : ''}`}
              onClick={() => toggleOrder(order.id)}
            >
              {/* SUMMARY */}
              <div className="order-summary-row">
                <div>
                  <h4>Order #{order.id.slice(-6)}</h4>
                  <span className={`status ${order.status?.toLowerCase()}`}>
                    {order.status}
                  </span>
                </div>

                <div className="order-summary-meta">
                  <span>{formatDate(order.createdAt)}</span>

                  <div className="order-amounts">
                    <div className="order-money">
                      <strong>₹{order.totalAmount}</strong>
                      <span
                        className={order.orderProfit >= 0 ? 'profit' : 'loss'}
                      >
                        Profit: ₹{order.orderProfit}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingOrderId(order.id);
                        setEditableOrder(deepClone(order));
                        setExpandedOrderId(order.id);
                      }}
                    >
                      ✏️ Edit
                    </button>
                  </div>
                </div>
              </div>

              {/* VIEW MODE */}
              {isOpen && !isEditing && (
                <div className="order-details" onClick={e => e.stopPropagation()}>
                  <div className="order-items">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="order-item">
                        <img src={item.image} alt={item.productName} />
                        <div className="item-info">
                          <strong>{item.productName}</strong>
                          <span>Code: {item.productCode}</span>
                        </div>
                        <div className="item-meta">
                          <span>Qty: {item.quantity}</span>
                          <span>Selling: ₹{item.priceAtTimeOfOrder}</span>
                          <span>Cost: ₹{item.purchaseRateAtOrder}</span>
                          <strong className={item.itemProfit >= 0 ? 'profit' : 'loss'}>
                            Profit: ₹{item.itemProfit}
                          </strong>
          
                                       {order.couponCode && (
  <div className="coupon-info">
    <span>
      🎟 Coupon: <strong>{order.couponCode}</strong>
    </span>
    <span>
      Discount: − ₹{Number(order.couponDiscount || 0)}
    </span>
  </div>
)}
                        </div>
 
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* EDIT MODE */}
             {isEditing && editableOrder && (
  <div className="order-details" onClick={e => e.stopPropagation()}>
    <div className="order-items">
      {editableOrder.items.map((item, idx) => (
        <div key={idx} className="order-item edit-mode">
          <img src={item.image} alt={item.productName} />

          <div className="item-info">
            <strong>{item.productName}</strong>
            <span>Code: {item.productCode}</span>
          </div>

          <div className="item-meta">
            <label>
              Qty
              <input
                type="number"
                value={item.quantity}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setEditableOrder(prev => {
                    const copy = deepClone(prev);
                    copy.items[idx].quantity = val;
                    return copy;
                  });
                }}
              />
            </label>

            <label>
              Selling
              <input
                type="number"
                value={item.priceAtTimeOfOrder}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setEditableOrder(prev => {
                    const copy = deepClone(prev);
                    copy.items[idx].priceAtTimeOfOrder = val;
                    return copy;
                  });
                }}
              />
            </label>

            <label>
              Cost
              <input
                type="number"
                value={item.purchaseRateAtOrder}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setEditableOrder(prev => {
                    const copy = deepClone(prev);
                    copy.items[idx].purchaseRateAtOrder = val;
                    return copy;
                  });
                }}
              />
            </label>

            <strong className="profit">
              Profit: ₹
              {(item.quantity * item.priceAtTimeOfOrder) -
                (item.quantity * item.purchaseRateAtOrder)}
            </strong>
          </div>
        </div>
      ))}
    </div>

    {/* ACTIONS */}
    <div className="edit-actions">
      <button className="save-btn" onClick={saveEditedOrder}>
        💾 Save
      </button>
      <button
        className="cancel-btn"
        onClick={() => {
          setEditingOrderId(null);
          setEditableOrder(null);
        }}
      >
        Cancel
      </button>
    </div>
  </div>
)}

            </div>
          );
        })}
      </div>
    </div>
  );
}
