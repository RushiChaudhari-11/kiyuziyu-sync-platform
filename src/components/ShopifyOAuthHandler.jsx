import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getIdToken, API_BASE } from '../pages/API_ADMIN/adminAuth';
import { auth } from '../firebase';

export default function ShopifyOAuthHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // We only want to process after auth is loaded or at least try
    // We will attempt once on mount/location change, and also attach to auth state listener
    const processShopifyOAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const shop = params.get('shop');
      const hmac = params.get('hmac');

      if (shop && hmac) {
        let cleanShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
        if (!/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/.test(cleanShop)) {
           console.error("Invalid shop domain.");
           return;
        }

        const oauthInitiated = sessionStorage.getItem('shopify_oauth_initiated');
        if (oauthInitiated === cleanShop) {
           sessionStorage.removeItem('shopify_oauth_initiated');
           console.log("OAuth callback returned");
           return; 
        }

        console.log("Shopify install detected, shop:", cleanShop);
        sessionStorage.setItem('shopify_pending_shop', cleanShop);

        try {
          const token = await getIdToken();
          console.log("OAuth start requested for shop:", cleanShop);
          sessionStorage.setItem('shopify_oauth_initiated', cleanShop);
          sessionStorage.removeItem('shopify_pending_shop');

          const response = await fetch(`${API_BASE}/api/v1/shopify/oauth/start?shop=${encodeURIComponent(cleanShop)}`, {
            headers: { 
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await response.json();
          if (data.success && data.authUrl) {
             window.location.href = data.authUrl;
          } else {
             console.error("Failed to start OAuth:", data.message);
          }
        } catch (err) {
          // Not logged in yet, wait for AuthProvider or redirect
          console.log("User not authenticated yet. Saving shop to session and redirecting to login.");
          navigate('/admin/login', { replace: true });
        }
      } else {
        // If there's a pending shop, it means they just logged in and hit the dashboard/etc.
        const pendingShop = sessionStorage.getItem('shopify_pending_shop');
        if (pendingShop && auth.currentUser) {
          try {
            const token = await getIdToken();
            console.log("OAuth start requested (pending) for shop:", pendingShop);
            sessionStorage.setItem('shopify_oauth_initiated', pendingShop);
            sessionStorage.removeItem('shopify_pending_shop');
            
            const response = await fetch(`${API_BASE}/api/v1/shopify/oauth/start?shop=${encodeURIComponent(pendingShop)}`, {
              headers: { 
                'Authorization': `Bearer ${token}`
              }
            });
            const data = await response.json();
            if (data.success && data.authUrl) {
               window.location.href = data.authUrl;
            } else {
               console.error("Failed to start OAuth:", data.message);
            }
          } catch (err) {
            console.error("Pending OAuth API error:", err);
          }
        }
      }
    };

    // Firebase auth listener to handle when user finally loads
    const unsubscribe = auth.onAuthStateChanged(user => {
       if (user) {
         processShopifyOAuth();
       }
    });

    // Also run immediately in case they are already loaded or not logged in yet
    processShopifyOAuth();

    return () => unsubscribe();
  }, [location, navigate]);

  return null;
}