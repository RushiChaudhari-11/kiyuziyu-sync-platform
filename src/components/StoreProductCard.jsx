// src/components/ProductCard.jsx
// ✅ Multi-role ready, UI-only, pricing logic removed from component

import React, { useState, useEffect, forwardRef } from 'react';
import './StoreProductCard.css';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';
import { getCartItemId } from "../pages/store/StoreCartContext";
import ProgressiveImage from "./ProgressiveImage";
import { useAuth } from './AuthContext';

const StoreProductCard = forwardRef(({
  product,
  onIncrement,
  onDecrement,
  onEdit,
  onDelete,
  onToggleHighlight,
  isCart = false,
  cart
}, ref)  => {
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
  const pricingKey = 'retail';

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
<div
  ref={ref}
  className={`storeproductcard-container ${
    isOutOfStock ? "storeproductcard-out-of-stock" : ""
  }`}
>
    {isOutOfStock && (
      <div className="storeproductcard-stock-overlay">Out of Stock</div>
    )}

    {/* IMAGE */}
    <div className="storeproductcard-image-wrapper">
      <Zoom>
        <ProgressiveImage
          src={mainImage}
          alt={productName}
          className="storeproductcard-image"
        />
      </Zoom>
    </div>

    {/* INFO */}
    <div className="storeproductcard-info">
              <div className="product-header-row">


      {/* TITLE */}
      <h4 className="storeproductcard-title">{productName}</h4>
        <span className="stock-badge">
     Stock - {availableStock} left
  </span>
      </div>
      {/* PRICE */}
      <p className="storeproductcard-price">
        ₹{Number(cartQuantity > 0 ? unitPrice : startingPrice || 0).toFixed(2)}/Unit
      </p>

      {/* CODE + STOCK */}
      <div className="storeproductcard-meta">
        <span className="storeproductcard-code">{productCode}</span>
      </div>

      {/* BULK PRICING */}
      {tiers.length > 1 && (
        <>
          <button
            className="storeproductcard-bulk-toggle-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowTiers(!showTiers);
            }}
          >
            {showTiers ? "Hide bulk price" : "Bulk price"}
          </button>

          {showTiers && (
            <div className="storeproductcard-tier-container">
              {tiers.map((tier, i) => {

                const isUnlocked =
                  cartQuantity >= tier.min_quantity &&
                  (!tier.max_quantity || cartQuantity <= tier.max_quantity);

                return (
                  <div
                    key={i}
                    className={`storeproductcard-tier-row ${
                      isUnlocked ? "storeproductcard-tier-active" : ""
                    }`}
                  >
                    {tier.min_quantity}
                    {tier.max_quantity ? `–${tier.max_quantity}` : "+"}
                    {" "}₹{tier.price}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* VARIATIONS */}
      {variations?.length > 0 && (
        <div className="storeproductcard-variations">

          {variations.map((v, i) => {

            const cleanVar = Object.fromEntries(
              Object.entries(v).filter(([k]) => k !== "quantity")
            );

            const idForVar = getCartItemId({
              ...product,
              variation: cleanVar,
            });

            const qtyInCart = cart?.[idForVar]?.quantity || 0;

            return (
              <button
                key={i}
                className={`storeproductcard-variation-btn ${
                  selectedVariation === v
                    ? "storeproductcard-variation-selected"
                    : ""
                }`}
                onClick={() => setSelectedVariation(v)}
              >
                {v.color} {v.size}
                {qtyInCart > 0 && (
                  <span className="storeproductcard-variation-cartqty">
                    {qtyInCart}
                  </span>
                )}
              </button>
            );
          })}

        </div>
      )}

    </div>

    {/* ACTIONS */}
    <div className="storeproductcard-actions">

      {cartQuantity === 0 ? (
        <button
          className="storeproductcard-add-btn"
          onClick={() => onIncrement(productWithVariation)}
          disabled={isMaxStockReached}
        >
          {isMaxStockReached ? "Out of Stock" : "Add to Cart"}
        </button>
      ) : (
        <div className="storeproductcard-qty-controls">

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
});

export default StoreProductCard;