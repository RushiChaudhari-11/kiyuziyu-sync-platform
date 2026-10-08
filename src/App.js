import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from "react";
import './App.css';
import { initMetaPixel } from "./utils/pixels";
import HomePage from './pages/HomePage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import SubcollectionsPage from './pages/SubcollectionsPage';
import ProductsPage from './pages/ProductsPage';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { CartProvider } from './components/CartContext';
import { AuthProvider } from './components/AuthContext';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderSuccessPage from './pages/OrderSuccessPage';
import OrderHistoryPage from './pages/OrderHistoryPage'; // Import the new page
import ReportPage from './pages/ReportPage';
import TermsAndPolicies from './pages/TermsAndPolicies';
import UserOrdersPage from './pages/UserOrdersPage';
import OrderEditPage from './pages/OrderEditPage';
import CouponAdmin from './pages/CouponAdmin';
import CouponUsageHistory from './pages/CouponUsageHistory';
import CouponAnalytics from './pages/CouponAnalytics';
import PrivacyPolicy from "./pages/PrivacyPolicy";
import BulkEnquiryList from "./pages/BulkEnquiryList";
import BarcodePrintingPage from './pages/BarcodePrintingPage';
import PartnerApplicationsList from './pages/PartnerApplicationsList';
import AdminLeadsDashboard from './pages/AdminLeadsDashboard';
import DropshipperLayout from "./pages/dropshipper/DropshipperLayout";
import DropshipperDashboard from "./pages/dropshipper/DropshipperDashboard";
import DropshipperProducts from "./pages/dropshipper/DropshipperProducts";
import DropshipperOrders from "./pages/dropshipper/DropshipperOrders";
import SellerStore from "./pages/dropshipper/SellerStore";
import DropshipperLogin from "./pages/dropshipper/DropshipperLogin"
import DropshipperSetup from "./pages/dropshipper/DropshipperSetup"
import DropshipperSignup from "./pages/dropshipper/DropshipperSignup";
import { StoreCartProvider } from "./pages/store/StoreCartContext";
import StoreCartPage from "./pages/store/StoreCartPage";
import StoreCheckoutPage from "./pages/store/StoreCheckoutPage";
import StoreLoader from "./pages/store/StoreLoader";
import { isMainDomain } from "./utils/domain";
import AdminSellers from './pages/AdminSellers';
import AdminStoreOrders from './pages/AdminStoreOrders';
import AdminSellerProfits from './pages/AdminSellerProfits';
import StoreHomepage from './pages/store/StoreHomepage';
import DropshipperHomepage from './pages/dropshipper/DropshipperHomepage';
import StoreLogin from './pages/store/StoreLogin';
import StoreSignup from './pages/store/StoreSignup';
import { StoreAuthProvider } from './pages/store/StoreAuthContext';
import DropshipperPayments from './pages/dropshipper/DropshipperPayments';
import InventorySummaryPage from "./pages/InventorySummaryPage";
import ProductSalesPage from './pages/ProductSalesPage';
import RefundPolicy from './pages/RefundPolicy';
import CancellationPolicy from './pages/CancellationPolicy';
import CustomBillingPage from './pages/CustomBillingPage';
import OrdersProductsPage from './pages/OrdersProductsPage';
import DropshipperCustomers from './pages/dropshipper/DropshipperCustomers';
import PixelTracker from "./components/PixelTracker";
import StockCheckPage from './pages/StockCheckPage';
import Topbar from './components/Topbar';
import FloatingContact from './components/FloatingContact';
import DropshipperEnquiries from './pages/dropshipper/DropshipperEnquiries';
import DropshipperChangePassword from "./pages/dropshipper/DropshipperChangePassword";
import AdminResellerPayments from './pages/dropshipper/AdminResellerPayments';
import AdminLogin from './pages/API_ADMIN/AdminLogin';
import AdminSignup from './pages/API_ADMIN/AdminSignup';
import AdminDashboard from './pages/API_ADMIN/AdminDashboard';
import TenantDashboard from './pages/API_ADMIN/TenantDashboard';
import TenantProducts from './pages/API_ADMIN/TenantProducts';

import ShopifyOAuthHandler from './components/ShopifyOAuthHandler';

