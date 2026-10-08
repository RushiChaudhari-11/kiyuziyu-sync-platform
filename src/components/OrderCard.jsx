import React from 'react';
import './OrderCard.css';

const OrderCard = ({ order, onUpdateStatus }) => {
  const orderDate = order.createdAt?.toDate().toLocaleString();

  return (
    <div className="order-card">
      <div className="order-header">
        <h4>Order ID: {order.id.substring(0, 8)}...</h4>
        <p className={`order-status status-${order.status.toLowerCase()}`}>
          {order.status}
        </p>
      </div>
      <div className="order-body">
        <p><strong>Customer:</strong> {order.billingInfo?.fullName}</p>
        <p><strong>Total:</strong> ₹{order.totalAmount.toFixed(2)}</p>
        <p><strong>Date:</strong> {orderDate}</p>
        <div className="order-items">
          <h5>Items:</h5>
          <ul>
            {order.items.map((item, index) => (
              <li key={index}>
                {item.productName} ({item.productCode}) x {item.quantity}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="order-footer">
        <select
          value={order.status}
          onChange={(e) => onUpdateStatus(order.id, e.target.value)}
        >
          <option value="Pending">Pending</option>
          <option value="Processing">Processing</option>
          <option value="Shipped">Shipped</option>
          <option value="Delivered">Delivered</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>
    </div>
  );
};

export default OrderCard;