import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import './UserOrdersPage.css';

/* ------------------ HELPERS ------------------ */
const formatDate = (timestamp) => {
  if (!timestamp) return '—';
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toLocaleDateString('en-IN');
  }
  return new Date(timestamp).toLocaleDateString('en-IN');
};

/* ------------------ COMPONENT ------------------ */
export default function UserOrdersPage() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  const [stats, setStats] = useState({
    totalOrders: 0,
    lifetimeValue: 0,
    lifetimeProfit: 0,
    cancelledProfit: 0,
    lastOrderDate: null,
  });

  /* ------------------ DATA FETCH ------------------ */
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

      try {
        /* 👤 USER */
        const userSnap = await getDoc(doc(db, 'users', userId));
        if (userSnap.exists()) {
          setUser({ id: userSnap.id, ...userSnap.data() });
        }

        /* 📦 ORDERS */
        const q = query(collection(db, 'orders'), where('userId', '==', userId));
        const snap = await getDocs(q);

        const ordersData = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        /* 📊 AGGREGATES (USING STORED FIELDS) */
        let lifetimeValue = 0;
        let lifetimeProfit = 0;
        let cancelledProfit = 0;
        let lastDate = null;

        ordersData.forEach((order) => {
          if (order.createdAt) {
            if (!lastDate || order.createdAt.toDate() > lastDate.toDate()) {
              lastDate = order.createdAt;
            }
          }

          if (order.status === 'Cancelled') {
            cancelledProfit += order.orderProfit || 0;
            return;
          }

          lifetimeValue += order.totalAmount || 0;
          lifetimeProfit += order.orderProfit || 0;
        });

        setOrders(ordersData);
        setStats({
          totalOrders: ordersData.filter(o => o.status !== 'Cancelled').length,
          lifetimeValue,
          lifetimeProfit,
          cancelledProfit,
          lastOrderDate: lastDate,
        });

      } catch (err) {
        console.error('Error loading user orders:', err);
      }

      setLoading(false);
    };

    fetchAll();
  }, [userId]);

  const toggleOrder = (orderId) => {
    setExpandedOrderId(prev => (prev === orderId ? null : orderId));
  };

  if (loading) return <p className="loading">Loading user orders…</p>;

  /* ------------------ UI ------------------ */
  return (
    <div className="user-orders-page">

      {/* 🔙 BACK */}
      <button className="back-btn" onClick={() => navigate(-1)}>
        ← Back to Users
      </button>

      {/* 👤 USER SUMMARY */}
      {user && (
        <div className="user-summary-card">
          <div className="user-summary-header">
            <h2>{user.name || 'N/A'}</h2>
            <span className="user-id">ID: {user.id}</span>
          </div>

          <div className="user-summary-info">
            <div>
              <label>Mobile</label>
              <p>{user.mobile || '—'}</p>
            </div>
            <div>
              <label>Email</label>
              <p>{user.email || '—'}</p>
            </div>
            <div>
              <label>Address</label>
              <p>{user.address || '—'}</p>
            </div>
          </div>

          <div className="user-stats">
            <div>
              <span>Total Orders</span>
              <strong>{stats.totalOrders}</strong>
            </div>

            <div>
              <span>Lifetime Value</span>
              <strong>₹{stats.lifetimeValue.toLocaleString('en-IN')}</strong>
            </div>

            <div>
              <span>Net Profit</span>
              <strong className="profit">
                ₹{stats.lifetimeProfit.toLocaleString('en-IN')}
              </strong>
            </div>

            <div>
              <span>Cancelled Profit</span>
              <strong className="loss">
                ₹{stats.cancelledProfit.toLocaleString('en-IN')}
              </strong>
            </div>

            <div>
              <span>Last Order</span>
              <strong>{formatDate(stats.lastOrderDate)}</strong>
            </div>
          </div>
        </div>
      )}

      {/* 📦 ORDERS */}
      <div className="orders-list">
        {orders.map((order) => {
          const isOpen = expandedOrderId === order.id;

          return (
            <div
              key={order.id}
              className={`order-card ${isOpen ? 'expanded' : ''}`}
              onClick={() => toggleOrder(order.id)}
            >
              {/* COLLAPSED */}
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
                    <strong>₹{order.totalAmount}</strong>

                    {order.status !== 'Cancelled' && (
                      <span className="order-profit profit">
                        Profit: ₹{order.orderProfit}
                      </span>
                    )}

                    {order.status === 'Cancelled' && (
                      <span className="order-profit loss">
                        Cancelled
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* EXPANDED */}
              {isOpen && (
                <div
                  className="order-details"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="order-items">
                    {order.items?.map((item, idx) => (
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
                          <strong
                            className={
                              item.itemProfit >= 0 ? 'profit' : 'loss'
                            }
                          >
                            Profit: ₹{item.itemProfit}
                          </strong>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="order-footer">
                    <div>
                      <span>Purchase Cost</span>
                      <strong>₹{order.orderPurchaseCost}</strong>
                    </div>
                    <div>
                      <span>Selling</span>
                      <strong>₹{order.totalAmount}</strong>
                    </div>
                    <div>
                      <span>Order Profit</span>
                      <strong
                        className={
                          order.orderProfit >= 0 ? 'profit' : 'loss'
                        }
                      >
                        ₹{order.orderProfit}
                      </strong>
                    </div>
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
