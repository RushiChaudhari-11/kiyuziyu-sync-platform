// src/components/MiniCart.jsx

import React, { useState } from 'react';
import { useCart } from './CartContext';
import { Link } from 'react-router-dom';
import { FaShoppingCart, FaTrashAlt, FaTimes } from 'react-icons/fa';
import './MiniCart.css';

const MiniCart = () => {
  const { cart, addToCart, removeFromCart, getCartTotal } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const cartItems = Object.values(cart);
  const cartItemsCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  const toggleCart = () => {
    setIsCartOpen(!isCartOpen);
  };
  return (
    <div className="mini-cart-wrapper">
      <div className="mini-cart-icon" onClick={toggleCart}>
        <FaShoppingCart size={24} />
        {cartItemsCount > 0 && (
          <span className="cart-item-count">{cartItemsCount}</span>
        )}
      </div>
      <div className={`mini-cart-dropdown ${isCartOpen ? 'open' : ''}`}>
        <div className="mini-cart-header">
          <h3>My Cart</h3>
          <button onClick={toggleCart} className="mini-cart-close-btn">
            <FaTimes />
          </button>
        </div>
        
        {cartItemsCount > 0 ? (
          <>
            <ul className="mini-cart-items-list">
              {Object.keys(cart).map((cartItemId) => {
                const item = cart[cartItemId];
                return (
                  <li key={cartItemId} className="mini-cart-item">
                    <img 
                      src={item.images && item.images.length > 0 ? item.images[0].url : item.image} 
                      alt={item.productName} 
                      className="mini-cart-item-image" 
                    />
                    <div className="mini-cart-item-details">
                      <p className="mini-cart-item-name">
                        {item.productName}
                        {item.variation && (
                          <span> - {item.variation.color} {item.variation.size}</span>
                        )}
                      </p>
                      <div className="mini-cart-quantity-controls">
                        <button onClick={() => removeFromCart(cartItemId)}>-</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => addToCart(item)}>+</button>
                      </div>
                    </div>
                    <div className="mini-cart-item-price-actions">
                      <p className="mini-cart-item-price">₹{(item.price * item.quantity).toFixed(2)}</p>
                      <button onClick={() => removeFromCart(cartItemId)} className="mini-cart-remove-btn">
                        <FaTrashAlt />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mini-cart-summary">
              <div className="mini-cart-total">
                <span>Total</span>
                <span>₹{getCartTotal().toFixed(2)}</span>
              </div>
              <div className="mini-cart-actions">
                <Link to="/cart" className="view-cart-btn" onClick={toggleCart}>View Cart</Link>
                <Link to="/checkout" className="checkout-btn" onClick={toggleCart}>Checkout</Link>
              </div>
            </div>
          </>
        ) : (
          <div className="mini-cart-empty">
            <p>Your cart is empty.</p>
            <Link to="/collections" className="start-shopping-btn" onClick={toggleCart}>Start Shopping</Link>
          </div>
        )}
      </div>
    </div>
  );
};
export default MiniCart;