function AppContent() {
  const location = useLocation();
  const isPortalRoute = location.pathname.startsWith('/admin') || location.pathname.startsWith('/tenant');
  const showConsumerLayout = isMainDomain() && !isPortalRoute;

  return (
    <>
      <PixelTracker />
      <ShopifyOAuthHandler />
      {showConsumerLayout && (
        <>
          <Navbar />
          <Topbar />
        </>
      )}
      <Routes>
        <Route
          path="/"
          element={
            isMainDomain()
              ? <HomePage />
              : (
                <StoreAuthProvider>
                  <StoreCartProvider>
                    <StoreHomepage />
                  </StoreCartProvider>
                </StoreAuthProvider>
              )
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/signup" element={<AdminSignup />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/tenant/dashboard" element={<TenantDashboard />} />
        <Route path="/tenant/products" element={<TenantProducts />} />
        <Route path="/Apple@782k" element={<AdminPage />} />
        <Route path="/orders-products" element={<OrdersProductsPage />} />

        <Route path="/custombill" element={<CustomBillingPage/>} />
        <Route path="/collections/:collectionId" element={<SubcollectionsPage />} />
        <Route path="/collections/:collectionId/all-products" element={<ProductsPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order-success" element={<OrderSuccessPage />} />
        <Route path="/order-history" element={<OrderHistoryPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/terms" element={<TermsAndPolicies />} />
        <Route path="/admin/users/:userId/orders" element={<UserOrdersPage />} />
        <Route path="/admin/orders/edit" element={<OrderEditPage />} />
        <Route path="/admin/bulk" element={<BulkEnquiryList />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/refund-policy" element={<RefundPolicy />} />
        <Route path="/cancellation-policy" element={<CancellationPolicy />} />
        <Route
          path="/admin/reseller-payments/:sellerId"
          element={<AdminResellerPayments />}
        />
        <Route
          path="/admin/coupons"
          element={<CouponAdmin />}
        />
        <Route path="/dropshipper/login" element={<DropshipperLogin />} />
        <Route
          path="/dropshipper/change-password"
          element={<DropshipperChangePassword />}
        />

        <Route path="/dropshipper/setup" element={<DropshipperSetup />} />
        <Route path="/dropshipper/signup" element={<DropshipperSignup />} />
        <Route
          path="/admin/coupons/usage"
          element={<CouponUsageHistory />}
        />
        <Route path="/admin/coupon-analytics" element={<CouponAnalytics />} />
        <Route path="/admin/seller-profits" element={<AdminSellerProfits />} />
        <Route path="/admin/stockcheck" element={<StockCheckPage />} />

        <Route path="/inventory/stock" element={<InventorySummaryPage />} />
        <Route path="/admin/productsale/view" element={<ProductSalesPage />} />

        <Route
          path="/admin/barcode-printing"
          element={<BarcodePrintingPage />}
        />
        <Route path="/admin/sellers" element={<AdminSellers />} />
        <Route path="/admin/store-orders" element={<AdminStoreOrders />} />
        <Route
          path="/admin/partner"
          element={<PartnerApplicationsList />}
        />
        <Route path="/admin/leads" element={<AdminLeadsDashboard />} />
        <Route path="/dropshipper" element={<DropshipperLayout />}>
          <Route
            path="dashboard"
            element={<DropshipperDashboard />}
          />

          <Route
            path="products"
            element={<DropshipperProducts />}
          />

          <Route
            path="orders"
            element={<DropshipperOrders />}
          />
          <Route
            path="homepage"
            element={<DropshipperHomepage />}
          />
          <Route path="payments" element={<DropshipperPayments />} />
          <Route
            path="customers"
            element={<DropshipperCustomers />}
          />
          <Route
            path="enquiries"
            element={<DropshipperEnquiries />}
          />
        </Route>

        <Route
          path="/store/*"
          element={
            <StoreCartProvider>
              <StoreLoader />
            </StoreCartProvider>
          }
        />
        <Route path="/seller-store" element={<SellerStore />} />
        <Route path="/store-login" element={<StoreLogin />} />
        <Route path="/store-signup" element={<StoreSignup />} />
        <Route path="/store-cart" element={<StoreCartPage />} />
        <Route path="/store-checkout" element={<StoreCheckoutPage />} />
      </Routes>
      {showConsumerLayout && (
        <>
          <FloatingContact />
          <Footer/>
        </>
      )}
    </>
  );
}

function App() {
  useEffect(() => {
    initMetaPixel();
  }, []);
  return (
    <AuthProvider>
      <CartProvider>
        <Router>
          <AppContent />
        </Router>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;