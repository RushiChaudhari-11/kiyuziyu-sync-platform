import React, { useState, useEffect } from 'react';
import { db, collection, query, where, getDocs, orderBy } from '../firebase';
import { useAuth } from '../components/AuthContext';
import OrderTrackingCard from '../components/OrderTrackingCard';
import './OrderHistoryPage.css';

const OrderHistoryPage = () => {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);

        const fetchedOrders = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setOrders(fetchedOrders);
      } catch (err) {
        console.error('Failed to fetch orders:', err);
        setError('Failed to load your order history. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [currentUser]);

  if (isLoading) {
    return <div className="loading">Loading order history...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="order-history-page">
      <h2>Your Order History</h2>
      {orders.length === 0 ? (
        <p className="no-orders-message">You haven't placed any orders yet.</p>
      ) : (
        <div className="order-list">
          {orders.map(order => (
            <OrderTrackingCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderHistoryPage;