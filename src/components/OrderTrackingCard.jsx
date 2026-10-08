import React from 'react';
import './OrderTrackingCard.css';

const OrderTrackingCard = ({ order }) => {
  const orderDate = order.createdAt?.toDate().toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const orderTimeline = ['Pending', 'Processing', 'Shipped', 'Delivered'];
  const currentStatusIndex = orderTimeline.indexOf(order.status);

  return (
    <div className="order-tracking-card">
      <div className="order-card-header">
        <div className="order-header-info">
          <h4 className="order-id">Order ID: {order.id.substring(0, 8)}</h4>
          <p className="order-date">Placed on: {orderDate}</p>
        </div>
        <p className={`order-status status-${order.status.toLowerCase()}`}>
          {order.status}
        </p>
      </div>

      <div className="order-timeline">
        {orderTimeline.map((status, index) => (
          <div
            key={status}
            className={`timeline-step ${index <= currentStatusIndex ? 'completed' : ''}`}
          >
            <div className="timeline-circle"></div>
            <p className="timeline-status-text">{status}</p>
          </div>
        ))}
      </div>

      <div className="order-items-summary">
        {order.items.map((item, index) => (
          <div key={index} className="order-item">
            <div className="item-details">
                  <img
                  src={item.images && item.images.length > 0 ? item.images[0] : item.image}
                  alt={item.productName}
                  className="item-image"
                />
              <h5 className="item-name">{item.productName}</h5>
              <p className="item-code">{item.productCode}</p>
              <p className="item-quantity">Qty: {item.quantity}</p>
            </div>
            <p className="item-price">₹{item.price}</p>
          </div>
        ))}
      </div>

      <div className="order-card-footer">
        <div className="order-totals">
          <p><span>Subtotal:</span> ₹{order.subtotal?.toFixed(2) || '0.00'}</p>
          <p><span>Shipping:</span> ₹{order.shippingFee?.toFixed(2) || '0.00'}</p>
          <p className="final-total"><span>Total:</span> ₹{order.totalAmount?.toFixed(2) || '0.00'}</p>
        </div>
      </div>
    </div>
  );
};

export default OrderTrackingCard;