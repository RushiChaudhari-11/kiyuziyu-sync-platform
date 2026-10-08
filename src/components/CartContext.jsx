import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from 'react';
import { useAuth } from './AuthContext';

/* =======================
   Utility functions
======================= */

export const getPriceForQuantity = (tiers, totalQuantity) => {
  if (!tiers || tiers.length === 0) return null;

  const sortedTiers = [...tiers].sort(
    (a, b) => Number(b.min_quantity) - Number(a.min_quantity)
  );

  for (const tier of sortedTiers) {
    if (totalQuantity >= Number(tier.min_quantity)) {
      return Number(tier.price);
    }
  }

  return Number(sortedTiers[sortedTiers.length - 1]?.price) || 0;
};

export const createStablePricingId = (tiers) => {
  if (!tiers) return null;

  const sortedTiers = [...tiers].sort(
    (a, b) => Number(a.min_quantity) - Number(a.min_quantity)
  );

  return JSON.stringify(
    sortedTiers.map((tier) => {
      const obj = {};
      Object.keys(tier)
        .sort()
        .forEach((k) => (obj[k] = tier[k]));
      return obj;
    })
  );
};

export const getCartItemId = (product) => {
  if (product.variation) {
    const variationKeys = Object.keys(product.variation)
      .filter((k) => product.variation[k] != null)
      .sort();

    const variationString = variationKeys
      .map((k) =>
        String(product.variation[k])
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '-')
      )
      .join('_');

    return `${product.id}_${variationString}`;
  }
  return product.id;
};

/* =======================
   Context
======================= */

export const CartContext = createContext();

/* =======================
   Price recalculation
======================= */

const recalculateCartPrices = (currentCart, pricingKey) => {
  const newCart = { ...currentCart };
  const pricingGroups = {};

  for (const cartItemId in newCart) {
    const item = newCart[cartItemId];
    if (!item.tieredPricing) continue;

    const roleTiers = item.tieredPricing[pricingKey];
    if (!roleTiers) continue;

    const pricingId =
      item.pricingId || createStablePricingId(roleTiers);

    if (!pricingGroups[pricingId]) {
      pricingGroups[pricingId] = {
        totalQuantity: 0,
        cartItemIds: [],
        tiers: roleTiers,
      };
    }

    pricingGroups[pricingId].totalQuantity += item.quantity;
    pricingGroups[pricingId].cartItemIds.push(cartItemId);
  }

  for (const key in pricingGroups) {
    const group = pricingGroups[key];
    const newPrice = getPriceForQuantity(
      group.tiers,
      group.totalQuantity
    );

    group.cartItemIds.forEach((id) => {
      newCart[id].price = newPrice;
    });
  }

  return newCart;
};

/* =======================
   Provider
======================= */

