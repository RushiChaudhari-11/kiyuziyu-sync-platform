// src/components/ProductCard.jsx
// ✅ Multi-role ready, UI-only, pricing logic removed from component

import React, { useState, useEffect } from 'react';
import './ProductCard.css';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';
import { getCartItemId } from './CartContext';
import ProgressiveImage from "./ProgressiveImage";
import { useAuth } from './AuthContext';

const ProductCard = ({
  product,
  onIncrement,
  onDecrement,
  onEdit,
  onDelete,
  onToggleHighlight,
  isCart = false,
  cart
}) => {
  const {
    id,
    productName,
    productCode,
    image,               // ✅ main image
  additionalImages = [], // ✅ gallery images
    variations,
    quantity,
    tieredPricing,
    tags = [],
  } = product;

  /* =====================
     ROLE (DISPLAY ONLY)
  ===================== */
  const { roleConfig } = useAuth();
  const pricingKey = roleConfig?.pricingKey || 'wholesaler';

  /* =====================
     STATE
  ===================== */
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [showTiers, setShowTiers] = useState(false);

 const mainImage = image || additionalImages?.[0] || null;


  /* =====================
     DEFAULT VARIATION
  ===================== */
  useEffect(() => {
    if (variations && variations.length > 0) {
      setSelectedVariation(variations[0]);
    }
  }, [variations]);

  /* =====================
     IMAGE ROTATION
  ===================== */
  

  /* =====================
     STOCK
  ===================== */
  const totalStock =
    variations && variations.length > 0
      ? variations.reduce((s, v) => s + Number(v.quantity || 0), 0)
      : Number(quantity || 0);

  const availableStock = selectedVariation
    ? Number(selectedVariation.quantity || 0)
    : totalStock;

  const isOutOfStock = totalStock <= 0;
  if (isOutOfStock) return null;

  /* =====================
     CART HELPERS
  ===================== */
const cleanVariation = selectedVariation
  ? Object.fromEntries(
      Object.entries(selectedVariation).filter(
        ([key]) => key !== "quantity"
      )
    )
  : null;

const productWithVariation = {
  ...product,
  variation: cleanVariation,
};
  const tiers =
    tieredPricing?.[pricingKey] && Array.isArray(tieredPricing[pricingKey])
      ? [...tieredPricing[pricingKey]].sort(
          (a, b) => Number(a.min_quantity) - Number(b.min_quantity)
        )
      : [];
  const startingPrice = product.calculatedPrice ?? (
  tiers.length > 0 ? Number(tiers[0].price) : null
);
const subQty = Object.values(cart || {}).reduce((sum, item) => {
  if (item.subcollectionId === product.subcollectionId) {
    return sum + item.quantity;
  }
  return sum;
}, 0);
const getTierPrice = (tiers, qty) => {

  if (!tiers || tiers.length === 0) return null;

  let selected = tiers[0];

  for (const tier of tiers) {

    const min = Number(tier.min_quantity);
    const max = Number(tier.max_quantity) || Infinity;

    if (qty >= min && qty <= max) {
      selected = tier;
    }
  }

  return Number(selected.price);
};
  const cartItemId = getCartItemId(productWithVariation);
  const cartQuantity = cart?.[cartItemId]?.quantity || 0;
 const unitPrice = getTierPrice(tiers, subQty || 1);
  const isMaxStockReached = cartQuantity >= availableStock;

  /* =====================
     ADMIN MODE
  ===================== */
  if (onEdit && onDelete) {
    const isNewArrival = tags.includes('new_arrival');
    const isTrending = tags.includes('trending');

    return (
      <div className="product-card admin-mode">
        <div className="product-info">
          <h4>{productName}</h4>
          <p>{productCode}</p>
        </div>

        <div className="admin-actions">
          <button onClick={onEdit}>Edit</button>
          <button onClick={onDelete}>Delete</button>

          <button
            className={`highlight-btn ${isNewArrival ? 'active' : ''}`}
            onClick={() => onToggleHighlight(id, 'new_arrival')}
          >
            New Arrival {isNewArrival && '✓'}
          </button>

          <button
            className={`highlight-btn ${isTrending ? 'active' : ''}`}
            onClick={() => onToggleHighlight(id, 'trending')}
          >
            Trending {isTrending && '✓'}
          </button>
        </div>
      </div>
    );
  }

  /* =====================
     ROLE-BASED TIERS (UI)
  ===================== */
  



  /* =====================
     RENDER
  ===================== */
  return (
    <div className={`product-card ${isOutOfStock ? 'out-of-stock' : ''}`}>
      {isOutOfStock && (
        <div className="out-of-stock-overlay">Out of Stock</div>
      )}

      {/* IMAGE */}
   <div className="product-image-container">
  <Zoom>
    <ProgressiveImage
      src={mainImage}
      alt={productName}
      className="product-image"
    />
  </Zoom>
</div>



      {/* INFO */}
      <div className="product-info">
        <div className="product-header-row">
  <h4 className="product-title">{productName}</h4>

  <span className="stock-badge">
    {availableStock} left
  </span>
</div>

<p className="product-code">{productCode}</p>

        {/* PRICE */}
        {cartQuantity > 0 ? (
          <p className="product-price">
            ₹{Number(unitPrice).toFixed(2)} / unit
          </p>
        ) : (
          startingPrice !== null && (
            <p className="product-price">
              From ₹{startingPrice.toFixed(2)} / unit
            </p>
          )
        )}

        {/* BULK PRICING (POLISHED UI) */}
        {tiers.length > 1 && (
  <>
    <button
      className="bulk-toggle-btn"
      onClick={(e) => {
        e.stopPropagation();
        setShowTiers(!showTiers);
      }}
    >
      {showTiers ? 'Hide bulk prices' : 'View bulk prices'}
    </button>

    {showTiers && (
      <div className="tiered-pricing-container">
        {tiers.map((tier, i) => {
          const isUnlocked =
            cartQuantity >= tier.min_quantity &&
            (!tier.max_quantity || cartQuantity <= tier.max_quantity);

          return (
            <div
              key={i}
              className={`pricing-tier-row ${
                isUnlocked ? 'active-tier' : ''
              }`}
            >
              Buy {tier.min_quantity}
              {tier.max_quantity ? `–${tier.max_quantity}` : '+'}
              {' '}@ ₹{tier.price} each
            </div>
          );
        })}
      </div>
    )}
  </>
)}


        <p className="product-quantity">
          In Stock: {availableStock}
        </p>

        {/* VARIATIONS */}
        {variations && variations.length > 0 && (
          <div className="variations-selector">
            {variations.map((v, i) => {
              const idForVar = getCartItemId({
                ...product,
                variation: v,
              });

              const qtyInCart = cart?.[idForVar]?.quantity || 0;

              return (
                <button
                  key={i}
                  className={`variation-btn ${
                    selectedVariation === v ? 'selected' : ''
                  }`}
                  onClick={() => setSelectedVariation(v)}
                >
                  {v.color} {v.size}
                  {qtyInCart > 0 && (
                    <span className="variation-cart-qty">
                      ({qtyInCart})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ACTIONS */}
      <div className="product-actions">
        {cartQuantity === 0 ? (
          <button
            className="add-to-cart-btn"
            onClick={() => onIncrement(productWithVariation)}
            disabled={isMaxStockReached}
          >
            {isMaxStockReached ? 'Out of Stock' : 'Add to Cart'}
          </button>
        ) : (
          <div className="quantity-controls">
            <button onClick={() => onDecrement(cartItemId)}>-</button>
            <span>{cartQuantity}</span>
            <button
              onClick={() => onIncrement(productWithVariation)}
              disabled={isMaxStockReached}
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductCard;