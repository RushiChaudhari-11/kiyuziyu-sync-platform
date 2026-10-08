// src/config/roles.js

// 🔑 Role keys (single source of truth)
export const ROLES = {
  RETAILER: 'retailer',
  WHOLESALER: 'wholesaler',
  DISTRIBUTOR: 'distributor',
  DEALER: 'dealer',
  VIP: 'vip',
  DROPSHIPPING: 'dropshipping',
};

// 🔥 Role behavior configuration
export const ROLE_CONFIG = {
  retailer: {
    label: 'Retail Customer',
    minOrderValue: 0,
    canSeeBulkPricing: false,
    pricingKey: 'retail',

    // 💳 PAYMENT
    paymentMode: 'ONLINE', // ✅ Razorpay enabled
  },

  wholesaler: {
    label: 'Wholesaler',
    minOrderValue: 1000,
    canSeeBulkPricing: true,
    pricingKey: 'wholesale',

    // 📲 Manual payment (WhatsApp)
    paymentMode: 'MANUAL',
  },

  distributor: {
    label: 'Distributor',
    minOrderValue: 30000,
    canSeeBulkPricing: true,
    pricingKey: 'distributor',

    paymentMode: 'MANUAL',
  },

  dealer: {
    label: 'Dealer',
    minOrderValue: 60000,
    canSeeBulkPricing: true,
    pricingKey: 'dealer',

    paymentMode: 'MANUAL',
  },

  vip: {
    label: 'VIP Customer',
    minOrderValue: 150000,
    canSeeBulkPricing: true,
    pricingKey: 'vip',

    paymentMode: 'MANUAL', // can change later if needed
  },
    dropshipping: {
    label: 'Dropshipping',
    minOrderValue: 5000,
    canSeeBulkPricing: true,
    pricingKey: 'dropshipping',

    paymentMode: 'MANUAL', // can change later if needed
  },
};


// 🛟 Safe fallback (VERY IMPORTANT)
export const DEFAULT_ROLE = ROLES.WHOLESALER;

// ✅ Helper: get role config safely
export const getRoleConfig = (role) => {
  return ROLE_CONFIG[role] || ROLE_CONFIG[DEFAULT_ROLE];
};

// ✅ Helper: all roles list (for dropdowns, admin UI)
export const ALL_ROLES = Object.values(ROLES);