export const CartProvider = ({ children }) => {
const { roleConfig, userRole } = useAuth();


  const pricingKey = roleConfig?.pricingKey || 'wholesaler';
  const minOrderValue = roleConfig?.minOrderValue || 0;

  /* =======================
     CART STATE
  ======================= */

  const [cart, setCart] = useState(() => {
    try {
      const stored = localStorage.getItem('cart');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  /* =======================
     COUPON STATE
  ======================= */

  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState(null);

  /* =======================
     TOTALS
  ======================= */

  const getCartSubtotal = useCallback(() => {
    return Object.values(cart).reduce(
      (sum, item) => sum + Number(item.price || 0) * item.quantity,
      0
    );
  }, [cart]);

  const getCartTotal = useCallback(() => {
    return getCartSubtotal();
  }, [getCartSubtotal]);

  const getFinalTotal = useCallback(() => {
    return Math.max(0, getCartSubtotal() - couponDiscount);
  }, [getCartSubtotal, couponDiscount]);

  /* =======================
     MIN ORDER CHECK
  ======================= */

  const checkMinOrderValue = useCallback(() => {
    const total = getCartTotal();

    return {
      minimumRequired: minOrderValue,
      isMinMet: total >= minOrderValue,
      currentTotal: total,
    };
  }, [getCartTotal, minOrderValue]);

  /* =======================
     ADD TO CART
  ======================= */

  const addToCart = useCallback(
    (productData) => {
      setCart((prevCart) => {
        const cartItemId = getCartItemId(productData);
        const currentQty = prevCart[cartItemId]?.quantity || 0;

        const cleanProduct = { ...productData };
        delete cleanProduct.quantity;
        delete cleanProduct.variations;

        let stockLimit;
        if (productData.variation) {
          stockLimit = Number(productData.variation.quantity);
        } else {
          stockLimit =
            prevCart[cartItemId]?.stockLimit ??
            Number(productData.quantity || Infinity);
        }

        if (currentQty >= stockLimit) return prevCart;

        const roleTiers =
          cleanProduct.tieredPricing?.[pricingKey];

        const pricingId = roleTiers
          ? createStablePricingId(roleTiers)
          : null;

        const updatedCart = {
          ...prevCart,
          [cartItemId]: {
            ...(prevCart[cartItemId] || {}),
            ...cleanProduct,
            stockLimit,
            quantity: currentQty + 1,
            pricingId,
            images:
              cleanProduct.images ||
              (cleanProduct.image
                ? [{ url: cleanProduct.image }]
                : []),
          },
        };

        return recalculateCartPrices(updatedCart, pricingKey);
      });
    },
    [pricingKey]
  );

  /* =======================
     REMOVE (−)
  ======================= */

  const removeFromCart = useCallback(
    (cartItemId) => {
      setCart((prevCart) => {
        const newCart = { ...prevCart };
        if (!newCart[cartItemId]) return prevCart;

        if (newCart[cartItemId].quantity <= 1) {
          delete newCart[cartItemId];
        } else {
          newCart[cartItemId].quantity -= 1;
        }

        return recalculateCartPrices(newCart, pricingKey);
      });
    },
    [pricingKey]
  );

  /* =======================
     REMOVE FULL ITEM
  ======================= */

  const removeItemFromCart = useCallback(
    (productId, variation = null) => {
      setCart((prevCart) => {
        const newCart = { ...prevCart };

        Object.keys(newCart).forEach((cartItemId) => {
          const item = newCart[cartItemId];
          if (item.id !== productId) return;

          if (variation) {
            const v1 = item.variation || {};
            const v2 = variation || {};
            const normalize = (v) =>
              String(v ?? '').trim().toLowerCase();

            if (
              normalize(v1.color) !== normalize(v2.color) ||
              normalize(v1.size) !== normalize(v2.size)
            ) {
              return;
            }
          }

          delete newCart[cartItemId];
        });

        return recalculateCartPrices(newCart, pricingKey);
      });
    },
    [pricingKey]
  );

  const clearCart = useCallback(() => {
    setCart({});
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponError(null);
  }, []);

  /* =======================
     COUPON LOGIC
  ======================= */

  const applyCoupon = async (couponDoc) => {
  try {
    /* =========================
       DEBUG START
    ========================= */
    console.group('🧪 COUPON APPLY DEBUG');
console.log('👤 userRole (from auth):', userRole);

    console.log('📄 couponDoc:', couponDoc);
    console.log('🏷️ couponDoc.code:', couponDoc?.code);
    console.log('👥 couponDoc.allowedRoles:', couponDoc?.allowedRoles);
    console.log('👤 userRole (received):', userRole);
    console.log('📦 typeof userRole:', typeof userRole);

    if (Array.isArray(couponDoc?.allowedRoles)) {
      console.log(
        '✅ Role match check:',
        couponDoc.allowedRoles.includes(userRole)
      );
    } else {
      console.log('⚠️ allowedRoles is NOT an array');
    }

    console.groupEnd();
    /* =========================
       DEBUG END
    ========================= */

    setCouponError(null);

    // ❌ inactive
    if (!couponDoc.isActive) {
      throw new Error('Coupon is disabled');
    }

    // ❌ expired
    if (couponDoc.expiry?.toDate() < new Date()) {
      throw new Error('Coupon has expired');
    }

    // ❌ role restriction
  if (
  Array.isArray(couponDoc.allowedRoles) &&
  couponDoc.allowedRoles.length > 0 &&
  !couponDoc.allowedRoles.includes(userRole)
) {
  throw new Error('Coupon is not available for your role');
}


    const subtotal = getCartSubtotal();

    // ❌ min order
    if (subtotal < couponDoc.minOrderValue) {
      throw new Error(
        `Minimum order ₹${couponDoc.minOrderValue} required`
      );
    }

    // ❌ usage limit
    if (
      couponDoc.maxUses > 0 &&
      couponDoc.usedCount >= couponDoc.maxUses
    ) {
      throw new Error('Coupon usage limit reached');
    }

    /* =========================
       CALCULATE DISCOUNT
    ========================= */
    let discount = 0;

    if (couponDoc.type === 'percentage') {
      discount = (subtotal * couponDoc.value) / 100;
    } else {
      discount = couponDoc.value;
    }

    discount = Math.min(discount, subtotal);

    setAppliedCoupon(couponDoc);
    setCouponDiscount(discount);

  } catch (err) {
    console.error('❌ COUPON ERROR:', err.message);
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponError(err.message);
  }
};


  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponError(null);
  };

  /* =======================
     REPRICE ON ROLE CHANGE
  ======================= */

  useEffect(() => {
    setCart((prev) =>
      Object.keys(prev).length > 0
        ? recalculateCartPrices(prev, pricingKey)
        : prev
    );
    removeCoupon();
  }, [pricingKey]);

  /* =======================
     CONTEXT VALUE
  ======================= */

  const contextValue = {
    cart,
    addToCart,
    removeFromCart,
    removeItemFromCart,
    clearCart,

    getCartTotal,
    getCartSubtotal,
    getFinalTotal,
    checkMinOrderValue,

    pricingKey,

    // 🔥 coupon
    applyCoupon,
    removeCoupon,
    appliedCoupon,
    couponDiscount,
    couponError,
  };

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
