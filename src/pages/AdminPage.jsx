import React, { useState, useEffect, useRef } from 'react';
import {
  db,
  collection,
  getDocs,
  addDoc,
  
  updateDoc,
  deleteDoc,
  doc,
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  getDoc,
  query,
  where,
  serverTimestamp,
  writeBatch,
  setDoc,

} from '../firebase';
import { onSnapshot } from "firebase/firestore";
import CollectionCard from '../components/CollectionCard';
import ProductCard from '../components/ProductCard';
import OrderDetailsModal from '../components/OrderDetailsModal';
import { getPriceForQuantity, getCartItemId, useCart, createStablePricingId } from '../components/CartContext';
import './AdminPage.css';
import './SaasUsers.css';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useNavigate } from 'react-router-dom';
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { ROLE_CONFIG } from "../config/roles";
import { useMemo } from 'react';
import {
  Html5QrcodeScanner,
  Html5QrcodeSupportedFormats
} from "html5-qrcode";

import { Html5Qrcode } from "html5-qrcode";
import { auth } from "../firebase"; // adjust path


// Low stock threshold constant
const LOW_STOCK_THRESHOLD = 10;

const AdminPage = () => {
  // State for Main Collections
  const [mainCollections, setMainCollections] = useState([]);
  const [mainCollectionName, setMainCollectionName] = useState('');
  const [mainCollectionImageFile, setMainCollectionImageFile] = useState(null);
  const [mainCollectionShowNumber, setMainCollectionShowNumber] = useState('');
  const [isMainCollectionLoading, setIsMainCollectionLoading] = useState(true);
  const [isMainCollectionUploading, setIsMainCollectionUploading] = useState(false);
  const [editingMainCollection, setEditingMainCollection] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [mainCollectionAdditionalImages, setMainCollectionAdditionalImages] = useState([]);
  const [allProductsMap, setAllProductsMap] = useState({});

const [productDestination, setProductDestination] = useState("");
  const ROLE_KEYS = Object.keys(ROLE_CONFIG);
  const PRICING_KEYS = ROLE_KEYS.map(
    role => ROLE_CONFIG[role].pricingKey
  );
  const [subcollectionsMap, setSubcollectionsMap] = useState({});


  // State for Subcollections
  const [selectedMainCollectionId, setSelectedMainCollectionId] = useState('');
  const [subcollections, setSubcollections] = useState([]);
  const [subcollectionName, setSubcollectionName] = useState('');
  const [subcollectionDescription, setSubcollectionDescription] = useState('');
  const [subcollectionImageFile, setSubcollectionImageFile] = useState(null);
  const [subcollectionShowNumber, setSubcollectionShowNumber] = useState('');
  const [subcollectionPurchaseRate, setSubcollectionPurchaseRate] = useState('');
  const [isSubcollectionLoading, setIsSubcollectionLoading] = useState(false);
  const [isSubcollectionUploading, setIsSubcollectionUploading] = useState(false);
  const [editingSubcollection, setEditingSubcollection] = useState(null);
  // 🔥 Barcode scan input
  const barcodeInputRef = useRef(null);
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [lastScannedProduct, setLastScannedProduct] = useState(null);

  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const html5QrCodeRef = useRef(null);
  const [isScanMode, setIsScanMode] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(true);
const [variantSelectionProduct, setVariantSelectionProduct] = useState(null);

  const emptyPricing = PRICING_KEYS.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});

  const [subcollectionTieredPricing, setSubcollectionTieredPricing] =
    useState(emptyPricing);

  const navigate = useNavigate();

  // State for Products
  const [selectedSubcollectionId, setSelectedSubcollectionId] = useState('');
  const [products, setProducts] = useState([]);
  const [productName, setProductName] = useState(''); // New state for product name
  const [productCode, setProductCode] = useState('');
  const [productQuantity, setProductQuantity] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [isProductLoading, setIsProductLoading] = useState(false);
  const [isProductUploading, setIsProductUploading] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [selectedSubcollectionData, setSelectedSubcollectionData] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [userOrderStats, setUserOrderStats] = useState({});

  // New state for multi-photo product upload
  const [newProducts, setNewProducts] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [additionalImages, setAdditionalImages] = useState([]);
  const [productVariations, setProductVariations] = useState([]);
  const [newVariation, setNewVariation] = useState({ color: '', size: '', quantity: '' });


  // New states for Orders and Low Stock Alerts
  const [activeTab, setActiveTab] = useState('collections');
  const [activeSubTab, setActiveSubTab] = useState('collections'); // New state for sub-tabs
  const [orders, setOrders] = useState([]);
  const [isOrderLoading, setIsOrderLoading] = useState(false);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [isLowStockLoading, setIsLowStockLoading] = useState(false);
  const [trashProgress, setTrashProgress] = useState(0);
  const [trashRunning, setTrashRunning] = useState(false);

  // States for modal display
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedLowStockProduct, setSelectedLowStockProduct] = useState(null);

  // NEW: States for order search and date filtering
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // New states for User Management
  const [users, setUsers] = useState([]);
  const [isUserLoading, setIsUserLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // NEW: State for search and filter
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [groupedOrders, setGroupedOrders] = useState({});

  const [orderReports, setOrderReports] = useState([]);
  const [paymentReports, setPaymentReports] = useState([]);
  const [isReportsLoading, setIsReportsLoading] = useState(false);
  const [productReports, setProductReports] = useState([]);
  const [sendInvoiceOnWhatsApp, setSendInvoiceOnWhatsApp] = useState(false);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const SHIPPING_CHARGE = 199;
const [isShippingApplied, setIsShippingApplied] = useState(false);
  useEffect(() => {
    const fetchUserRole = async () => {
      const user = auth.currentUser;

      if (!user) return;

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setCurrentUserRole(userSnap.data().role);
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      }

      setRoleLoading(false);
    };

    fetchUserRole();
  }, []);
  // 🔊 Scanner Sounds
  const readySound = new Audio("/sounds/scanner-ready.mp3");
  const successSound = new Audio("/sounds/scan-success.mp3");
  const errorSound = new Audio("/sounds/scan-error.mp3");
  readySound.volume = 0.5;   // softer
  successSound.volume = 1;   // loud beep
  errorSound.volume = 0.8;
  // medium
  useEffect(() => {
    const unlockAudio = () => {
      if (isAudioUnlocked) return;

      const temp = new Audio("/sounds/scan-success.mp3");
      temp.volume = 0;
      temp.play().catch(() => { });

      setIsAudioUnlocked(true);
      console.log("🔓 Audio unlocked");
    };

    window.addEventListener("click", unlockAudio);
    window.addEventListener("keydown", unlockAudio);

    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, [isAudioUnlocked]);


  const playSound = (file) => {
    if (!isAudioUnlocked) return;

    try {
      const sound = new Audio(file);
      sound.volume = 1;

      sound.play().catch((err) => {
        console.log("Play blocked:", err);
      });
    } catch (err) {
      console.log("Sound error:", err);
    }
  };


  const [isScannerReadyPlayed, setIsScannerReadyPlayed] = useState(false);


  const [userFilters, setUserFilters] = useState({
    name: '',
    mobile: '',
    address: '',
    role: '',
    minOrders: '',
    maxOrders: '',
    minAmount: '',
    maxAmount: '',
    lastOrderFrom: '',
    lastOrderTo: '',
    createdFrom: '',
    createdTo: '',
  });
  const handleUserFilterChange = (key, value) => {
    setUserFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // State for Offline Billing
  const [offlineCollections, setOfflineCollections] = useState([]);
  const [selectedOfflineCollectionId, setSelectedOfflineCollectionId] = useState('');
  const [offlineSubcollections, setOfflineSubcollections] = useState([]);
  const [selectedOfflineSubcollectionId, setSelectedOfflineSubcollectionId] = useState('');
  const [offlineProducts, setOfflineProducts] = useState([]);
  const [offlineCart, setOfflineCart] = useState({});
  const [offlinePricingKey, setOfflinePricingKey] = useState('retail');

  const [isOfflineProductsLoading, setIsOfflineProductsLoading] = useState(false);
  const [offlineSubtotal, setOfflineSubtotal] = useState(0);
  const [pricedOfflineCart, setPricedOfflineCart] = useState({});
  const [userSearchColumn, setUserSearchColumn] = useState('name');
  const [userSearchValue, setUserSearchValue] = useState('');
  const [userSortField, setUserSortField] = useState('createdAt');
  const [userSortOrder, setUserSortOrder] = useState('desc'); // asc | desc
  const GST_RATE = 0.03; // 3% GST (change if needed)
  const [offlineCustomer, setOfflineCustomer] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    gst: '',
  });

  const [isGSTApplied, setIsGSTApplied] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);

  // Add this line with your other useState calls at the top of the component:
  const [offlineSelections, setOfflineSelections] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  // Add this line to your other useState declarations
  const [editedTotal, setEditedTotal] = useState('');
  const [crop, setCrop] = useState();
  const [imageSrc, setImageSrc] = useState(null);
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);
  const [modalImage, setModalImage] = useState(null);
  const openImageModal = (imageUrl) => {
    if (imageUrl) {
      setModalImage(imageUrl);
    }
  };

  // 3. Handler to close the modal
  const closeImageModal = () => {
    setModalImage(null);
  };

  const formatOrderDate = (timestamp) => {
    if (!timestamp) return 'N/A';

    let orderDate;

    // 🔥 SAFE conversion
    if (typeof timestamp.toDate === 'function') {
      orderDate = timestamp.toDate(); // Firestore Timestamp
    } else if (timestamp instanceof Date) {
      orderDate = timestamp; // JS Date
    } else {
      orderDate = new Date(timestamp); // string / number fallback
    }

    if (isNaN(orderDate.getTime())) return 'N/A';

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    // Normalize dates (strip time)
    const orderDay = new Date(
      orderDate.getFullYear(),
      orderDate.getMonth(),
      orderDate.getDate()
    );
    const todayDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const yesterdayDay = new Date(
      yesterday.getFullYear(),
      yesterday.getMonth(),
      yesterday.getDate()
    );

    if (orderDay.getTime() === todayDay.getTime()) {
      return 'Today';
    }

    if (orderDay.getTime() === yesterdayDay.getTime()) {
      return 'Yesterday';
    }

    return orderDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };
  const getSafeDate = (timestamp) => {
    if (!timestamp) return null;

    // Firestore Timestamp
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }

    // JS Date
    if (timestamp instanceof Date) {
      return timestamp;
    }

    // String / number fallback
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? null : d;
  };


  // Handlers for Tiered Pricing (now for Subcollections)
  const handleAddTier = (type) => {
    setSubcollectionTieredPricing((prevPricing) => {
      const existingTiers = Array.isArray(prevPricing[type])
        ? prevPricing[type]
        : [];

      return {
        ...prevPricing,
        [type]: [
          ...existingTiers,
          { min_quantity: "", max_quantity: "", price: "" }
        ],
      };
    });
  };

  const onCropComplete = (crop) => {
    setCompletedCrop(crop);
  };
  const handleOfflineSelectionChange = (productId, variationObject) => {
    // This updates the selected variation for a specific product
    setOfflineSelections(prev => ({
      ...prev,
      [productId]: variationObject
    }));
  };
  // NOTE: You must have getCartItemId and getPriceForOfflineBilling (or similar) available in this file's scope.
  const handleOfflineCustomerChange = (field, value) => {
    setOfflineCustomer(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleOfflineAddToCart = (product, variation = null, incrementBy = 1) => {

    // 1. Determine the item's unique ID based on product and variation
    const itemToAdd = { ...product, variation: variation || product.variation };
    const cartItemId = getCartItemId(itemToAdd);

    // 2. Determine available stock for the selected variant
    // Use the stock from the passed variation object, or fallback to the product's base quantity
    const availableStock = variation
      ? Number(variation.quantity)
      : (itemToAdd.variation ? Number(itemToAdd.variation.quantity) : Number(product.quantity || 0));

    const currentQuantityInCart = offlineCart[cartItemId]?.quantity || 0;

    // 3. Stock Check: Prevent adding if the limit is reached
    if (currentQuantityInCart >= availableStock) {
      console.warn(`Cannot add item: Max stock reached for ${product.productName} (${availableStock}).`);
      // Optional: You could show a UI alert here
      return;
    }

    // 4. Update the cart state
    setOfflineCart(prevCart => {
      const existingItem = prevCart[cartItemId];

      // Item enrichment: Save the availableStock and the variation
      const itemToSave = {
        ...itemToAdd,
        id: cartItemId, // Use the unique ID as the cart key
        // You need a helper function to determine the price based on type/tiers
        price: getPriceForOfflineBilling(itemToAdd, offlinePricingKey),
        availableStock: availableStock, // Save the stock for cart controls
      };

      if (existingItem) {
        // Increment logic
        return {
          ...prevCart,
          [cartItemId]: {
            ...existingItem,
            quantity: existingItem.quantity + incrementBy,
          }
        };
      } else {
        // New item logic
        return {
          ...prevCart,
          [cartItemId]: {
            ...itemToSave,
            quantity: 1, // Add one item
          }
        };
      }
    });
  };
  const convertNumberToWords = (num) => {
    // You can plug any library here later
    return num.toLocaleString('en-IN');
  };

  // --- NEW UTILITY FUNCTION for Offline Billing ---
  const getPriceForOfflineBilling = (item, offlinePricingKey) => {
    // 1. Determine the pricing tiers to use based on the selected type (retail/wholesale)
    // NOTE: This assumes the product object already has a structure like:
    // item.tieredPricing.wholesale and item.tieredPricing.retail, or that 
    // you are passing a pre-calculated tieredPricing prop/object if needed.

    const productTiers = item.tieredPricing; // Assuming item has this structure

    if (!productTiers) {
      // Fallback: Use base price from the product/variation if no tiers are available
      return item.variation?.price || item.price || 0;
    }

    const tiers = offlinePricingKey === 'wholesale'
      ? productTiers.wholesale
      : productTiers.retail;

    if (!tiers || tiers.length === 0) {
      return item.variation?.price || item.price || 0;
    }

    // 2. Use the smallest quantity tier price (since we are adding 1 at a time, we use the base price)
    // NOTE: In the offline selection panel, we only care about the base price for display.
    // The getPriceForQuantity function (imported from CartContext) should find the correct price.

    // For simplicity in the selection panel, we usually display the base price (tier 1).
    // The lowest quantity tier is the one with the smallest min_quantity.
    const baseTier = [...tiers].sort((a, b) => a.min_quantity - b.min_quantity)[0];

    // For the cart, the price should be calculated for the *current* quantity (item.quantity).
    // Since this function is used when adding the item *to* the cart, and also when refreshing the price, 
    // we should usually just return the base price for the selection panel, or the price for quantity 1.

    // Using quantity 1 to get the base price
    return getPriceForQuantity(tiers, 1) || baseTier.price || item.price || 0;
  };
  const handleRemoveTier = (type, index) => {
    setSubcollectionTieredPricing((prevPricing) => ({
      ...prevPricing,
      [type]: prevPricing[type].filter((_, i) => i !== index),
    }));
  };


  const fetchOrders = async () => {
    try {
      const ordersSnapshot = await getDocs(collection(db, "orders"));
      const ordersList = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Ensure timestamps are handled correctly for sorting
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }));

      // Sort orders by creation date, descending
      ordersList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Group orders by formatted date
      const groups = ordersList.reduce((acc, order) => {
        const dateKey = formatOrderDate(order.createdAt);
        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }
        acc[dateKey].push(order);
        return acc;
      }, {});

      setGroupedOrders(groups);
      setOrders(ordersList);
    } catch (error) {
      console.error("Error fetching orders: ", error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      await fetchMainCollections();
      await fetchSubcollections();
      await fetchProducts();
      await fetchOrders();
    };
    fetchData();
  }, []);

  const openOrderModal = (order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };
  

  const closeOrderModal = () => {
    setShowOrderModal(false);
    setSelectedOrder(null);
  };
  useEffect(() => {
    const stats = {};

    orders.forEach(order => {
      const userId = order.userId;
      if (!userId || !order.createdAt) return;

      // 🚫 Ignore cancelled orders
      if (order.status === 'Cancelled') return;

      const orderDate = getSafeDate(order.createdAt);

      const amount = Number(order.totalAmount) || 0;
      const profit = Number(order.orderProfit) || 0; // 🔥 PRECOMPUTED

      if (!stats[userId]) {
        stats[userId] = {
          lastOrderDate: orderDate,
          totalOrders: 0,
          lifetimeValue: 0,
          lifetimeProfit: 0, // 🔥 ADD THIS
        };
      }

      stats[userId].totalOrders += 1;
      stats[userId].lifetimeValue += amount;
      stats[userId].lifetimeProfit += profit;

      if (orderDate > stats[userId].lastOrderDate) {
        stats[userId].lastOrderDate = orderDate;
      }
    });

    setUserOrderStats(stats);
  }, [orders]);

  useEffect(() => {
    console.log('User Order Stats:', userOrderStats);
  }, [userOrderStats]);

  const baseTotal =
    editedTotal !== ''
      ? Number(editedTotal)
      : Number(offlineSubtotal);

  const gstAmount = isGSTApplied
    ? baseTotal * GST_RATE
    : 0;

const shippingValue = isShippingApplied ? SHIPPING_CHARGE : 0;

const finalTotal =
  Number(offlineSubtotal) +
  (isGSTApplied ? Number(gstAmount) : 0) +
  shippingValue;

  const handleTierChange = (type, index, field, value) => {
    setSubcollectionTieredPricing((prevPricing) => {
      const updatedTiers = [...prevPricing[type]];
      updatedTiers[index] = { ...updatedTiers[index], [field]: value };
      return { ...prevPricing, [type]: updatedTiers };
    });
  };
  useEffect(() => {
    if (showInvoice && invoiceData) {
      // Small delay ensures DOM + styles are fully rendered
      const timer = setTimeout(() => {
        window.print();
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [showInvoice, invoiceData]);

  // --- Utility Functions ---
  const handleImageChange = (e, setImageFile) => {
    if (e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const uploadImageAndGetURL = async (imageFile) => {
    if (!imageFile) return null;
    const storageRef = ref(storage, `images/${Date.now()}-${imageFile.name}`);
    const snapshot = await uploadBytes(storageRef, imageFile);
    return await getDownloadURL(snapshot.ref);
  };

  const deleteImageFromStorage = async (imageUrl) => {
    if (!imageUrl) return;
    try {
      const imageRef = ref(storage, imageUrl);
      await deleteObject(imageRef);
    } catch (error) {
      console.error('Error deleting image from storage:', error);
    }
  };
const [isCartInitialized, setIsCartInitialized] = useState(false);

/* =========================
   RESTORE CART ON LOAD
========================= */
useEffect(() => {
  const savedCart = localStorage.getItem("offlineCartDraft");

  if (savedCart) {
    try {
      const parsedCart = JSON.parse(savedCart);
      setOfflineCart(parsedCart);
      console.log("📦 Draft restored:", parsedCart);
    } catch (error) {
      console.error("❌ Failed to restore cart:", error);
      localStorage.removeItem("offlineCartDraft");
    }
  }

  // Mark initialization complete
  setIsCartInitialized(true);
}, []);


/* =========================
   SAVE CART AFTER CHANGES
========================= */
useEffect(() => {
  if (!isCartInitialized) return; // 🚫 Prevent first render overwrite

  localStorage.setItem(
    "offlineCartDraft",
    JSON.stringify(offlineCart)
  );

  console.log("💾 Draft saved:", offlineCart);
}, [offlineCart, isCartInitialized]);
  // --- Fetch Main Collections ---
  const fetchMainCollections = async () => {
    setIsMainCollectionLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'collections'));
      const fetched = querySnapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      }));
      setMainCollections(fetched.sort((a, b) => a.showNumber - b.showNumber));
    } catch (error) {
      console.error('Error fetching main collections:', error);
    }
    setIsMainCollectionLoading(false);
  };

  // --- Fetch Subcollections for Selected Main Collection ---
  const fetchSubcollections = async () => {
    if (!selectedMainCollectionId) {
      setSubcollections([]);
      return;
    }
    setIsSubcollectionLoading(true);
    try {
      const subcollectionRef = collection(db, 'collections', selectedMainCollectionId, 'subcollections');
      const querySnapshot = await getDocs(subcollectionRef);
      const fetched = querySnapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      }));
      setSubcollections(fetched.sort((a, b) => a.showNumber - b.showNumber));
    } catch (error) {
      console.error('Error fetching subcollections:', error);
    }
    setIsSubcollectionLoading(false);
  };

  const handleAdditionalImageChange = (e) => {
    const files = Array.from(e.target.files);
    setAdditionalImages(files.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
    })));
  };

  // --- Fetch Products for Selected Subcollection ---
  const fetchProducts = async () => {
    if (!selectedMainCollectionId || !selectedSubcollectionId) {
      setProducts([]);
      setSelectedSubcollectionData(null);
      return;
    }
    setIsProductLoading(true);
    try {
      const subcollectionDocRef = doc(db, 'collections', selectedMainCollectionId, 'subcollections', selectedSubcollectionId);
      const subcollectionDocSnap = await getDoc(subcollectionDocRef);
      if (subcollectionDocSnap.exists()) {
        setSelectedSubcollectionData({ id: subcollectionDocSnap.id, ...subcollectionDocSnap.data() });
      } else {
        setSelectedSubcollectionData(null);
      }

      const productsRef = collection(db, 'collections', selectedMainCollectionId, 'subcollections', selectedSubcollectionId, 'products');
      const querySnapshot = await getDocs(productsRef);
      const fetched = querySnapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      }));
      setProducts(fetched);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
    setIsProductLoading(false);
  };

  // UseEffects to trigger data fetching on dependency changes
  useEffect(() => {
    fetchMainCollections();
  }, []);

  useEffect(() => {
    fetchSubcollections();
    setSelectedSubcollectionId('');
  }, [selectedMainCollectionId]);

  useEffect(() => {
    fetchProducts();
  }, [selectedSubcollectionId, selectedMainCollectionId]);

  // New: Fetches all orders
  useEffect(() => {
  if (activeTab !== "orders") return;

  setIsOrderLoading(true);

  const ordersCollectionRef = collection(db, "orders");

  const unsubscribe = onSnapshot(
    ordersCollectionRef,
    (snapshot) => {
      const fetchedOrders = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      }));

      setOrders(fetchedOrders);
      setIsOrderLoading(false);
    },
    (error) => {
      console.error("Error listening to orders:", error);
      setIsOrderLoading(false);
    }
  );

  return () => unsubscribe();
}, [activeTab]);
  // NEW: Filtered orders based on search and date range
  // Updated: Filtered orders based on search, date, and now status
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Search filter logic
      const searchTerm = orderSearchTerm.toLowerCase();

      const matchesSearch =
        order.id.toLowerCase().includes(searchTerm) ||
        (order.billingInfo?.fullName || '').toLowerCase().includes(searchTerm) ||
        (order.billingInfo?.email || '').toLowerCase().includes(searchTerm) ||
        (order.billingInfo?.phoneNumber || '').toLowerCase().includes(searchTerm);

      // Date filter logic
      const orderDate = getSafeDate(order.createdAt);

      const isAfterStartDate = startDate
        ? orderDate >= new Date(startDate)
        : true;

      const isBeforeEndDate = endDate
        ? orderDate <= new Date(endDate)
        : true;

      // Status filter logic
      const matchesStatus =
        statusFilter === 'All' || order.status === statusFilter;

      return (
        matchesSearch &&
        isAfterStartDate &&
        isBeforeEndDate &&
        matchesStatus
      );
    });
  }, [orders, orderSearchTerm, startDate, endDate, statusFilter]);
  const groupedOrdersFromFiltered = useMemo(() => {
    return filteredOrders.reduce((acc, order) => {
      const dateKey = formatOrderDate(order.createdAt);

      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }

      acc[dateKey].push(order);
      return acc;
    }, {});
  }, [filteredOrders]);
  const sortedDateKeys = useMemo(() => {
    const keys = Object.keys(groupedOrdersFromFiltered);

    return keys.sort((a, b) => {
      if (a === 'Today') return -1;
      if (b === 'Today') return 1;
      if (a === 'Yesterday') return -1;
      if (b === 'Yesterday') return 1;

      // Other dates: newest first
      return new Date(b) - new Date(a);
    });
  }, [groupedOrdersFromFiltered]);


  // New: Fetches low stock products
  useEffect(() => {
    const fetchLowStockProducts = async () => {
      if (activeTab === 'lowStock') {
        setIsLowStockLoading(true);
        const allLowStockProducts = [];

        // Loop through all main collections and subcollections to find products
        for (const mainCol of mainCollections) {
          const subcollectionRef = collection(db, "collections", mainCol.id, "subcollections");
          const subcollectionSnapshot = await getDocs(subcollectionRef);

          for (const subCol of subcollectionSnapshot.docs) {
            const productsRef = collection(db, "collections", mainCol.id, "subcollections", subCol.id, "products");
            // Use a query to filter for low stock items
            const q = query(productsRef, where("quantity", "<=", LOW_STOCK_THRESHOLD));
            const productsSnapshot = await getDocs(q);

            productsSnapshot.forEach(productDoc => {
              allLowStockProducts.push({
                ...productDoc.data(),
                id: productDoc.id,
                mainCollectionName: mainCol.name,
                subcollectionName: subCol.data().name,
              });
            });
          }
        }
        setLowStockProducts(allLowStockProducts);
        setIsLowStockLoading(false);
      }
    };
    fetchLowStockProducts();
  }, [activeTab, mainCollections]);

  // New: Fetches all users for admin management
  const fetchUsers = async () => {
    if (activeTab === 'users') {
      setIsUserLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const fetchedUsers = querySnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));
        setUsers(fetchedUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
      setIsUserLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [activeTab]);
  // useEffect(() => {
  //   if (activeTab === 'orders') {
  //     fetchOrders();
  //   }
  //   if (activeTab === 'users') {
  //     fetchUsers();
  //   }
  //   if (activeTab === 'collections') {
  //     fetchMainCollections();
  //   }
  //   if (activeTab === 'offline-billing') {
  //     fetchMainCollectionsForOffline();
  //   }
  // }, [activeTab]);
  useEffect(() => {
    if (selectedOfflineCollectionId) {
      fetchSubcollectionsForOffline(selectedOfflineCollectionId);
      setOfflineProducts([]); // Clear products when collection changes
      setSelectedOfflineSubcollectionId('');
    }
  }, [selectedOfflineCollectionId]);

  useEffect(() => {
    if (selectedOfflineSubcollectionId) {
      fetchOfflineProducts(selectedOfflineSubcollectionId);
    }
  }, [selectedOfflineSubcollectionId]);

  const handleDownloadLowStockImages = async () => {
    setIsDownloading(true);
    try {
      for (const product of lowStockProducts) {
        if (product.image) {
          const response = await fetch(product.image);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `low_stock_${product.productCode}.jpg`; // Customize filename
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      }
    } catch (error) {
      console.error("Error downloading images:", error);
      alert("Failed to download one or more images.");
    } finally {
      setIsDownloading(false);
    }
  };


  // New: Function to handle updating order status
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: newStatus,
      });
      setOrders(prevOrders => prevOrders.map(order =>
        order.id === orderId ? { ...order, status: newStatus } : order
      ));
      alert("Order status updated successfully!");
    } catch (error) {
      console.error("Error updating order status:", error);
      alert("Failed to update order status.");
    }
  };

  // New: Function to update a user's role
  const handleUpdateUserRole = async (userId, newRole) => {
    if (window.confirm(`Are you sure you want to change this user's role to '${newRole}'?`)) {
      try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, { role: newRole });
        fetchUsers(); // Refresh the user list
        alert('User role updated successfully!');
      } catch (error) {
        console.error('Error updating user role:', error);
        alert('Failed to update user role.');
      }
    }
  };

  // New: Function to delete a user
 const handleDeleteUser = async (userId) => {
  const confirmDelete = window.confirm(
    "Are you sure you want to delete this user?"
  );

  if (!confirmDelete) return;

  const password = window.prompt(
    "Enter admin password to delete this user:"
  );

  if (password === null) return; // User cancelled

  if (password !== "Reddy@2002") {
    alert("Incorrect password.");
    return;
  }

  try {
    await deleteDoc(doc(db, "users", userId));

    await fetchUsers();

    alert("User deleted successfully!");
  } catch (error) {
    console.error("Error deleting user:", error);
    alert("Failed to delete user.");
  }
};
  const handleMainCollectionAdditionalImagesChange = (e) => {
    const files = Array.from(e.target.files || []);

    setMainCollectionAdditionalImages(
      files.map(file => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }))
    );
  };

  // --- Main Collection Handlers ---
  const handleAddMainCollection = async (e) => {
    e.preventDefault();

    if (!mainCollectionName || !mainCollectionImageFile || !mainCollectionShowNumber) {
      alert('Please fill out all fields.');
      return;
    }

    setIsMainCollectionUploading(true);

    try {
      /* ---------- UPLOAD MAIN IMAGE ---------- */
      const mainImageUrl = await uploadImageAndGetURL(mainCollectionImageFile);

      /* ---------- UPLOAD ADDITIONAL IMAGES ---------- */
      const uploadedAdditionalImages = [];

      for (const img of mainCollectionAdditionalImages) {
        if (img.file) {
          const url = await uploadImageAndGetURL(img.file);
          uploadedAdditionalImages.push(url);
        }
      }

      await addDoc(collection(db, 'collections'), {
        title: mainCollectionName,
        image: mainImageUrl,
        additionalImages: uploadedAdditionalImages,
        showNumber: parseInt(mainCollectionShowNumber, 10),
        createdAt: serverTimestamp(),
      });

      fetchMainCollections();
      resetMainCollectionForm();
    } catch (error) {
      console.error('Error adding main collection:', error);
      alert('Failed to add main collection.');
    } finally {
      setIsMainCollectionUploading(false);
    }
  };


  const startEditMainCollection = (item) => {
    setEditingMainCollection(item);
    setMainCollectionName(item.title);
    setMainCollectionShowNumber(item.showNumber);

    setMainCollectionAdditionalImages(
      (item.additionalImages || []).map(url => ({
        previewUrl: url,
      }))
    );
  };


  const handleUpdateMainCollection = async (e) => {
    e.preventDefault();
    if (!editingMainCollection) return;

    setIsMainCollectionUploading(true);

    try {
      let mainImageUrl = editingMainCollection.image;

      /* ---------- REPLACE MAIN IMAGE IF CHANGED ---------- */
      if (mainCollectionImageFile) {
        await deleteImageFromStorage(editingMainCollection.image);
        mainImageUrl = await uploadImageAndGetURL(mainCollectionImageFile);
      }

      /* ---------- HANDLE ADDITIONAL IMAGES ---------- */
      const existingAdditional = mainCollectionAdditionalImages
        .filter(img => !img.file)
        .map(img => img.previewUrl);

      const newUploads = [];

      for (const img of mainCollectionAdditionalImages) {
        if (img.file) {
          const url = await uploadImageAndGetURL(img.file);
          newUploads.push(url);
        }
      }

      const allAdditionalImages = [...existingAdditional, ...newUploads];

      await updateDoc(
        doc(db, 'collections', editingMainCollection.id),
        {
          title: mainCollectionName,
          image: mainImageUrl,
          additionalImages: allAdditionalImages,
          showNumber: parseInt(mainCollectionShowNumber, 10),
          updatedAt: serverTimestamp(),
        }
      );

      fetchMainCollections();
      resetMainCollectionForm();
    } catch (error) {
      console.error('Error updating main collection:', error);
      alert('Failed to update main collection.');
    } finally {
      setIsMainCollectionUploading(false);
    }
  };


  const handleDeleteMainCollection = async (item) => {
    if (!window.confirm('Delete this collection and all its data?')) return;

    try {
      const urlsToDelete = [
        item.image,
        ...(item.additionalImages || []),
      ];

      for (const url of urlsToDelete) {
        if (url) {
          await deleteObject(ref(storage, url));
        }
      }

      await deleteDoc(doc(db, 'collections', item.id));
      fetchMainCollections();
    } catch (err) {
      console.error('Error deleting main collection:', err);
      alert('Failed to delete collection.');
    }
  };

  const generateInvoicePDFBlob = async () => {
    const element = document.getElementById("invoice-pdf");
    if (!element) return null;

    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });

    const imgData = canvas.toDataURL("image/jpeg", 1.0);

    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = 210;
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);

    return pdf.output("blob");
  };
  const uploadInvoicePDF = async (orderId) => {
    const pdfBlob = await generateInvoicePDFBlob();
    if (!pdfBlob) return null;

    const pdfRef = ref(storage, `invoices/${orderId}.pdf`);
    await uploadBytes(pdfRef, pdfBlob);

    const downloadURL = await getDownloadURL(pdfRef);
    return downloadURL;
  };


  const resetMainCollectionForm = () => {
    setMainCollectionName('');
    setMainCollectionImageFile(null);
    setMainCollectionShowNumber('');
    setEditingMainCollection(null);
  };

  // --- Subcollection Handlers ---

  const handleAddSubcollection = async (e) => {
    e.preventDefault();

    // ✅ BASIC REQUIRED FIELDS CHECK
    if (
      !selectedMainCollectionId ||
      !subcollectionName ||
      !subcollectionPurchaseRate ||
      !subcollectionImageFile ||
      !subcollectionShowNumber
    ) {
      alert('Please fill out all required fields.');
      return;
    }

    // ✅ ROLE-AGNOSTIC PRICING VALIDATION (IMPORTANT FIX)
    const hasPricing = Object.values(subcollectionTieredPricing)
      .some(tiers => Array.isArray(tiers) && tiers.length > 0);

    if (!hasPricing) {
      alert('Add at least one pricing tier.');
      return;
    }

    setIsSubcollectionUploading(true);

    try {
      const imageUrl = await uploadImageAndGetURL(subcollectionImageFile);

      const subcollectionRef = collection(
        db,
        'collections',
        selectedMainCollectionId,
        'subcollections'
      );

      const newDoc = await addDoc(subcollectionRef, {
        name: subcollectionName,
        description: subcollectionDescription,
        image: imageUrl,
        showNumber: parseInt(subcollectionShowNumber, 10),
        purchaseRate: parseFloat(subcollectionPurchaseRate),
        tieredPricing: subcollectionTieredPricing,
        createdAt: serverTimestamp(),
      });

      console.log('Subcollection added with ID:', newDoc.id);
      fetchSubcollections();
    } catch (error) {
      console.error('Error adding subcollection:', error);
      alert('Failed to add subcollection.');
    } finally {
      setIsSubcollectionUploading(false);
      resetSubcollectionForm();
    }
  };

  const startEditSubcollection = (item) => {
    setEditingSubcollection(item);
    setSubcollectionName(item.name || '');
    setSubcollectionDescription(item.description || '');
    setSubcollectionShowNumber(item.showNumber || '');
    setSubcollectionPurchaseRate(item.purchaseRate || '');

    // ✅ SAFE DEFAULT FOR MULTI-ROLE PRICING
    setSubcollectionTieredPricing(item.tieredPricing || {});
  };

  const handleUpdateSubcollection = async (e) => {
    e.preventDefault();
    if (!editingSubcollection) return;

    // ✅ ROLE-AGNOSTIC PRICING VALIDATION (SAME AS ADD)
    const hasPricing = Object.values(subcollectionTieredPricing)
      .some(tiers => Array.isArray(tiers) && tiers.length > 0);

    if (!hasPricing) {
      alert('Add at least one pricing tier.');
      return;
    }

    setIsSubcollectionUploading(true);

    let imageUrl = editingSubcollection.image;

    try {
      if (subcollectionImageFile) {
        await deleteImageFromStorage(editingSubcollection.image);
        imageUrl = await uploadImageAndGetURL(subcollectionImageFile);
      }

      const docRef = doc(
        db,
        'collections',
        selectedMainCollectionId,
        'subcollections',
        editingSubcollection.id
      );

      await updateDoc(docRef, {
        name: subcollectionName,
        description: subcollectionDescription,
        image: imageUrl,
        showNumber: parseInt(subcollectionShowNumber, 10),
        purchaseRate: parseFloat(subcollectionPurchaseRate),
        tieredPricing: subcollectionTieredPricing,
        updatedAt: serverTimestamp(),
      });

      console.log('Subcollection updated successfully');
      fetchSubcollections();
    } catch (error) {
      console.error('Error updating subcollection:', error);
      alert('Failed to update subcollection.');
    } finally {
      setIsSubcollectionUploading(false);
      resetSubcollectionForm();
    }
  };

  const handleDeleteSubcollection = async (id, imageUrl) => {
    if (!window.confirm('Are you sure you want to delete this subcollection and all its products?')) {
      return;
    }

    try {
      await deleteImageFromStorage(imageUrl);

      const docRef = doc(
        db,
        'collections',
        selectedMainCollectionId,
        'subcollections',
        id
      );

      await deleteDoc(docRef);
      fetchSubcollections();
    } catch (error) {
      console.error('Error deleting subcollection:', error);
      alert('Failed to delete subcollection.');
    }
  };

  const resetSubcollectionForm = () => {
    setSubcollectionName('');
    setSubcollectionDescription('');
    setSubcollectionImageFile(null);
    setSubcollectionShowNumber('');
    setSubcollectionPurchaseRate('');
    setSubcollectionTieredPricing({});
    setEditingSubcollection(null);
  };

  // --- Product Handlers ---
  const handleProductImageChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const products = files.map(file => {
        return {
          productName: '',
          productCode: '',
          quantity: '',
          imageFile: file,
          previewUrl: URL.createObjectURL(file),
        };
      });
      setNewProducts(products);
      setCurrentImageIndex(0);
      setShowProductForm(true); // Directly show the form
    }
  };

  // Opens the cropper with the selected image
  const startCropping = (imageUrl) => {
    setImageToCrop(imageUrl);
    setCrop(undefined);
    setIsCropping(true);
  };

  // Handles the cropping action and updates the product in state
  const getCroppedImage = () => {
    if (!imgRef.current || !completedCrop) {
      return;
    }

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );

    canvas.toBlob((blob) => {
      const croppedFile = new File([blob], 'cropped-image.png', { type: 'image/png' });

      // Create a new array to update the state immutably
      const updatedProducts = [...newProducts];

      // Find the index of the product being edited or the current one being added
      const indexToUpdate = editingProduct ? newProducts.findIndex(p => p.id === editingProduct.id) : currentImageIndex;

      // Update the image file and preview URL for the correct product
      if (indexToUpdate !== -1) {
        updatedProducts[indexToUpdate] = {
          ...updatedProducts[indexToUpdate],
          imageFile: croppedFile,
          previewUrl: URL.createObjectURL(croppedFile),
        };
        setNewProducts(updatedProducts);
      }

      // Hide the cropper and return to the form
      setIsCropping(false);
      setImageToCrop(null);
      setCompletedCrop(null);
    }, 'image/png');
  };
  // Add this function to your component's logic
  const handleDeleteNewImage = (indexToDelete) => {
    // Create a new array without the image to be deleted
    const updatedNewProducts = newProducts.filter((_, index) => index !== indexToDelete);

    // If the deleted image was the last one, reset the form.
    if (updatedNewProducts.length === 0) {
      resetProductForm();
      setShowProductForm(false);
    } else {
      // Update the state with the new array
      setNewProducts(updatedNewProducts);
      // If we deleted an image and there are still images left,
      // we need to make sure the current index is valid.
      // If the last image was deleted, the index should be adjusted.
      if (currentImageIndex >= updatedNewProducts.length) {
        setCurrentImageIndex(updatedNewProducts.length - 1);
      }
    }
  };

  // Handler for new variation input
  const handleNewVariationChange = (e) => {
    const { name, value } = e.target;
    setNewVariation(prev => ({ ...prev, [name]: value }));
  };

  // Handler for adding a variation to the list
  const handleAddVariation = () => {
    // Ensure at least one field has data before adding
    if (newVariation.color || newVariation.size || newVariation.quantity) {
      setProductVariations(prev => [...prev, newVariation]);
      setNewVariation({ color: '', size: '', quantity: '' }); // Reset the input fields
    }
  };

  // Handler for removing a variation
  const handleRemoveVariation = (indexToRemove) => {
    setProductVariations(prev => prev.filter((_, index) => index !== indexToRemove));
  };
  const handleNextProduct = (e) => {
    e.preventDefault();

    // Check for product name and code
    if (!productName || !productCode) {
      alert("Please fill out product name and product code.");
      return;
    }

    // Check if either a single quantity or at least one variation has been added
    if (productVariations.length === 0 && productQuantity === '') {
      alert("Please enter a quantity or add at least one variation.");
      return;
    }

    const updatedProducts = [...newProducts];

    // Create an array of images including the main one and any additional uploads
    const images = [{
      file: updatedProducts[currentImageIndex].imageFile,
      previewUrl: updatedProducts[currentImageIndex].previewUrl,
    }, ...additionalImages];

    updatedProducts[currentImageIndex].productName = productName;
    updatedProducts[currentImageIndex].productCode = productCode;

    // Store either the single quantity or the variations
    if (productVariations.length > 0) {
      updatedProducts[currentImageIndex].variations = productVariations;
    } else {
      updatedProducts[currentImageIndex].quantity = Number(productQuantity);
    }

    updatedProducts[currentImageIndex].images = images; // Save the array of images

    setNewProducts(updatedProducts);

    // Reset fields for the next product
    setProductName('');
    setProductCode('');
    setProductQuantity('');
    setAdditionalImages([]);

    // Reset the variation-specific states
    setProductVariations([]);
    setNewVariation({ color: '', size: '', quantity: '' });

    setCurrentImageIndex(currentImageIndex + 1);
  };
  const autoEnableForDropshippers = async (productId, productData) => {

  const settingsSnap = await getDocs(collection(db, "dropshipperSettings"));

  for (const settingDoc of settingsSnap.docs) {

    const userId = settingDoc.id;
    const data = settingDoc.data();

    const key = `${selectedMainCollectionId}_${selectedSubcollectionId}`;

    // Skip if autoEnable not enabled for this subcollection
    if (!data?.autoEnable?.[key]) continue;

    const batch = writeBatch(db);

    /* dropshipperProducts */

    const dropshipperRef = doc(
      db,
      "dropshipperProducts",
      userId,
      "products",
      productId
    );

    batch.set(dropshipperRef, {
      productId,
      collectionId: selectedMainCollectionId,
      subcollectionId: selectedSubcollectionId,
      enabled: true,
      updatedAt: Date.now()
    });

    /* storeProducts */

    const storeRef = doc(
      db,
      "storeProducts",
      userId,
      "products",
      productId
    );

    batch.set(storeRef, {
      productId,
      productName: productData.productName,
      productCode: productData.productCode,
      image: productData.image,
      collectionId: selectedMainCollectionId,
      subcollectionId: selectedSubcollectionId,
      enabled: true,
      updatedAt: Date.now()
    });

    await batch.commit();
  }
};
  const handleAddAllProducts = async (e) => {
        e.preventDefault();

    if (!productDestination) {
  alert("Please select where you want to upload the product.");
  return;
}
    setIsProductUploading(true);

    try {
const productCollectionRef = collection(
  db,
  "collections",
  selectedMainCollectionId,
  "subcollections",
  selectedSubcollectionId,
  productDestination
);

      const batch = writeBatch(db);

      for (const product of newProducts) {
        // Safety check
        if (!product.productName || !product.productCode) {
          console.error("Skipping product with missing name/code:", product);
          continue;
        }

        /* -----------------------------------------
           STEP 1: UPLOAD ALL IMAGES (MAIN + EXTRA)
        ------------------------------------------ */
        const uploadedImageUrls = [];

        for (const img of product.images || []) {
          if (img.file) {
            const url = await uploadImageAndGetURL(img.file);
            uploadedImageUrls.push(url);
          }
        }

        // Split images
        const mainImageUrl = uploadedImageUrls[0] || "";
        const additionalImageUrls = uploadedImageUrls.slice(1);

        /* -----------------------------------------
           STEP 2: HANDLE VARIATIONS / QUANTITY
        ------------------------------------------ */
        let finalVariations = [];
        let totalQuantity = 0;

        if (product.variations && product.variations.length > 0) {
          finalVariations = product.variations.map(v => ({
            color: v.color || "",
            size: v.size || "",
            quantity: Number(v.quantity) || 0,
          }));

          totalQuantity = finalVariations.reduce(
            (sum, v) => sum + v.quantity,
            0
          );
        } else {
          totalQuantity = Number(product.quantity) || 0;
          finalVariations = [];
        }

        /* -----------------------------------------
           STEP 3: PREPARE PRODUCT DATA (🔥 IMPORTANT)
        ------------------------------------------ */
        const productData = {
          productName: product.productName,
          productCode: product.productCode,

          image: mainImageUrl,                      // ✅ main image
          additionalImages: additionalImageUrls,    // ✅ REQUIRED BY ProductCard

          quantity: totalQuantity,
            initialQuantity: totalQuantity, 
  variations: finalVariations.map(v => ({
    ...v,
    initialQuantity: v.quantity      // ✅ SAVE INITIAL VARIANT STOCK
  })),
          mainCollection: selectedMainCollectionId,
          createdAt: serverTimestamp(),
        };

        console.log("Saving product:", productData);

       const newDocRef = doc(productCollectionRef);
batch.set(newDocRef, productData);

/* SAVE PRODUCT ID FOR AUTO ENABLE */

product.autoEnableId = newDocRef.id;
product.autoEnableData = productData;
      }

      await batch.commit();

/* AUTO ENABLE FOR DROPSHIPPERS */

for (const product of newProducts) {

  if (product.autoEnableId) {

    await autoEnableForDropshippers(
      product.autoEnableId,
      product.autoEnableData
    );

  }

}

      alert("All products added successfully!");
      fetchProducts();
      resetProductForm();

      // Cleanup
      setNewProducts([]);
      setProductVariations([]);
      setNewVariation({ color: "", size: "", quantity: "" });

    } catch (err) {
      console.error("Error adding products:", err);
      alert("Failed to save products.");
    } finally {
      setIsProductUploading(false);
    }
  };


  const startEditProduct = (product) => {
    console.log("Starting edit for product:", product);

    setEditingProduct(product);

    // Basic info
    setProductName(product.productName || "");
    setProductCode(product.productCode || "");

    /* -----------------------------------------
       STEP 1: LOAD VARIATIONS OR SINGLE QUANTITY
    ------------------------------------------ */
    if (product.variations && product.variations.length > 0) {
      setProductVariations(
        product.variations.map(v => ({
          color: v.color || "",
          size: v.size || "",
          quantity: v.quantity || "",
        }))
      );
      setProductQuantity("");
    } else {
      setProductVariations([]);
      setProductQuantity(product.quantity || "");
    }

    setNewVariation({ color: "", size: "", quantity: "" });

    /* -----------------------------------------
       STEP 2: LOAD ADDITIONAL IMAGES (🔥 IMPORTANT)
    ------------------------------------------ */
    setAdditionalImages(
      (product.additionalImages || []).map(url => ({
        previewUrl: url
      }))
    );

    /* -----------------------------------------
       STEP 3: SHOW FORM
    ------------------------------------------ */
    setShowProductForm(true);
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    setIsProductUploading(true);

    try {
      const productDocRef = doc(
        db,
        "collections",
        selectedMainCollectionId,
        "subcollections",
        selectedSubcollectionId,
        "products",
        editingProduct.id
      );

      /* -----------------------------------------
         STEP 1: UPLOAD ONLY NEW IMAGES
      ------------------------------------------ */
      const uploadedNewImageUrls = [];

      for (const img of additionalImages) {
        // img.file exists ONLY for newly added images
        if (img.file) {
          const url = await uploadImageAndGetURL(img.file);
          uploadedNewImageUrls.push(url);
        }
      }

      /* -----------------------------------------
         STEP 2: KEEP EXISTING IMAGE URLS
      ------------------------------------------ */
      const existingImageUrls = additionalImages
        .filter(img => !img.file && img.previewUrl)
        .map(img => img.previewUrl);

      const allImageUrls = [
        ...(editingProduct.image ? [editingProduct.image] : []),
        ...existingImageUrls,
        ...uploadedNewImageUrls,
      ];

      const mainImageUrl = allImageUrls[0] || "";
      const additionalImageUrls = allImageUrls.slice(1);

      /* -----------------------------------------
         STEP 3: HANDLE VARIATIONS / QUANTITY
      ------------------------------------------ */
      let finalVariations = [];
      let finalQuantity = 0;

      if (productVariations.length > 0) {
   finalVariations = productVariations.map(v => ({
  color: v.color || "",
  size: v.size || "",
  quantity: Number(v.quantity) || 0,
  initialQuantity: (v.initialQuantity ?? Number(v.quantity)) || 0
}));

        finalQuantity = finalVariations.reduce(
          (sum, v) => sum + v.quantity,
          0
        );
      } else {
        finalQuantity = Number(productQuantity) || 0;
        finalVariations = [];
      }

      /* -----------------------------------------
         STEP 4: UPDATE FIRESTORE (🔥 IMPORTANT)
      ------------------------------------------ */
      const productData = {
        productName,
        productCode,

        image: mainImageUrl,                      // ✅ main image
        additionalImages: additionalImageUrls,    // ✅ what ProductCard expects

        quantity: finalQuantity,
        variations: finalVariations,

        updatedAt: serverTimestamp(),
      };

      await updateDoc(productDocRef, productData);

      alert("Product updated successfully!");
      fetchProducts();
      resetProductForm();

      // Cleanup
      setEditingProduct(null);
      setAdditionalImages([]);
      setProductVariations([]);
      setNewVariation({ color: "", size: "", quantity: "" });

    } catch (err) {
      console.error("Error updating product:", err);
      alert("Failed to update product.");
    } finally {
      setIsProductUploading(false);
    }
  };


  const handleDeleteProduct = async (product) => {
    if (!window.confirm("Are you sure you want to delete this product?")) {
      return;
    }

    try {
      /* -----------------------------------------
         STEP 1: COLLECT ALL IMAGE URLS
      ------------------------------------------ */
      const imageUrls = [
        product.image,
        ...(product.additionalImages || []),
      ];

      /* -----------------------------------------
         STEP 2: DELETE ALL IMAGES FROM STORAGE
      ------------------------------------------ */
      for (const url of imageUrls) {
        if (url) {
          try {
            const imageRef = ref(storage, url);
            await deleteObject(imageRef);
          } catch (err) {
            console.warn("Failed to delete image:", url, err);
            // Continue deleting others even if one fails
          }
        }
      }

      /* -----------------------------------------
         STEP 3: DELETE PRODUCT DOCUMENT
      ------------------------------------------ */
      const productDocRef = doc(
        db,
        "collections",
        selectedMainCollectionId,
        "subcollections",
        selectedSubcollectionId,
        "products",
        product.id
      );

      await deleteDoc(productDocRef);

      fetchProducts();
      alert("Product deleted successfully!");

    } catch (err) {
      console.error("Error deleting product:", err);
      alert("Failed to delete product.");
    }
  };

  const filteredAndSortedUsers = [...users]

    /* =========================
       🔍 FILTER
       ========================= */
    .filter((user) => {
      const value = userSearchValue.toLowerCase().trim();
      if (!value) return true;

      const stats = userOrderStats[user.id] || {};

      switch (userSearchColumn) {
        case 'name':
          return user.name?.toLowerCase().includes(value);

        case 'mobile':
          return user.mobile?.toLowerCase().includes(value);

        case 'address':
          return user.address?.toLowerCase().includes(value);

        case 'role':
          return user.role?.toLowerCase().includes(value);

        case 'lastLogin':
          return formatDate(user.lastLogin)
            ?.toLowerCase()
            .includes(value);

        case 'lastOrder':
          return formatDate(stats.lastOrderDate)
            ?.toLowerCase()
            .includes(value);

        case 'orders':
          return String(stats.totalOrders || 0).includes(value);

        case 'amount':
          return String(stats.lifetimeValue || 0).includes(value);

        /* 🔥 ADD PROFIT FILTER */
        case 'profit':
          return String(stats.lifetimeProfit || 0).includes(value);

        case 'createdAt':
          return formatDate(user.createdAt)
            ?.toLowerCase()
            .includes(value);

        default:
          return true;
      }
    })

    /* =========================
       🔃 SORT
       ========================= */
    .sort((a, b) => {
      const statsA = userOrderStats[a.id] || {};
      const statsB = userOrderStats[b.id] || {};

      let valA;
      let valB;

      switch (userSortField) {
        case 'name':
          valA = a.name || '';
          valB = b.name || '';
          break;

        case 'orders':
          valA = statsA.totalOrders || 0;
          valB = statsB.totalOrders || 0;
          break;

        case 'amount':
          valA = statsA.lifetimeValue || 0;
          valB = statsB.lifetimeValue || 0;
          break;

        /* 🔥 ADD PROFIT SORT */
        case 'profit':
          valA = statsA.lifetimeProfit || 0;
          valB = statsB.lifetimeProfit || 0;
          break;

        case 'lastLogin':
          valA = a.lastLogin?.toDate?.() || new Date(0);
          valB = b.lastLogin?.toDate?.() || new Date(0);
          break;

        case 'lastOrder':
          valA = statsA.lastOrderDate?.toDate?.() || new Date(0);
          valB = statsB.lastOrderDate?.toDate?.() || new Date(0);
          break;

        case 'createdAt':
          valA = a.createdAt?.toDate?.() || new Date(0);
          valB = b.createdAt?.toDate?.() || new Date(0);
          break;

        default:
          return 0;
      }

      if (valA < valB) return userSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return userSortOrder === 'asc' ? 1 : -1;
      return 0;
    });




  // Corrected handleToggleHighlight function (located in AdminPage.jsx)
  // Assuming selectedMainCollectionId and selectedSubcollectionId are managed with useState

  const handleToggleHighlight = async (productId, tagToToggle) => {
    // 🛑 CRITICAL FIX: Use the correct variable name: selectedMainCollectionId 🛑
    if (!productId || !selectedMainCollectionId || !selectedSubcollectionId) {
      console.error("Cannot update highlight: Missing Collection or Product IDs.");
      return;
    }

    // 1. Find the product and determine the new tags array
    const productToUpdate = products.find(p => p.id === productId);
    if (!productToUpdate) return;

    const currentTags = productToUpdate.tags || [];
    let newTags;

    if (currentTags.includes(tagToToggle)) {
      // Tag exists: Remove it (Toggle OFF)
      newTags = currentTags.filter(tag => tag !== tagToToggle);
    } else {
      // Tag doesn't exist: Add it (Toggle ON)
      newTags = [...currentTags, tagToToggle];
    }

    try {
      // 2. Update Firestore using the corrected variable names
      const productRef = doc(
        db,
        'collections',
        selectedMainCollectionId, // ⬅️ CORRECTED NAME
        'subcollections',
        selectedSubcollectionId,
        'products',
        productId
      );

      await updateDoc(productRef, {
        tags: newTags
      });

      // 3. Update local state to immediately refresh the UI
      setProducts(prevProducts => prevProducts.map(p =>
        p.id === productId ? { ...p, tags: newTags } : p
      ));

      console.log(`Product ${productId} toggled highlight: ${tagToToggle}. New tags: ${newTags.join(', ')}`);

    } catch (error) {
      console.error("Error updating product highlight:", error);
      alert("Failed to update product highlight status.");
    }
  };




  // NEW: useEffect to fetch reports data
  useEffect(() => {
    const fetchReports = async () => {
      if (activeTab === 'reports') {
        setIsReportsLoading(true);
        try {
          const ordersRef = collection(db, 'orders');
          const ordersSnapshot = await getDocs(ordersRef);
          const ordersData = ordersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate().toLocaleDateString(),
          }));

          setOrderReports(ordersData);

          const paymentsData = ordersData.map(order => ({
            orderId: order.id,
            totalAmount: order.totalAmount,
            paymentMethod: order.paymentMethod || 'N/A',
            status: order.status,
            date: order.createdAt,
          }));

          setPaymentReports(paymentsData);

          // Fetch all products to generate the product report
          const productsRef = collection(db, 'products');
          const productsSnapshot = await getDocs(productsRef);
          const allProducts = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          const productSales = {};
          ordersData.forEach(order => {
            order.items.forEach(item => {
              if (!productSales[item.productCode]) {
                productSales[item.productCode] = { quantity: 0, revenue: 0 };
              }
              productSales[item.productCode].quantity += item.quantity;
              productSales[item.productCode].revenue += item.quantity * item.price;
            });
          });

          const reports = allProducts.map(product => ({
            productName: product.productName,
            productCode: product.productCode,
            quantityInStock: product.quantity,
            totalSales: productSales[product.productCode]?.quantity || 0,
            totalRevenue: productSales[product.productCode]?.revenue || 0,
          }));

          setProductReports(reports);

        } catch (error) {
          console.error("Error fetching reports:", error);
        }
        setIsReportsLoading(false);
      }
    };
    fetchReports();
  }, [activeTab]);

  const resetProductForm = () => {
    setProductName(''); // Reset new field
    setProductCode('');
    setProductQuantity('');
    setEditingProduct(null);
    setShowProductForm(false);
    setProductDestination("");
    setNewProducts([]);
    setCurrentImageIndex(0);
  };

  // NEW: Filter products based on search term
  const filteredProducts = products.filter(product => {
    const searchTerm = productSearchTerm.toLowerCase();
    const productNameMatch = (product.productName || '').toLowerCase().includes(searchTerm);
    const productCodeMatch = (product.productCode || '').toLowerCase().includes(searchTerm);
    return productNameMatch || productCodeMatch;
  });
  const fetchMainCollectionsForOffline = async () => {
    setIsOfflineProductsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'collections'));
      const fetchedCollections = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMainCollections(fetchedCollections);
    } catch (error) {
      console.error('Error fetching main collections for offline billing:', error);
    }
    setIsOfflineProductsLoading(false);
  };

  // 🔑 IMPORTANT: Use the actual deployed URL you provided
  const FIREBASE_CANCEL_ORDER_URL = "https://us-central1-jewellerywholesale-2e57c.cloudfunctions.net/cancelOrder";

  // Add this function inside your AdminPage component, next to handleUpdateOrderStatus
  const handleCancelOrder = async (orderId) => {
    if (!window.confirm(`Are you sure you want to cancel Order ID: ${orderId}? This action will reverse stock quantities.`)) {
      return;
    }

    // Assuming you have a loading state to prevent double-clicks
    // setIsProcessing(true);

    try {
      const response = await fetch(FIREBASE_CANCEL_ORDER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId: orderId }),
      });

      const result = await response.json();

      if (response.ok) {
  alert(result.message);

  setSelectedOrder(prev =>
    prev
      ? {
          ...prev,
          status: "Cancelled",
        }
      : prev
  );
} else {
        alert(`Cancellation Failed: ${result.error || 'An unknown error occurred.'}`);
      }
    } catch (error) {
      console.error("Error cancelling order:", error);
      alert("Network error. Could not connect to the cancellation service.");
    }
    // finally {
    //    // setIsProcessing(false); 
    // }
  };




  const recalculateOfflineCartPrices = (currentCart) => {
    const newCart = { ...currentCart };
    const pricingGroups = {};

    // Group products in the cart by their unique pricing ID
    for (const productId in newCart) {
      const item = newCart[productId];
      // This is the correct way to get the pricing tiers from the subcollection
      const itemPricingTiers = item.tieredPricing?.[offlinePricingKey];
      const pricingId = JSON.stringify(itemPricingTiers);

      if (!pricingGroups[pricingId]) {
        pricingGroups[pricingId] = [];
      }
      pricingGroups[pricingId].push(item);
    }

    // Recalculate and update the price for each group
    for (const pricingId in pricingGroups) {
      const groupItems = pricingGroups[pricingId];
      const totalGroupQuantity = groupItems.reduce((total, item) => total + item.quantity, 0);
      const tiers = groupItems[0].tieredPricing?.[offlinePricingKey];
      const groupPrice = getPriceForQuantity(tiers, totalGroupQuantity);

      groupItems.forEach(item => {
        newCart[item.id].price = groupPrice;
      });
    }
    return newCart;
  };

  const fetchSubcollectionsForOffline = async (mainCollectionId) => {
    setIsOfflineProductsLoading(true);
    try {
      const subcollectionsRef = collection(db, 'collections', mainCollectionId, 'subcollections');
      const querySnapshot = await getDocs(subcollectionsRef);
      const fetchedSubcollections = [];
      const newSubcollectionsMap = {};

      querySnapshot.docs.forEach(doc => {
        const data = { id: doc.id, ...doc.data() };
        fetchedSubcollections.push(data);
        newSubcollectionsMap[doc.id] = data;
      });

      setOfflineSubcollections(fetchedSubcollections);
      setSubcollectionsMap(newSubcollectionsMap);
    } catch (error) {
      console.error('Error fetching subcollections for offline billing:', error);
    } finally {
      setIsOfflineProductsLoading(false);
    }
  };

  const fetchOfflineProducts = async () => {
    // 🚫 Collection must be selected
    if (!selectedOfflineCollectionId || Object.keys(subcollectionsMap).length === 0) {
      setOfflineProducts([]);
      return;
    }

    setIsOfflineProductsLoading(true);

    try {
      let allProducts = [];

      // ✅ Decide which subcollections to load
      const subcollectionIds = selectedOfflineSubcollectionId
        ? [selectedOfflineSubcollectionId]              // Single subcollection
        : Object.keys(subcollectionsMap);                // ALL subcollections

      // 🔄 Loop through required subcollections
      for (const subId of subcollectionIds) {
        const productsRef = collection(
          db,
          'collections',
          selectedOfflineCollectionId,
          'subcollections',
          subId,
          'products'
        );

        const productsSnap = await getDocs(productsRef);

        productsSnap.forEach(docSnap => {
          allProducts.push({
            id: docSnap.id,
            ...docSnap.data(),

            // 🔑 Attach pricing & hierarchy info
            tieredPricing: subcollectionsMap[subId]?.tieredPricing,
            subcollectionId: subId,
            collectionId: selectedOfflineCollectionId,
          });
        });
      }

      setOfflineProducts(allProducts);
    } catch (error) {
      console.error('Error fetching offline products:', error);
    } finally {
      setIsOfflineProductsLoading(false);
    }
  };

  const handleExportUsers = () => {
    if (!filteredAndSortedUsers.length) return;

    const headers = [
      "Name",
      "Role",
      "Mobile",
      "Address",
      "Last Login",
      "Last Order",
      "Total Orders",
      "Total Amount",
      "Created At",
    ];

    const rows = filteredAndSortedUsers.map((user) => {
      const stats = userOrderStats[user.id] || {};

      return [
        user.name || "",
        user.role || "",
        user.mobile || "",
        user.address || "",
        formatDate(user.lastLogin),
        stats.lastOrderDate ? formatDate(stats.lastOrderDate) : "",
        stats.totalOrders || 0,
        stats.lifetimeValue || 0,
        formatDate(user.createdAt),
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.setAttribute(
      "download",
      `users_export_${new Date().toISOString().slice(0, 10)}.csv`
    );

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  const handleOfflineRemoveFromCart = (cartItemId) => {
    setOfflineCart(prevCart => {
      const newCart = { ...prevCart };
      const newQuantity = (newCart[cartItemId]?.quantity || 0) - 1;
      if (newQuantity <= 0) {
        delete newCart[cartItemId];
      } else {
        newCart[cartItemId].quantity = newQuantity;
      }
      return newCart;
    });
  };

  // NOTE: Assuming you have access to db, doc, getDoc, and getPriceForQuantity helper
  // If this function is in a component, you may need to import those Firestore functions.
  // --- Function to calculate the final price per item and the total ---
  // NOTE: This logic replaces or is integrated into your existing getOfflineCartTotal logic
  const calculatePricedCart = async () => {
    const cartItems = Object.values(offlineCart);
    if (cartItems.length === 0) {
      return { updatedCartMap: {}, total: 0 };
    }

    const subcollectionPricingMap = {};
    const updatedCartMap = { ...offlineCart };

    // ✅ pricing key comes from role-based system
    const pricingTypeKey = offlinePricingKey;

    /* -----------------------------------
       PHASE 1: GROUP ITEMS + FETCH PRICING
    ----------------------------------- */
    for (const item of cartItems) {
      const subcollectionId = item.subcollectionId;
      const collectionId = item.collectionId;
      const quantitySold = Number(item.quantity) || 0;

      if (!subcollectionPricingMap[subcollectionId]) {
        const subcollectionRef = doc(
          db,
          'collections',
          collectionId,
          'subcollections',
          subcollectionId
        );

        const subcollectionDoc = await getDoc(subcollectionRef);

        if (!subcollectionDoc.exists()) {
          console.error(`Subcollection pricing not found: ${subcollectionId}`);
          continue;
        }

        subcollectionPricingMap[subcollectionId] = {
          pricingData: subcollectionDoc.data().tieredPricing || {},
          totalQuantity: 0,
          items: [],
        };
      }

      subcollectionPricingMap[subcollectionId].totalQuantity += quantitySold;
      subcollectionPricingMap[subcollectionId].items.push(item);
    }

    let runningTotal = 0;

    /* -----------------------------------
       PHASE 2: APPLY TIERED PRICING
    ----------------------------------- */
    for (const entry of Object.values(subcollectionPricingMap)) {
      const tiers = entry.pricingData?.[pricingTypeKey];
      const totalGroupQuantity = entry.totalQuantity;

      let finalPricePerUnit = null;

      if (Array.isArray(tiers) && tiers.length > 0) {
        const numericTiers = tiers.map(tier => ({
          min_quantity: Number(tier.min_quantity) || 0,
          max_quantity:
            tier.max_quantity !== undefined && tier.max_quantity !== null
              ? Number(tier.max_quantity)
              : Infinity,
          price: Number(tier.price) || 0,
        }));

        finalPricePerUnit = getPriceForQuantity(
          numericTiers,
          totalGroupQuantity
        );
      }

      // Apply calculated price to each item
      for (const item of entry.items) {
        const effectivePrice =
          typeof finalPricePerUnit === 'number'
            ? finalPricePerUnit
            : Number(item.price) || 0;

        updatedCartMap[item.id] = {
          ...updatedCartMap[item.id],
          calculatedPrice: effectivePrice,
        };

        runningTotal += effectivePrice * (Number(item.quantity) || 0);
      }
    }

    return {
      updatedCartMap,
      total: runningTotal,
    };
  };
  const fetchAllProductsForScan = async () => {
    console.log("📦 Loading ALL products for barcode scan...");

    try {
      const collectionsSnap = await getDocs(
        collection(db, "collections")
      );

      const allProductPromises = [];

      /* ===============================
         FETCH ALL COLLECTION PRODUCTS
      =============================== */
      collectionsSnap.docs.forEach(col => {
        allProductPromises.push(
          getDocs(
            collection(
              db,
              "collections",
              col.id,
              "subcollections"
            )
          ).then(subSnap =>
            Promise.all(
              subSnap.docs.map(sub =>
                getDocs(
                  collection(
                    db,
                    "collections",
                    col.id,
                    "subcollections",
                    sub.id,
                    "products"
                  )
                ).then(prodSnap => ({
                  colId: col.id,
                  subId: sub.id,
                  prodSnap
                }))
              )
            )
          )
        );
      });

      const results = await Promise.all(allProductPromises);

      const map = {};

      /* ===============================
         BUILD SCAN MAP (UPDATED)
      =============================== */
      results.flat(2).forEach(
        ({ colId, subId, prodSnap }) => {
          prodSnap.forEach(docSnap => {

            const data = docSnap.data();

            /* 🔥 KEY CHANGE: LOWERCASE MAP KEY */
            const normalizedId =
              docSnap.id.toLowerCase();

            map[normalizedId] = {
              id: docSnap.id, // original ID
              ...data,
              collectionId: colId,
              subcollectionId: subId,
            };

          });
        }
      );

      console.log(
        "✅ Products loaded:",
        Object.keys(map).length
      );

      setAllProductsMap(map);

      /* ===============================
         CACHE SAVE
      =============================== */
      localStorage.setItem(
        "offlineProductsCache",
        JSON.stringify(map)
      );

    } catch (error) {
      console.error(
        "❌ Error loading products for scan:",
        error
      );
    }
  };

  useEffect(() => {
    if (activeTab !== "offline-billing") return;

    const cached = localStorage.getItem(
      "offlineProductsCache"
    );

    if (cached) {
      console.log("⚡ Loaded products from cache");

      setAllProductsMap(JSON.parse(cached));
    }

    // 🔄 ALWAYS refresh in background
    fetchAllProductsForScan();

  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "offline-billing") return;

    // Already loaded? Skip
    if (Object.keys(allProductsMap).length > 0) return;

    fetchAllProductsForScan();
  }, [activeTab]);
  useEffect(() => {
    if (
      Object.keys(allProductsMap).length > 0 &&
      !isScannerReadyPlayed
    ) {
      console.log("🔊 Scanner Ready");

      playSound(readySound);
      setIsScannerReadyPlayed(true);
    }
  }, [allProductsMap, isScannerReadyPlayed]);


  const handleBarcodeScan = (barcodeValue) => {

    /* ==============================
       🧹 SANITIZE BARCODE INPUT
    ============================== */
    const rawCode = String(barcodeValue);

    const code = rawCode
      .replace(/[\n\r\t]/g, "")     // Remove hidden chars
      .replace(/\s+/g, "")         // Remove spaces
      .replace(/[^a-zA-Z0-9]/g, "")// Remove noise
      .trim();

    const normalizedCode = code.toLowerCase();

    console.log(
      "📦 Barcode scanned:",
      code,
      "Length:",
      code.length
    );

    /* ==============================
       ⏳ PRODUCTS STILL LOADING
    ============================== */
    if (Object.keys(allProductsMap).length === 0) {

      playSound("/sounds/scan-error.mp3");

      alert(
        "⏳ Products are still loading. Please scan again."
      );

      return;
    }

    /* ==============================
       🔎 FIND PRODUCT (UPDATED)
    ============================== */
    const product =
      allProductsMap[code] ||                 // exact
      allProductsMap[normalizedCode];         // lowercase

    /* ==============================
       ❌ PRODUCT NOT FOUND
    ============================== */
    if (!product) {

      playSound("/sounds/scan-error.mp3");

      console.warn(
        "❌ Product not found for barcode:",
        code
      );

      alert(`❌ Product not found:\n${code}`);

      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 50);

      return;
    }

    /* ==============================
       ✅ SUCCESS SOUND
    ============================== */
    playSound("/sounds/scan-success.mp3");

    console.log(
      "✅ Product found:",
      product.productName
    );

    /* ==============================
       🔥 LAST SCANNED POPUP
    ============================== */
    setLastScannedProduct({
      name: product.productName,
      code: product.productCode || product.id,
    });

    setTimeout(() => {
      setLastScannedProduct(null);
    }, 1500);

    /* ==============================
       📂 AUTO-SELECT FILTERS
    ============================== */
    setSelectedOfflineCollectionId(
      product.collectionId
    );

    setSelectedOfflineSubcollectionId(
      product.subcollectionId
    );

    /* ==============================
       🔀 VARIANT HANDLING
    ============================== */
  if (product.variations && product.variations.length > 1) {

  // 🔥 Multiple variants → open selection modal
  setVariantSelectionProduct(product);

} else if (product.variations && product.variations.length === 1) {

  const onlyVariant = product.variations[0];

  if (Number(onlyVariant.quantity) <= 0) {
    playSound("/sounds/scan-error.mp3");
    alert("Variant is out of stock.");
    return;
  }

  handleOfflineAddToCart(product, onlyVariant);

} else {

  // ✅ Simple product
  handleOfflineAddToCart(product, null);
}

// 🔁 Refocus scanner
setTimeout(() => {
  barcodeInputRef.current?.focus();
}, 50);
  };






  useEffect(() => {

    let isMounted = true;
    const updatePricedCart = async () => {
      if (Object.keys(offlineCart).length === 0) {
        if (isMounted) {
          setPricedOfflineCart({});
          setOfflineSubtotal(0);
        }
        return;
      }

      try {
        const { updatedCartMap, total } = await calculatePricedCart();

        if (isMounted) {
          setPricedOfflineCart(updatedCartMap);
          setOfflineSubtotal(total);
        }
      } catch (error) {
        console.error("Error calculating offline cart prices:", error);
      }
    };

    updatePricedCart();

    return () => { isMounted = false; };
    // Re-run whenever the cart contents or the pricing type changes
  }, [offlineCart, offlinePricingKey]);

  useEffect(() => {
    if (activeTab === "offline-billing") {
      barcodeInputRef.current?.focus();
    }
  }, [activeTab]);



  useEffect(() => {
    if (!isScanMode) return;

    const handleKeyPress = (e) => {
      if (activeTab !== "offline-billing") return;

      if (e.key === "Enter") {
        e.preventDefault();

        const code = scannedBarcode
          .replace(/[\n\r\t]/g, "")
          .replace(/\s+/g, "")
          .trim();

        if (!code) return;

        handleBarcodeScan(code);
        setScannedBarcode("");
      }
    };

    window.addEventListener("keydown", handleKeyPress);

    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [scannedBarcode, activeTab, isScanMode]);




  useEffect(() => {
    if (!showCameraScanner) return;

    let html5QrCode;
    let isMounted = true;

    // ⚡ Laser-mode scan control
    let lastScanTime = 0;
    let lastScannedCode = null;

    const SCAN_DELAY = 300; // 🔥 Laser speed (ms)

    const startScanner = async () => {
      try {
        html5QrCode = new Html5Qrcode("camera-scanner");

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 15, // 🔥 Faster frame rate
            qrbox: { width: 300, height: 120 },
            aspectRatio: 1.8,
          },

          // ==============================
          // ⚡ LASER SPEED SCAN
          // ==============================
          (decodedText) => {
            if (!isMounted) return;

            const now = Date.now();

            // 🚫 Prevent duplicate rapid scans
            if (
              decodedText === lastScannedCode &&
              now - lastScanTime < SCAN_DELAY
            ) {
              return;
            }

            lastScanTime = now;
            lastScannedCode = decodedText;

            console.log("⚡ Laser scan:", decodedText);

            // 🔊 Fast beep
            playSound("/sounds/scan-success.mp3");

            // Add to cart
            handleBarcodeScan(decodedText);

            // Stay on billing tab
            setActiveTab("offline-billing");
          },

          (err) => {
            // Ignore scan errors
          }
        );

      } catch (err) {
        console.error("Camera start error:", err);

        alert(
          "Camera failed to start.\n\n" +
          "Allow camera permission & use HTTPS."
        );
      }
    };

    startScanner();

    // ==============================
    // 🧹 CLEANUP
    // ==============================
    return () => {
      isMounted = false;

      if (html5QrCode) {
        html5QrCode
          .stop()
          .then(() => html5QrCode.clear())
          .catch(() => { });
      }
    };
  }, [showCameraScanner]);



  const handleFinalizeSale = async () => {
    if (Object.keys(offlineCart).length === 0) {
      alert('The cart is empty. Please add products to finalize the sale.');
      return;
    }
    const {
      fullName,
      phoneNumber,
      addressLine1,
      city,
      state,
      pincode,
    } = offlineCustomer;

    if (!fullName || !phoneNumber || !addressLine1 || !city || !state || !pincode) {
      alert('Please fill all required customer details.');
      return;
    }


    if (window.confirm('Are you sure you want to finalize this offline sale?')) {
      let isStockError = false;
      const productUpdatesMap = {};

      try {
        // ----------------------------------------------------
        // 🎯 PHASE 1: Aggregate Cart Items and Fetch Product Data
        // ----------------------------------------------------
        console.log(`\n--- STARTING OFFLINE SALE TRANSACTION PREP ---`);

        // 1. Group cart items by their base Product ID and fetch the document once
        for (const item of Object.values(offlineCart)) {
          const baseProductId = item.id.split('_')[0];

          if (!productUpdatesMap[baseProductId]) {
            const productRef = doc(db,
              'collections', item.collectionId,
              'subcollections', item.subcollectionId,
              'products', baseProductId
            );
            const productDoc = await getDoc(productRef);

            if (!productDoc.exists()) {
              throw new Error(`Product not found: ${baseProductId}`);
            }

            productUpdatesMap[baseProductId] = {
              ref: productRef,
              data: productDoc.data(),
              cartItems: [],
              hasError: false,
            };
          }
          productUpdatesMap[baseProductId].cartItems.push(item);
        }

        // 2. Process all cart items for each product to calculate the final stock
        const batch = writeBatch(db);

        for (const baseProductId in productUpdatesMap) {
          const { ref: productRef, data: productData, cartItems } = productUpdatesMap[baseProductId];

          // 🛑 CRITICAL FIX: Only treat as variations if the array exists AND has items.
          let currentVariations = (productData.variations && productData.variations.length > 0)
            ? [...productData.variations]
            : null;
          let currentSimpleQuantity = productData.quantity;

          // Iterate through all cart items that belong to THIS single product
          for (const item of cartItems) {
            const quantitySold = item.quantity;

            console.log(`\nProcessing Item: ${item.productName} (Variation: ${item.variation?.color || 'Simple'}) (Qty: ${quantitySold})`);

            // --- VARIATION LOGIC ---
            if (item.variation && currentVariations) {
              currentVariations = currentVariations.map(v => {
                const isMatch = (v.color === item.variation.color && v.size === item.variation.size);

                if (isMatch) {
                  let currentQuantity = Number(v.quantity) || 0;
                  let newQuantity = currentQuantity - quantitySold;

                  console.log(`  -> Stock BEFORE: ${currentQuantity}`);

                  if (newQuantity < 0) {
                    isStockError = true;
                    productUpdatesMap[baseProductId].hasError = true;
                    console.error(`  ❌ STOCK ERROR: Requested ${quantitySold}, but only ${currentQuantity} available.`);
                    return v;
                  }

                  // Update the variation's quantity in our temporary array
                  return { ...v, quantity: newQuantity };
                }
                return v;
              });

              // --- SIMPLE PRODUCT LOGIC ---
            } else if (!item.variation) {
              currentSimpleQuantity = Number(currentSimpleQuantity) || 0;
              let newQuantity = currentSimpleQuantity - quantitySold;

              console.log(`  -> Type: Simple Product`);
              console.log(`  -> Stock BEFORE: ${currentSimpleQuantity}`);

              if (newQuantity < 0) {
                isStockError = true;
                productUpdatesMap[baseProductId].hasError = true;
                // ✅ FIX (from previous error): Log the correct variable
console.error(
  `❌ STOCK ERROR:
Product: ${item.productName}
Code: ${item.productCode}
Variation: ${item.variation?.size || "Simple"}

Requested: ${quantitySold}
`
);              } else {
                currentSimpleQuantity = newQuantity; // Update the temporary quantity
              }
            }
          }

          // 3. Add ONE FINAL UPDATE to the batch for this base product ID
          if (!productUpdatesMap[baseProductId].hasError) {
            let finalUpdateData = {};
            let finalQtyLog = '';

            // The correct update is determined by the modified variable (currentVariations will be null for simple products now)
            if (currentVariations) {
              finalUpdateData = { variations: currentVariations };
              finalQtyLog = 'Variations Array Updated';
            } else {
              finalUpdateData = { quantity: currentSimpleQuantity };
              finalQtyLog = currentSimpleQuantity;
            }

            batch.update(productRef, finalUpdateData);

            // 🎯 LOG FINAL STOCK
            console.log(`  ✅ FINAL Stock AFTER: ${finalQtyLog}`);
            console.log(`  -> Batch updated for ${baseProductId}.`);
          }
        } // End of productUpdatesMap loop


        // 4. EXECUTE WRITES (Order Save and Stock Update)
        if (isStockError) {
          console.log(`\n--- TRANSACTION ROLLED BACK (Due to Stock Error) ---`);
          throw new Error("STOCK_FAILURE_CLIENT");
        }

        // ... (The rest of the order data construction remains unchanged) ...

        const baseTotal =
          editedTotal !== '' ? Number(editedTotal) : Number(offlineSubtotal);

        const gstValue = isGSTApplied ? baseTotal * GST_RATE : 0;

        const shippingValue = isShippingApplied ? SHIPPING_CHARGE : 0;

       const totalAmountToUse = baseTotal + gstValue + shippingValue;

        // Billing Info (Unchanged)


        const offlineSaleCustomerInfo = {
          fullName: `${offlineCustomer.fullName} (Offline)`,
          email: offlineCustomer.email || '',
          phoneNumber: offlineCustomer.phoneNumber,
          addressLine1: offlineCustomer.addressLine1,
          addressLine2: offlineCustomer.addressLine2 || '',
          city: offlineCustomer.city,
          state: offlineCustomer.state,
          pincode: offlineCustomer.pincode,
          gst: offlineCustomer.gst || '',
        };


        // Order Items (Using correctly calculated price)
        const orderItems = Object.values(pricedOfflineCart).map(item => ({
          productId: item.id.split('_')[0] || 'N/A',
          productName: item.productName || 'N/A',
          productCode: item.productCode || 'N/A',
          quantity: item.quantity || 0,
          priceAtTimeOfOrder: typeof item.calculatedPrice === 'number' ? item.calculatedPrice : Number(item.price) || 0,
          price: typeof item.calculatedPrice === 'number' ? item.calculatedPrice : Number(item.price) || 0,
          image: item.image || '',
          images: item.images || [],
          variation: item.variation || null,
          subcollectionId: item.subcollectionId,
          collectionId: item.collectionId,
        }));


        const orderData = {
          userId: 'offline-sale',
          status: 'Pending',
          createdAt: serverTimestamp(),
          billingInfo: offlineSaleCustomerInfo,
          items: orderItems,
          subtotal: baseTotal,
          gstApplied: isGSTApplied,
          gstRate: GST_RATE,
          gstAmount: gstValue,
          totalAmount: totalAmountToUse,
          shippingFee: shippingValue,
          pricingKey: offlinePricingKey,
          role: ROLE_KEYS.find(
            r => ROLE_CONFIG[r].pricingKey === offlinePricingKey
          ),

        };

        const orderRef = await addDoc(collection(db, 'orders'), orderData);
        console.log(`✅ Order added to Firestore successfully with ID: ${orderRef.id}`);



        await batch.commit();
        console.log('✅ All Stock quantities updated successfully!');
        console.log('------------------------------------------');
        setInvoiceData({
          customer: offlineSaleCustomerInfo,
          items: orderItems,
          subtotal: baseTotal,
          gstRate: GST_RATE,
          shippingFee: shippingValue,
          gstAmount: gstValue,
          total: totalAmountToUse,
          invoiceDate: new Date(),
          invoiceNumber: orderRef.id,
        });

        setShowInvoice(true);



        // 5. Success and Cleanup
        alert('Offline sale finalized and stock updated successfully!');
        setOfflineCart({});

// ✅ REMOVE DRAFT FROM LOCALSTORAGE
localStorage.removeItem("offlineCartDraft");

// Optional: if you later saved full billing draft
localStorage.removeItem("offlineBillingDraft");
        setEditedTotal('');
        setSelectedOfflineCollectionId('');
        setSelectedOfflineSubcollectionId('');
        setOfflineProducts([]);
        setOfflineCustomer({
          fullName: '',
          email: '',
          phoneNumber: '',
          addressLine1: '',
          addressLine2: '',
          city: '',
          state: '',
          pincode: '',
        });


        if (activeTab === 'orders') fetchOrders();
        if (activeSubTab === 'products') fetchProducts(selectedSubcollectionId);

      } catch (error) {
        if (error.message === "STOCK_FAILURE_CLIENT") {
const stockErrorMessages = [];

for (const item of Object.values(offlineCart)) {

  const baseProductId = item.id.split('_')[0];
  const productData = productUpdatesMap[baseProductId];

  if (productData?.hasError) {

    stockErrorMessages.push(
`❌ ${item.productName}
Code: ${item.productCode}
Variation: ${item.variation?.size || "Simple"}

Requested: ${item.quantity}`
    );
  }
}

alert(
  `Insufficient Stock:\n\n${stockErrorMessages.join("\n----------------\n")}`
);        } else {
          console.error('\n--- FINAL ERROR ---');
          console.error('Error finalizing offline sale:', error);
          alert('Failed to finalize the sale. Please check console for details.');
        }
      }
    }
  };

  const handleClearOfflineCart = () => {

  if (!window.confirm("Clear entire offline cart?")) {
    return;
  }

  // Clear React state
  setOfflineCart({});

  // Clear saved draft
  localStorage.removeItem("offlineCartDraft");
  localStorage.removeItem("offlineBillingDraft");

  // Optional extra reset
  setEditedTotal('');

  alert("Offline cart cleared.");
};
  useEffect(() => {
    if (!showInvoice || !invoiceData) return;

    const processInvoicePDF = async () => {
      try {
        // ⏳ wait for DOM paint
        await new Promise(res => setTimeout(res, 500));

        const pdfUrl = await uploadInvoicePDF(invoiceData.invoiceNumber);

        if (!pdfUrl) return;

        // save pdf url to order
        const orderRef = doc(db, "orders", invoiceData.invoiceNumber);
        await updateDoc(orderRef, { invoicePdfUrl: pdfUrl });

        // optional WhatsApp
        if (sendInvoiceOnWhatsApp) {
          const phone = invoiceData.customer.phoneNumber.replace(/\D/g, "");
          const message = encodeURIComponent(
            `Thank you for your purchase.\n\nInvoice PDF:\n${pdfUrl}`
          );
          window.open(`https://wa.me/91${phone}?text=${message}`, "_blank");
        }

      } catch (err) {
        console.error("Invoice PDF generation failed:", err);
      }
    };

    processInvoicePDF();

  }, [showInvoice, invoiceData]);

  useEffect(() => {
    const afterPrint = () => setShowInvoice(false);

    window.addEventListener('afterprint', afterPrint);
    return () => window.removeEventListener('afterprint', afterPrint);
  }, []);

  useEffect(() => {
    if (selectedOfflineCollectionId) {
      fetchSubcollectionsForOffline(selectedOfflineCollectionId);
    } else {
      setOfflineSubcollections([]);
      setSubcollectionsMap({});
    }
  }, [selectedOfflineCollectionId]);

  // This useEffect is critical for updating the products whenever the subcollection changes.
  // It ensures that products are loaded with the correct tiered pricing data.
  useEffect(() => {
    if (selectedOfflineCollectionId) {
      fetchOfflineProducts();
    }
  }, [selectedOfflineCollectionId, selectedOfflineSubcollectionId, subcollectionsMap]);


  const filteredOfflineProducts = offlineProducts.filter(product =>
    product && (
      (product.productName && product.productName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (product.productCode && product.productCode.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  );

  const formatDate = (timestamp) => {
    if (!timestamp) {
      return 'N/A';
    }

    let date;

    // 1. Handle Firebase Timestamp (preferred method for Firestore data)
    if (typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    }
    // 2. Handle standard Date object
    else if (timestamp instanceof Date) {
      date = timestamp;
    }
    // 3. Handle string or number representing a date
    else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      date = new Date(timestamp);
    }

    // 4. Final validation: check if the resulting date object is valid
    if (date && !isNaN(date.getTime())) {
      // Use toLocaleDateString() for a user-friendly, locale-specific format
      return date.toLocaleDateString();
    }

    return 'N/A';
  };

  // Count users by role
  const wholesalerCount = filteredAndSortedUsers.filter(user => user.role === 'wholesaler').length;
  const retailerCount = filteredAndSortedUsers.filter(user => user.role === 'retailer').length;
  const handleMoveOutOfStockToTrash = async () => {
    if (trashRunning) return;

    const confirm = window.confirm(
      "Out-of-stock products / variants will be moved to Trash.\n\nContinue?"
    );
    if (!confirm) return;

    setTrashRunning(true);
    setTrashProgress(0);

    try {
      let trashedProducts = 0;
      let trashedVariants = 0;

      const collectionsSnap = await getDocs(collection(db, "collections"));

      // 🔢 STEP COUNT (for progress)
      let totalProducts = 0;
      for (const col of collectionsSnap.docs) {
        const subSnap = await getDocs(
          collection(db, "collections", col.id, "subcollections")
        );
        for (const sub of subSnap.docs) {
          const productsSnap = await getDocs(
            collection(
              db,
              "collections",
              col.id,
              "subcollections",
              sub.id,
              "products"
            )
          );
          totalProducts += productsSnap.size;
        }
      }

      if (totalProducts === 0) {
        alert("No products found.");
        setTrashRunning(false);
        return;
      }

      let processed = 0;

      for (const col of collectionsSnap.docs) {
        const subSnap = await getDocs(
          collection(db, "collections", col.id, "subcollections")
        );

        for (const sub of subSnap.docs) {
          const productsRef = collection(
            db,
            "collections",
            col.id,
            "subcollections",
            sub.id,
            "products"
          );

          const productsSnap = await getDocs(productsRef);

          for (const prod of productsSnap.docs) {
            const data = prod.data();
            const productRef = doc(
              db,
              "collections",
              col.id,
              "subcollections",
              sub.id,
              "products",
              prod.id
            );

            /* ===== VARIANTS ===== */
            if (Array.isArray(data.variations) && data.variations.length > 0) {
              const activeVariants = [];

              for (const variant of data.variations) {
                if (Number(variant.quantity) <= 0) {
                  await setDoc(
                    doc(
                      db,
                      "trash_variants",
                      `${prod.id}_${variant.sku || variant.name}`
                    ),
                    {
                      productId: prod.id,
                      collectionId: col.id,
                      subcollectionId: sub.id,
                      variant,
                      deletedAt: serverTimestamp(),
                      deletedBy: "admin",
                    }
                  );
                  trashedVariants++;
                } else {
                  activeVariants.push(variant);
                }
              }

              if (activeVariants.length === 0) {
                await setDoc(doc(db, "trash_products", prod.id), {
                  ...data,
                  originalPath: {
                    collectionId: col.id,
                    subcollectionId: sub.id,
                  },
                  deletedAt: serverTimestamp(),
                  deletedBy: "admin",
                });

                await deleteDoc(productRef);
                trashedProducts++;
              } else {
                const totalQty = activeVariants.reduce(
                  (s, v) => s + Number(v.quantity || 0),
                  0
                );

                await updateDoc(productRef, {
                  variations: activeVariants,
                  quantity: totalQty,
                });
              }
            }

            /* ===== SIMPLE PRODUCT ===== */
            else if (Number(data.quantity) <= 0) {
              await setDoc(doc(db, "trash_products", prod.id), {
                ...data,
                originalPath: {
                  collectionId: col.id,
                  subcollectionId: sub.id,
                },
                deletedAt: serverTimestamp(),
                deletedBy: "admin",
              });

              await deleteDoc(productRef);
              trashedProducts++;
            }

            // 📈 PROGRESS UPDATE
            processed++;
            setTrashProgress(
              Math.round((processed / totalProducts) * 100)
            );
          }
        }
      }

      alert(
        `Completed!\n\n🗑 Products: ${trashedProducts}\n🧹 Variants: ${trashedVariants}`
      );
    } catch (err) {
      console.error("Trash cleanup failed:", err);
      alert("Trash operation failed. Check console.");
    } finally {
      setTrashRunning(false);
      setTrashProgress(0);
    }
  };

  const ROLE_PERMISSIONS = {
    superadmin: [
      "collections",
      "orders",
      "lowStock",
      "Storestock",
      "reports",
      "users",
      "offline-billing",
      "leads",
      "coupons",
      "editOrders",
      "barcode",
      "sellerprofit",
      "storeorders",
      "adminsellers",
      "custombill"
    ],

    manager: [
      "orders",
      "reports",
      "leads"

    ],

    sales: [
      "leads",
      "users",
      "offline-billing",

    ],

    inventory: [
      "collections",
      "lowStock"
    ],
  };
  // ✅ ADD IT HERE
  if (roleLoading) {
    return <div>Loading Admin Panel...</div>;
  }
  return (

    <div className="admin-page">

      <h1>Admin Dashboard</h1>
      <div className="admin-tabs">

        {ROLE_PERMISSIONS[currentUserRole]?.includes("collections") && (
          <button
            className={activeTab === "collections" ? "active" : ""}
            onClick={() => setActiveTab("collections")}
          >
            Collections
          </button>
        )}

        {ROLE_PERMISSIONS[currentUserRole]?.includes("orders") && (
          <button
            className={activeTab === "orders" ? "active" : ""}
            onClick={() => setActiveTab("orders")}
          >
            Orders
          </button>
        )}

        {ROLE_PERMISSIONS[currentUserRole]?.includes("lowStock") && (
             <button
            className="admin-menu-item"
            onClick={() => (window.location.href = "/admin/productsale/view")}
          >
            Stock Summary
          </button>
        )}
         {ROLE_PERMISSIONS[currentUserRole]?.includes("Storestock") && (
             <button
            className="admin-menu-item"
            onClick={() => (window.location.href = "/admin/stockcheck")}
          >
            Stock Summary
          </button>
        )}
        {ROLE_PERMISSIONS[currentUserRole]?.includes("reports") && (
          <button
            className="admin-menu-item"
            onClick={() => (window.location.href = "/inventory/stock")}
          >
            Reports
          </button>
        )}

        {ROLE_PERMISSIONS[currentUserRole]?.includes("users") && (
          <button
            className={activeTab === "users" ? "active" : ""}
            onClick={() => setActiveTab("users")}
          >
            User Management
          </button>
        )}

        {ROLE_PERMISSIONS[currentUserRole]?.includes("offline-billing") && (
          <button
            className={`admin-menu-item ${activeTab === "offline-billing" ? "active" : ""}`}
            onClick={() => setActiveTab("offline-billing")}
          >
            Offline Billing
          </button>
        )}

        {ROLE_PERMISSIONS[currentUserRole]?.includes("coupons") && (
          <button
            className="admin-menu-item"
            onClick={() => (window.location.href = "/admin/coupons")}
          >
            Coupons
          </button>
        )}

        {ROLE_PERMISSIONS[currentUserRole]?.includes("editOrders") && (
          <button
            className="admin-menu-item"
            onClick={() => (window.location.href = "/admin/orders/edit")}
          >
            Edit Orders
          </button>
        )}
        {ROLE_PERMISSIONS[currentUserRole]?.includes("leads") && (
          <button
            className="admin-menu-item"
            onClick={() => (window.location.href = "/admin/leads")}
          >
            leads
          </button>
        )}
         {ROLE_PERMISSIONS[currentUserRole]?.includes("barcode") && (
          <button
            className="admin-menu-item"
            onClick={() => (window.location.href = "/admin/barcode-printing")}
          >
            Barcode Print
          </button>
        )}
        
        {ROLE_PERMISSIONS[currentUserRole]?.includes("custombill") && (
          <button
            className="admin-menu-item"
            onClick={() => (window.location.href = "/custombill")}
          >
            Cuustom Bill
          </button>
        )}
         {ROLE_PERMISSIONS[currentUserRole]?.includes("adminsellers") && (
          <button
            className="admin-menu-item"
            onClick={() => (window.location.href = "/admin/sellers")}
          >
            Sellers
          </button>
        )}
          {ROLE_PERMISSIONS[currentUserRole]?.includes("storeorders") && (
          <button
            className="admin-menu-item"
            onClick={() => (window.location.href = "/admin/store-orders")}
          >
            Store Orders
          </button>
        )}
          {ROLE_PERMISSIONS[currentUserRole]?.includes("sellerprofit") && (
          <button
            className="admin-menu-item"
            onClick={() => (window.location.href = "/admin/seller-profits")}
          >
            Seller Profit
          </button>
        )}


      </div>


      <div className="tab-content">
        {/* --- Collections, Subcollections, and Products Tabs --- */}
        {activeTab === 'collections' &&
          ROLE_PERMISSIONS[currentUserRole]?.includes("collections") && (
            <div className="collection-management-container">
              <div className="sub-tabs">
                <button
                  className={activeSubTab === 'collections' ? 'active' : ''}
                  onClick={() => setActiveSubTab('collections')}
                >
                  Collections
                </button>
                <button
                  className={activeSubTab === 'subcollections' ? 'active' : ''}
                  onClick={() => setActiveSubTab('subcollections')}
                >
                  Subcollections
                </button>
                <button
                  className={activeSubTab === 'products' ? 'active' : ''}
                  onClick={() => setActiveSubTab('products')}
                >
                  Products
                </button>
                {/* <button
                  onClick={handleMoveOutOfStockToTrash}
                  disabled={trashRunning}
                  style={{
                    background: trashRunning ? "#9ca3af" : "#f97316",
                    color: "#fff",
                    padding: "10px 16px",
                    borderRadius: "8px",
                    border: "none",
                    fontWeight: "700",
                    cursor: trashRunning ? "not-allowed" : "pointer",
                    marginTop: "12px",
                  }}
                >
                  {trashRunning ? "Moving to Trash…" : "🗑 Move Out-of-Stock to Trash"}
                </button> */}

                {trashRunning && (
                  <div style={{ marginTop: "10px", maxWidth: "420px" }}>
                    <div
                      style={{
                        height: "8px",
                        background: "#e5e7eb",
                        borderRadius: "999px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${trashProgress}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, #f97316, #ef4444)",
                          transition: "width 200ms ease",
                        }}
                      />
                    </div>
                    <div style={{ fontSize: "13px", marginTop: "6px", color: "#555" }}>
                      {trashProgress}% completed
                    </div>
                  </div>
                )}

              </div>

              {/* --- Collections Sub-tab Content --- */}
              {activeSubTab === 'collections' && (
                <div className="forms-container">
                  <div className="admin-section">
                    <h2>Main Collections</h2>
                    <form onSubmit={editingMainCollection ? handleUpdateMainCollection : handleAddMainCollection} className="add-collection-form">
                      <h3>{editingMainCollection ? 'Edit' : 'Add'} Main Collection</h3>
                      <div className="form-group">
                        <label>Name:</label>
                        <input type="text" value={mainCollectionName} onChange={(e) => setMainCollectionName(e.target.value)} placeholder="Main Collection Name" required />
                      </div>
                      <div className="form-group">
                        <label>Image:</label>
                        <input type="file" onChange={(e) => handleImageChange(e, setMainCollectionImageFile)} required={!editingMainCollection} />
                      </div>
                      <div className="form-group">
                        <label>Additional Images:</label>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleMainCollectionAdditionalImagesChange}
                        />
                      </div>

                      <div className="form-group">
                        <label>Show Number:</label>
                        <input type="number" value={mainCollectionShowNumber} onChange={(e) => setMainCollectionShowNumber(e.target.value)} placeholder="Order (e.g., 1, 2)" required />
                      </div>
                      <button type="submit" disabled={isMainCollectionUploading}>
                        {isMainCollectionUploading ? 'Processing...' : editingMainCollection ? 'Update Collection' : 'Add Collection'}
                      </button>
                      {editingMainCollection && (
                        <button type="button" onClick={resetMainCollectionForm} className="cancel-button">
                          Cancel Edit
                        </button>
                      )}
                    </form>
                  </div>

                  <div className="admin-section">
                    <div className="current-collections">
                      <h3>Current Main Collections</h3>
                      {isMainCollectionLoading ? (
                        <p>Loading collections...</p>
                      ) : (
                        <div className="collections-grid">
                          {mainCollections.map((item) => (
                            <CollectionCard key={item.id} title={item.title} image={item.image} showNumber={item.showNumber}>
                              <div className="admin-actions">
                                <button onClick={() => startEditMainCollection(item)}>Edit</button>
                                <button onClick={() => handleDeleteMainCollection(item)}>Delete</button>
                              </div>
                            </CollectionCard>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* --- Subcollections Sub-tab Content --- */}
              {activeSubTab === 'subcollections' && (
                <div className="forms-container">
                  <div className="admin-section">
                    <h2>Subcollections</h2>
                    <div className="form-group">
                      <label>Select Main Collection:</label>
                      <select onChange={(e) => setSelectedMainCollectionId(e.target.value)} value={selectedMainCollectionId}>
                        <option value="">-- Select a Collection --</option>
                        {mainCollections.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedMainCollectionId && (
                      <form onSubmit={editingSubcollection ? handleUpdateSubcollection : handleAddSubcollection} className="add-collection-form">
                        <h3>{editingSubcollection ? 'Edit' : 'Add'} Subcollection</h3>
                        <div className="form-group">
                          <label>Name:</label>
                          <input type="text" value={subcollectionName} onChange={(e) => setSubcollectionName(e.target.value)} placeholder="Subcollection Name" required />
                        </div>
                        <div className="form-group">
                          <label>Code:</label>
                          <textarea value={subcollectionDescription} onChange={(e) => setSubcollectionDescription(e.target.value)} placeholder="Subcollection productcode"></textarea>
                        </div>
                        <div className="form-group">
                          <label>Image:</label>
                          <input type="file" onChange={(e) => handleImageChange(e, setSubcollectionImageFile)} required={!editingSubcollection} />
                        </div>
                        <div className="form-group">
                          <label>Show Number:</label>
                          <input type="number" value={subcollectionShowNumber} onChange={(e) => setSubcollectionShowNumber(e.target.value)} placeholder="Order (e.g., 1, 2)" required />
                        </div>
                        <div className="form-group">
                          <label>Purchase Rate:</label>
                          <input type="number" step="0.01" value={subcollectionPurchaseRate} onChange={(e) => setSubcollectionPurchaseRate(e.target.value)} placeholder="Purchase Rate (e.g., 0.50)" required />
                        </div>
                        <div className="tiered-pricing-container1">
                          {PRICING_KEYS.map(pricingKey => (
                            <div key={pricingKey} className="pricing-section">
                              <h4>{pricingKey.toUpperCase()} Pricing</h4>

                              {(subcollectionTieredPricing[pricingKey] || []).map((tier, index) => (
                                <div key={index} className="price-tier">
                                  <input
                                    type="number"
                                    placeholder="Min Qty"
                                    value={tier.min_quantity}
                                    onChange={(e) =>
                                      handleTierChange(pricingKey, index, 'min_quantity', e.target.value)
                                    }
                                    required
                                  />

                                  <input
                                    type="number"
                                    placeholder="Max Qty"
                                    value={tier.max_quantity}
                                    onChange={(e) =>
                                      handleTierChange(pricingKey, index, 'max_quantity', e.target.value)
                                    }
                                    required
                                  />

                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="Price"
                                    value={tier.price}
                                    onChange={(e) =>
                                      handleTierChange(pricingKey, index, 'price', e.target.value)
                                    }
                                    required
                                  />

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTier(pricingKey, index)}
                                    className="remove-tier-button"
                                  >
                                    &times;
                                  </button>
                                </div>
                              ))}

                              <button
                                type="button"
                                onClick={() => handleAddTier(pricingKey)}
                                className="add-tier-button"
                              >
                                Add {pricingKey} Tier
                              </button>
                            </div>
                          ))}
                        </div>

                        <button type="submit" disabled={isSubcollectionUploading}>
                          {isSubcollectionUploading ? 'Processing...' : editingSubcollection ? 'Update Subcollection' : 'Add Subcollection'}
                        </button>
                        {editingSubcollection && (
                          <button type="button" onClick={resetSubcollectionForm} className="cancel-button">
                            Cancel Edit
                          </button>
                        )}
                      </form>
                    )}
                  </div>

                  <div className="admin-section">
                    <h3>Current Subcollections</h3>
                    {selectedMainCollectionId ? (
                      isSubcollectionLoading ? (
                        <p>Loading subcollections...</p>
                      ) : (
                        <div className="collections-grid">
                          {subcollections.map((item) => (
                            <CollectionCard key={item.id} title={item.name} description={item.description} image={item.image} tieredPricing={item.tieredPricing}>
                              <div className="admin-actions">
                                <button onClick={() => startEditSubcollection(item)}>Edit</button>
                                <button onClick={() => handleDeleteSubcollection(item.id, item.image)}>Delete</button>
                              </div>
                            </CollectionCard>
                          ))}
                        </div>
                      )
                    ) : (
                      <p className="select-prompt">Please select a main collection to view its subcollections.</p>
                    )}
                  </div>
                </div>
              )}

              {/* --- Products Sub-tab Content --- */}
              {activeSubTab === 'products' && (
                <div className="forms-container">
                  <div className="admin-section">
                    <h2>Products</h2>
                    <div className="form-group">
                      <label>Select Main Collection:</label>
                      <select onChange={(e) => setSelectedMainCollectionId(e.target.value)} value={selectedMainCollectionId}>
                        <option value="">-- Select a Collection --</option>
                        {mainCollections.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Select Subcollection:</label>
                      <select onChange={(e) => setSelectedSubcollectionId(e.target.value)} value={selectedSubcollectionId}>
                        <option value="">-- Select a Subcollection --</option>
                        {subcollections.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>


                    {selectedSubcollectionId && (
                      <div className="add-collection-form">

                        <h3>Add/Edit Products</h3>

                        {isCropping ? (
                          // This block shows the cropper
                          <div className="cropper-container">
                            <ReactCrop
                              crop={crop}
                              onChange={c => setCrop(c)}
                              onComplete={c => setCompletedCrop(c)}
                            >
                              <img src={imageToCrop} ref={imgRef} alt="Product" />
                            </ReactCrop>
                            <div className="cropper-buttons">
                              <button type="button" onClick={getCroppedImage}>Crop Image</button>
                              <button type="button" onClick={() => setIsCropping(false)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          // This block shows either the product form or the file input
                          <>
                            {showProductForm ? (
                              <form onSubmit={editingProduct ? handleUpdateProduct : (currentImageIndex < newProducts.length ? handleNextProduct : handleAddAllProducts)} className="bulk-upload-form">
                                {editingProduct ? (
                                  <>
                                    <div className="product-form-item">
                                      <img src={editingProduct.image} alt="Product Preview" className="product-preview-image" />
                                      <button type="button" onClick={() => startCropping(editingProduct.image)} className="crop-button">
                                        <span role="img" aria-label="crop icon">✂️</span> Crop
                                      </button>
                                      <div className="product-details-inputs">
                                        <div className="form-group">
                                          <label>Product Name:</label>
                                          <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} required />
                                        </div>
                                        <div className="form-group">
                                          <label>Product Code:</label>
                                          <input type="text" value={productCode} onChange={(e) => setProductCode(e.target.value)} required />
                                        </div>

                                        {/* Conditional Rendering: Show Quantity OR Variations (FIXED) */}
                                        {productVariations.length === 0 ? (
                                          // Show the single Quantity input if no variations are added
                                          <div className="form-group">
                                            <label>Quantity:</label>
                                            <input type="number" value={productQuantity} onChange={(e) => setProductQuantity(e.target.value)} onWheel={(e) => e.preventDefault()} required />
                                          </div>
                                        ) : (
                                          // Show the variations list if variations are present
                                          <div className="variation-input-container">
                                            <h4>Current Variations</h4>
                                            <ul className="variations-list">
                                              {productVariations.map((v, index) => (
                                                <li key={index} className="variation-item">
                                                  <span>{v.color}, {v.size}, Qty: {v.quantity}</span>
                                                  <button type="button" onClick={() => handleRemoveVariation(index)} className="remove-variation-btn">
                                                    &times;
                                                  </button>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}

                                        {/* NEW: Always show the variation input fields for adding more variations (same as bulk upload) */}
                                        <div className="variation-input">
                                          <input
                                            type="text"
                                            name="color"
                                            value={newVariation.color}
                                            onChange={handleNewVariationChange}
                                            placeholder="Color (e.g., Red)"
                                          />
                                          <input
                                            type="text"
                                            name="size"
                                            value={newVariation.size}
                                            onChange={handleNewVariationChange}
                                            placeholder="Size (e.g., L)"
                                          />
                                          <input
                                            type="number"
                                            name="quantity"
                                            value={newVariation.quantity}
                                            onChange={handleNewVariationChange}
                                            placeholder="Quantity"
                                          />
                                          <button type="button" onClick={handleAddVariation} className="add-variation-btn">
                                            Add Variation
                                          </button>
                                        </div>

                                        {/* The Upload Additional Product Photos section remains here */}
                                        <div className="form-group">
                                          <label>Upload Additional Product Photos:</label>
                                          <input
                                            type="file"
                                            onChange={handleAdditionalImageChange}
                                            multiple
                                            accept="image/*"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  // ... bulk upload JSX remains here
                                  <>
                                    {newProducts.length > 0 && currentImageIndex < newProducts.length ? (
                                      <>
                                        <div className="product-form-item">
                                          <img src={newProducts[currentImageIndex].previewUrl} alt="Product Preview" className="product-preview-image" />
                                          <button type="button" onClick={() => startCropping(newProducts[currentImageIndex].previewUrl)} className="crop-button">
                                            <span role="img" aria-label="crop icon">✂️</span> Crop
                                          </button>
                                          <button type="button" onClick={() => handleDeleteNewImage(currentImageIndex)} className="delete-button">
                                            <span role="img" aria-label="delete icon">🗑️</span> Delete
                                          </button>
                                          <div className="product-details-inputs">
                                            {/* Product Name and Code remain here */}
                                            <div className="form-group">
                                              <label>Product Name:</label>
                                              <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} required />
                                            </div>
                                            <div className="form-group">
                                              <label>Product Code:</label>
                                              <input type="text" value={productCode} onChange={(e) => setProductCode(e.target.value)} required />
                                            </div>

                                            {/* Conditional Rendering: Show Quantity OR Variations */}
                                            {productVariations.length === 0 ? (
                                              // Show the single Quantity input if no variations are added
                                              <div className="form-group">
                                                <label>Quantity:</label>
                                                <input type="number" value={productQuantity} onChange={(e) => setProductQuantity(e.target.value)} required />
                                              </div>
                                            ) : (
                                              // Show the variations list if variations are present
                                              <div className="variation-input-container">
                                                <h4>Add More Variations</h4>
                                                <ul className="variations-list">
                                                  {productVariations.map((v, index) => (
                                                    <li key={index} className="variation-item">
                                                      <span>{v.color}, {v.size}, Qty: {v.quantity}</span>
                                                      <button type="button" onClick={() => handleRemoveVariation(index)} className="remove-variation-btn">
                                                        &times;
                                                      </button>
                                                    </li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}

                                            {/* NEW: Always show the variation input fields regardless of whether variations exist or not */}
                                            <div className="variation-input">
                                              <input
                                                type="text"
                                                name="color"
                                                value={newVariation.color}
                                                onChange={handleNewVariationChange}
                                                placeholder="Color (e.g., Red)"
                                              />
                                              <input
                                                type="text"
                                                name="size"
                                                value={newVariation.size}
                                                onChange={handleNewVariationChange}
                                                placeholder="Size (e.g., L)"
                                              />
                                              <input
                                                type="number"
                                                name="quantity"
                                                value={newVariation.quantity}
                                                onChange={handleNewVariationChange}
                                                placeholder="Quantity"
                                              />
                                              <button type="button" onClick={handleAddVariation} className="add-variation-btn">
                                                Add Variation
                                              </button>
                                            </div>

                                            {/* The Upload Additional Product Photos section remains here */}
                                            <div className="form-group">
                                              <label>Upload Additional Product Photos:</label>
                                              <input
                                                type="file"
                                                onChange={handleAdditionalImageChange}
                                                multiple
                                                accept="image/*"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                        <div className="file-info">
                                          Image {currentImageIndex + 1} of {newProducts.length}
                                        </div>

                                      </>
                                    ) : (
                                      <p>All product details filled. Click 'Add All Products' to save.</p>
                                    )}
                                  </>
                                )}
                               <div
  style={{
    marginTop: "20px",
    marginBottom: "20px",
  }}
>
  <label
    style={{
      display: "block",
      fontWeight: "bold",
      marginBottom: "10px",
    }}
  >
    Upload Product To <span style={{ color: "red" }}>*</span>
  </label>

  <div
    style={{
      display: "flex",
      gap: "25px",
      alignItems: "center",
    }}
  >
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        cursor: "pointer",
      }}
    >
      <input
        type="radio"
        name="productDestination"
        value="products"
        checked={productDestination === "products"}
        onChange={(e) => setProductDestination(e.target.value)}
      />
      🌐 Website
    </label>

    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        cursor: "pointer",
      }}
    >
      <input
        type="radio"
        name="productDestination"
        value="appProducts"
        checked={productDestination === "appProducts"}
        onChange={(e) => setProductDestination(e.target.value)}
      />
      📱 Mobile App
    </label>
  </div>
</div>
                                <button type="submit" disabled={isProductUploading} className="submit-all-button">
                                  {isProductUploading ? 'Uploading...' : editingProduct ? 'Update Product' : currentImageIndex < newProducts.length - 1 ? 'Next' : 'Add All Products'}
                                </button>
                                <button type="button" onClick={resetProductForm} className="cancel-button">
                                  Cancel
                                </button>
                              </form>
                            ) : (
                              <div className="form-group">
                                <label>Upload Product Photos:</label>
                                <input type="file" onChange={handleProductImageChange} multiple />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="admin-section">
                    <h3>Current Products</h3>
                    {selectedSubcollectionId ? (
                      isProductLoading ? (
                        <p>Loading products...</p>
                      ) : (
                        <>
                          <div className="search-container">
                            <input
                              type="text"
                              placeholder="Search by name or code..."
                              value={productSearchTerm}
                              onChange={(e) => setProductSearchTerm(e.target.value)}
                              className="search-input"
                            />
                          </div>
                          <div className="collections-grid">
                            {filteredProducts.length > 0 ? (
                              filteredProducts.map((product) => (
                                <ProductCard
                                  key={product.id}
                                  product={product} // This passes the entire product object
                                  onEdit={() => startEditProduct(product)}
                                  onDelete={() => handleDeleteProduct(product)}

                                  // 🔥 NEW PROP ADDED 🔥
                                  onToggleHighlight={handleToggleHighlight}
                                />
                              ))
                            ) : (
                              <p>No products found matching your search criteria.</p>
                            )}
                          </div>
                        </>
                      )
                    ) : (
                      <p className="select-prompt">Please select a main collection and a subcollection to view its products.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        {/* --- Order Management Section --- */}
        {activeTab === 'orders' &&
          ROLE_PERMISSIONS[currentUserRole]?.includes("orders") && (
            <div className="admin-section">
              <h2>Customer Orders</h2>

              {/* Search and Filter Bar */}
              <div className="order-filters">
                <input
                  type="text"
                  placeholder="Search by ID, name, email, or phone"
                  value={orderSearchTerm}
                  onChange={(e) => setOrderSearchTerm(e.target.value)}
                  className="search-input"
                />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  title="Start Date"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  title="End Date"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="status-select"
                >
                <option value="All">All Statuses</option>
<option value="Pending">Pending</option>
<option value="Paymentdone">Payment Done</option>
<option value="Packed">Packed</option>
<option value="Dispatched">Dispatched</option>
<option value="Delivered">Delivered</option>
<option value="Cancelled">Cancelled</option>

                </select>

              </div>

              {isOrderLoading ? (
                <p>Loading orders...</p>
              ) : filteredOrders.length === 0 ? (
                <p>No orders found with the current filters.</p>
              ) : (
                // Now we map over the sortedDateKeys
                sortedDateKeys.length > 0 ? (
                  sortedDateKeys.map(dateKey => (
                    <div key={dateKey} className="order-date-group">
                      <h3>{dateKey}</h3>
                      <ul className="orders-list">
                        {
                          // 👇 FIX: Use optional chaining and nullish coalescing
                          groupedOrdersFromFiltered[dateKey]?.map((order) => (
                            <li
                              key={order.id}
                              onClick={() => setSelectedOrder(order)}
                              className="order-list-item"
                            >
                              <p>Order ID: <strong>{order.id.substring(0, 8)}...</strong></p>
                              <p>Contact: <strong>{order.billingInfo?.phoneNumber || ''}</strong></p>
                              <p>Name: <strong>{order.billingInfo?.fullName || ''}</strong></p>

                              <p>Total: <strong>₹{order.totalAmount.toFixed(2)}</strong></p>
                              <p>Status: <span className={`order-status status-${order.status ? order.status.toLowerCase() : 'pending'}`}>{order.status}</span></p>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))
                ) : (
                  <p>No orders found with the current filters.</p>
                )
              )}
            </div>
          )}

        {/* Render Order Details Modal */}
        {selectedOrder && (
          <OrderDetailsModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
            onUpdateStatus={handleUpdateOrderStatus}
            onCancelOrder={handleCancelOrder}
          />
        )}
        {/* --- Low Stock Tab --- */}
        {activeTab === 'lowStock' && (
          <div className="admin-section">
            <h2>Low Stock Alerts</h2>
            <div className="low-stock-header">
              <p>The following products have a quantity less than or equal to {LOW_STOCK_THRESHOLD}.</p>
              <button onClick={handleDownloadLowStockImages} disabled={isDownloading || lowStockProducts.length === 0} className="download-all-btn">
                {isDownloading ? 'Downloading...' : 'Download All Images'}
              </button>
            </div>
            {isLowStockLoading ? (
              <p>Scanning for low stock products...</p>
            ) : lowStockProducts.length === 0 ? (
              <p>No products are currently low in stock.</p>
            ) : (
              <div className="collections-grid">
                {lowStockProducts.map((product) => (
                  <ProductCard key={product.id} productName={product.productName} productCode={product.productCode} quantity={product.quantity} image={product.image} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="admin-section">
            <h2>Financial Reports</h2>
            {isReportsLoading ? (
              <p>Loading reports...</p>
            ) : (
              <div className="reports-container">

                <div className="report-table-container">
                  <h3>Order Report</h3>
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Date</th>
                        <th>Total Amount</th>
                        <th>Status</th>
                        <th>Customer Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderReports.length > 0 ? (
                        orderReports.map(report => (
                          <tr key={report.id}>
                            <td>{report.id.substring(0, 8)}...</td>
                            <td>{report.createdAt}</td>
                            <td>₹{report.totalAmount?.toFixed(2) || '0.00'}</td>
                            <td><span className={`order-status status-${report.status?.toLowerCase() || 'unknown'}`}>{report.status || 'N/A'}</span></td>
                            <td>{report.userEmail || 'N/A'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5">No order data found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="report-table-container">
                  <h3>Payment Report</h3>
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Date</th>
                        <th>Total Amount</th>
                        <th>Payment Method</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentReports.length > 0 ? (
                        paymentReports.map((report, index) => (
                          <tr key={index}>
                            <td>{report.orderId.substring(0, 8)}...</td>
                            <td>{report.date}</td>
                            <td>₹{report.totalAmount?.toFixed(2) || '0.00'}</td>
                            <td>{report.paymentMethod}</td>
                            <td><span className={`order-status status-${report.status?.toLowerCase() || 'unknown'}`}>{report.status || 'N/A'}</span></td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5">No payment data found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="report-table-container">
                  <h3>Product Report</h3>
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Product Code</th>
                        <th>Product Name</th>
                        <th>Quantity in Stock</th>
                        <th>Total Sales</th>
                        <th>Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productReports.length > 0 ? (
                        productReports.map((report, index) => (
                          <tr key={index}>
                            <td>{report.productCode}</td>
                            <td>{report.productName}</td>
                            <td>{report.quantityInStock}</td>
                            <td>{report.totalSales}</td>
                            <td>₹{report.totalRevenue.toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5">No product data found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
        {/* --- User Management Tab --- */}

        {activeTab === 'users' &&
          ROLE_PERMISSIONS[currentUserRole]?.includes("users") && (
            <section className="saas-users-section">
              <h2 className="saas-users-title">User Management</h2>

              {/* ROLE COUNTS */}
              <div className="saas-users-role-metrics">
                <span className="saas-users-metric saas-users-metric--wholesaler">
                  🏷️ Wholesalers: {wholesalerCount}
                </span>
                <span className="saas-users-metric saas-users-metric--retailer">
                  🛍️ Retailers: {retailerCount}
                </span>
              </div>

              {/* SEARCH */}
              <div className="saas-users-search-bar">
                <select
                  value={userSearchColumn}
                  onChange={(e) => setUserSearchColumn(e.target.value)}
                  className="saas-users-search-select"
                >
                  <option value="name">Name</option>
                  <option value="lastLogin">Last Login</option>
                  <option value="mobile">Mobile</option>
                  <option value="address">Address</option>
                  <option value="lastOrder">Last Order</option>
                  <option value="orders">Total Orders</option>
                  <option value="amount">Total Amount</option>
                  <option value="profit">Net Profit</option>
                  <option value="createdAt">Created At</option>
                  <option value="role">Role</option>
                </select>

                <input
                  type="text"
                  value={userSearchValue}
                  placeholder={`Search by ${userSearchColumn}`}
                  onChange={(e) => setUserSearchValue(e.target.value)}
                  className="saas-users-search-input"
                />
              </div>

              {/* SORT */}
              <div className="saas-users-sort-bar">
                <select
                  value={userSortField}
                  onChange={(e) => setUserSortField(e.target.value)}
                  className="saas-users-sort-select"
                >
                  <option value="createdAt">Created At</option>
                  <option value="lastLogin">Last Login</option>
                  <option value="lastOrder">Last Order</option>
                  <option value="orders">Total Orders</option>
                  <option value="amount">Total Amount</option>
                  <option value="profit">Net Profit</option>
                  <option value="name">Name</option>
                </select>

                <button
                  className="saas-users-sort-toggle"
                  onClick={() =>
                    setUserSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                  }
                >
                  {userSortOrder === 'asc' ? '⬆ Ascending' : '⬇ Descending'}
                </button>
                <div className="saas-users-export-bar">
                  <button
                    className="saas-btn saas-btn--secondary"
                    onClick={handleExportUsers}
                    disabled={filteredAndSortedUsers.length === 0}
                  >
                    ⬇ Export Users
                  </button>
                </div>

              </div>

              {/* CONTENT */}
              {isUserLoading ? (
                <p className="saas-users-loading">Loading users…</p>
              ) : filteredAndSortedUsers.length === 0 ? (
                <p className="saas-users-empty">No users found.</p>
              ) : (
                <div className="saas-users-table-wrapper">

                  {/* HEADER */}
                  <div className="saas-users-table-header">
                    <div>Name</div>
                    <div>Last Login</div>
                    <div>Mobile</div>
                    <div>Address</div>
                    <div>Last Order</div>
                    <div>Orders</div>
                    <div>Total Amount</div>
                    <div>Created</div>
                    <div>Role</div>
                    <div>Actions</div>
                  </div>

                  {/* ROWS */}
                  <ul className="saas-users-table-body">
                    {filteredAndSortedUsers.map((user) => {
                      const stats = userOrderStats[user.id] || {};

                      return (
                        <li
                          key={user.id}
                          className="saas-users-row"
                          onClick={() =>
                            navigate(`/admin/users/${user.id}/orders`)
                          }
                        >
                          <div className="saas-users-cell saas-users-name">
                            {user.name || 'N/A'}
                          </div>

                          <div className="saas-users-cell saas-users-muted">
                            {formatDate(user.lastLogin)}
                          </div>

                          <div className="saas-users-cell saas-users-muted">
                            {user.mobile || '—'}
                          </div>

                          <div className="saas-users-cell saas-users-truncate">
                            {user.address || '—'}
                          </div>

                          <div className="saas-users-cell saas-users-muted">
                            {stats.lastOrderDate
                              ? formatDate(stats.lastOrderDate)
                              : '—'}
                          </div>

                          <div className="saas-users-cell saas-users-center">
                            {stats.totalOrders || 0}
                          </div>

                          <div className="saas-users-cell saas-users-amount">
                            ₹{(stats.lifetimeValue || 0).toLocaleString('en-IN')}
                          </div>



                          <div className="saas-users-cell saas-users-muted">
                            {formatDate(user.createdAt)}
                          </div>

                          <div className="saas-users-cell">
                            <span className={`saas-role saas-role--${user.role}`}>
                              {user.role}
                            </span>
                          </div>

                          <div
                            className="saas-users-cell saas-users-actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* ROLE SELECT (CONFIG DRIVEN) */}
                            <select
                              value={user.role}
                              onChange={(e) =>
                                handleUpdateUserRole(user.id, e.target.value)
                              }
                              className="saas-users-role-select"
                            >
                              {ROLE_KEYS.map(role => (
                                <option key={role} value={role}>
                                  {ROLE_CONFIG[role].label}
                                </option>
                              ))}
                            </select>

                            {/* DELETE USER */}
                            <button
                              className="saas-btn saas-btn--danger"
                              onClick={() => handleDeleteUser(user.id)}
                            >
                              Delete
                            </button>
                          </div>

                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>
          )}



        {activeTab === 'offline-billing' &&
          ROLE_PERMISSIONS[currentUserRole]?.includes("offline-billing") && (
            <div className="offline-billing-section">
              <h2>Offline Billing</h2>

              {/* 🔑 HIDDEN BARCODE INPUT (USB / Bluetooth Scanner) */}
              <input
                ref={barcodeInputRef}
                type="text"
                value={scannedBarcode}
                onChange={(e) => setScannedBarcode(e.target.value)}
                autoFocus={isScanMode}
                style={{
                  position: "absolute",
                  opacity: isScanMode ? 1 : 0,
                  pointerEvents: "none",
                  height: 0,
                }}
              />


              <div className="billing-container">
                <div className="product-selection-panel">
                  <h4>Select Products</h4>
                  <div className="dropdown-group">
                    <select
                      className="billing-select"
                      value={offlinePricingKey}
                      onChange={(e) => setOfflinePricingKey(e.target.value)}
                    >
                      {ROLE_KEYS.map(role => (
                        <option
                          key={role}
                          value={ROLE_CONFIG[role].pricingKey}
                        >
                          {ROLE_CONFIG[role].label} Pricing
                        </option>
                      ))}
                    </select>

                    <select
                      className="billing-select"
                      value={selectedOfflineCollectionId}
                      onChange={(e) => setSelectedOfflineCollectionId(e.target.value)}
                    >
                      <option value="">Select Collection</option>
                      {mainCollections.map((collection) => (
                        <option key={collection.id} value={collection.id}>
                          {collection.title}
                        </option>
                      ))}
                    </select>
                    <select
                      className="billing-select"
                      value={selectedOfflineSubcollectionId}
                      onChange={(e) => setSelectedOfflineSubcollectionId(e.target.value)}
                      disabled={!selectedOfflineCollectionId}
                    >
                      <option value="">All Subcollection</option>
                      {offlineSubcollections.map((subcollection) => (
                        <option key={subcollection.id} value={subcollection.id}>
                          {subcollection.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Search Input */}
                  <input
                    type="text"
                    placeholder="Search products by name or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="product-search-bar"
                  />
                  {/* 📷 CAMERA SCAN BUTTON */}
                  <button
                    className="scan-camera-btn"
                    onClick={() => setShowCameraScanner(true)}
                    style={{
                      marginBottom: "12px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #ccc",
                      cursor: "pointer",
                    }}
                  >
                    📷 Scan with Camera
                  </button>
                  <button
                    className="scan-mode-btn"
                    onClick={() => {
                      setIsScanMode(true);

                      setTimeout(() => {
                        barcodeInputRef.current?.focus();
                      }, 50);
                    }}
                  >
                    🔫 Start Scanner
                  </button>

                  <button
                    className="scan-mode-btn stop"
                    onClick={() => setIsScanMode(false)}
                  >
                    ✋ Stop Scanner
                  </button>

                  <button
                    onClick={() => {
                      localStorage.removeItem(
                        "offlineProductsCache"
                      );

                      fetchAllProductsForScan();
                    }}
                  >
                    🔄 Refresh Products
                  </button>


                  {Object.keys(allProductsMap).length === 0 && (
                    <p style={{ fontSize: 12, color: "#888", marginBottom: "8px" }}>
                      ⏳ Loading barcode data…
                    </p>
                  )}


                  {isOfflineProductsLoading ? (
                    <p className="loading-message">Loading products...</p>
                  ) : filteredOfflineProducts.length > 0 ? (
                    <div className="billing-product-list">
                      {filteredOfflineProducts.map(product => {
                        // --- STOCK/VARIATION LOGIC SETUP (Requires offlineSelections state) ---
                        // 1. Get the current selection (or default to the first variant)
                        const currentSelection = offlineSelections[product.id] ||
                          (product.variations && product.variations.length > 0 ? product.variations[0] : null);

                        // 2. Get the stock for the currently selected item/variant
                        const availableStock = currentSelection ? Number(currentSelection.quantity) : Number(product.quantity || 0);

                        // 3. Calculate quantity in cart for this specific variant
                        // NOTE: getCartItemId must be available in this component's scope (imported from CartContext)
                        const cartItemId = getCartItemId({ ...product, variation: currentSelection });
                        const currentQuantityInCart = offlineCart[cartItemId]?.quantity || 0;

                        // 4. Check for stock limit
                        const isMaxStockReached = currentQuantityInCart >= availableStock;

                        const imagesToDisplay = product.images && product.images.length > 0 ? product.images : (product.image ? [product.image] : []);
                        const currentImage = imagesToDisplay.length > 0 ? (imagesToDisplay[0].url || imagesToDisplay[0].url || imagesToDisplay[0]) : '';
                        // ----------------------------------------------------------------------

                        return (
                          <div
                            key={product.id}
                            className={`billing-product-item ${isMaxStockReached ? 'stock-limit' : ''}`}
                          >
                            {/* Product Details */}
                            <img
                              alt={product.productName}
                              src={currentImage}
                              className="product-image"
                              // 🛑 ADDED: onClick handler to open the full image modal 🛑
                              onClick={() => openImageModal(currentImage)}
                              style={{ cursor: 'pointer' }} // Visual hint that it's clickable
                            />
                            <div className="product-details">
                              <span className="product-name">{product.productName}</span>
                              <span className="product-code">{product.productCode}</span>

                              {/* Variation Selector */}
                              {product.variations && product.variations.length > 1 && (
                                <select
                                  className="billing-variation-select"
                                  value={JSON.stringify(currentSelection || {})}
                                  onChange={(e) => {
                                    try {
                                      const parsed = JSON.parse(e.target.value);
                                      handleOfflineSelectionChange(product.id, parsed);
                                    } catch (err) {
                                      console.error("❌ Variant parse error:", err);
                                    }
                                  }}
                                >

                                  {product.variations.map((v, index) => (
                                    <option
                                      key={index}
                                      value={JSON.stringify(v)}
                                      disabled={Number(v.quantity) <= 0}
                                    >
                                      {v.color} {v.size} (Stock: {v.quantity})
                                    </option>
                                  ))}
                                </select>
                              )}

                             <span
  style={{
    display: "block",
    color: "red",
    fontWeight: "bold",
    fontSize: "16px"
  }}
>
  In Stock: {availableStock}
</span>
                            </div>

                            {/* Add to Cart Control */}
                            <div className="product-actions-offline">
                               
                              <span className="cart-item-quantity">In Cart: {currentQuantityInCart}</span>
                              <button
                                // Pass the product and the currently selected variation to the handler
                                onClick={() => handleOfflineAddToCart(product, currentSelection)}
                                className={`add-to-cart-btn ${isMaxStockReached ? 'disabled' : ''}`}
                                disabled={isMaxStockReached}
                              >
                                {isMaxStockReached ? (availableStock === 0 ? 'Out of Stock' : 'Max Stock Reached') : 'Add 1'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="no-products-found">
                      {selectedOfflineSubcollectionId
                        ? 'No products found for your search.'
                        : 'Please select a collection and subcollection to view products.'}
                    </p>
                  )}
                </div>

                <div className="billing-cart-panel">
                  <h4>Billing Cart</h4>
                  {Object.keys(offlineCart).length > 0 ? (
                    <>
                      <ul className="cart-list">
                        {/* CRITICAL: Iterate over pricedOfflineCart, not offlineCart */}
                        {Object.values(pricedOfflineCart).map((item) => {
                          // Calculate the final unit price and line total for display
                          const unitPrice = typeof item.calculatedPrice === 'number'
                            ? item.calculatedPrice
                            : (item.price !== undefined && item.price !== null ? parseFloat(item.price) : 0);
                          const lineTotal = unitPrice * item.quantity;

                          return (
                            <li key={item.id} className="cart-item">
                              <div className="cart-item-details">
                                <span className="cart-item-name">{item.productName}</span>
                                <span className="cart-item-code">{item.productCode}</span>
                                {/* Display Variation */}
                                {item.variation && (item.variation.color || item.variation.size) && (
                                  <span className="cart-item-info variation-detail">
                                    {item.variation.color} {item.variation.size}
                                  </span>
                                )}

                                {/* UPDATED: Display calculated unit price */}
                                <span className="cart-item-info unit-price">
                                  ₹{unitPrice.toFixed(2)} / unit
                                </span>
                              </div>
                              <div className="cart-item-controls">
                                {/* NEW: Display line total */}
                                <span className="cart-item-info line-total">
                                  <strong className="line-total-amount">₹{lineTotal.toFixed(2)}</strong>
                                </span>

                                <button onClick={() => handleOfflineRemoveFromCart(item.id)} className="quantity-btn">-</button>
                                <span className="cart-quantity">{item.quantity}</span>
                                <button
                                  onClick={() => handleOfflineAddToCart(item, item.variation)}
                                  className="quantity-btn"
                                  disabled={item.quantity >= (item.availableStock || Infinity)}
                                >
                                  +
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>

                      {/* NEW: Editable Total Input */}
                      <div className="cart-total-info">
                        {/* FIX: Removed the extra ₹ symbol (₹₹ -> ₹) */}
                        <p className="calculated-total">
                          Calculated Total: ₹{finalTotal.toFixed(2)}
                        </p>
                        <label htmlFor="edited-total-input">Final Total:</label>
                        <input
                          id="edited-total-input"
                          type="number"
                          value={editedTotal}
                          onChange={(e) => setEditedTotal(e.target.value)}
                          placeholder="Enter final total"
                          className="editable-total-input"
                        />
                      </div>
                      <div className="gst-section">
                        <label className="gst-checkbox">
                          <input
                            type="checkbox"
                            checked={isGSTApplied}
                            onChange={(e) => setIsGSTApplied(e.target.checked)}
                          />
                          Apply GST ({GST_RATE * 100}%)
                        </label>

                        {isGSTApplied && (
                          <p className="gst-amount">
                            GST Amount: ₹{gstAmount.toFixed(2)}
                          </p>
                        )}
                      </div>
                      <div className="shipping-section">
  <label className="shipping-checkbox">
    <input
      type="checkbox"
      checked={isShippingApplied}
      onChange={(e) => setIsShippingApplied(e.target.checked)}
    />
    Apply Shipping (₹{SHIPPING_CHARGE})
  </label>

  {isShippingApplied && (
    <p className="shipping-amount">
      Shipping: ₹{SHIPPING_CHARGE}
    </p>
  )}
</div>
                      <div className="offline-customer-form">
                        <h4>Customer Details</h4>

                        <input
                          type="text"
                          placeholder="Customer Name"
                          value={offlineCustomer.fullName}
                          onChange={(e) => handleOfflineCustomerChange('fullName', e.target.value)}
                        />

                        <input
                          type="email"
                          placeholder="Email (optional)"
                          value={offlineCustomer.email}
                          onChange={(e) => handleOfflineCustomerChange('email', e.target.value)}
                        />

                        <input
                          type="tel"
                          placeholder="Phone Number"
                          value={offlineCustomer.phoneNumber}
                          onChange={(e) => handleOfflineCustomerChange('phoneNumber', e.target.value)}
                        />
                        <input
  type="text"
  placeholder="Customer GST Number (optional)"
  value={offlineCustomer.gst || ""}
  onChange={(e) =>
    handleOfflineCustomerChange("gst", e.target.value)
  }
/>

                        <input
                          type="text"
                          placeholder="Address Line 1"
                          value={offlineCustomer.addressLine1}
                          onChange={(e) => handleOfflineCustomerChange('addressLine1', e.target.value)}
                        />

                        <input
                          type="text"
                          placeholder="Address Line 2 (optional)"
                          value={offlineCustomer.addressLine2}
                          onChange={(e) => handleOfflineCustomerChange('addressLine2', e.target.value)}
                        />

                        <input
                          type="text"
                          placeholder="City"
                          value={offlineCustomer.city}
                          onChange={(e) => handleOfflineCustomerChange('city', e.target.value)}
                        />

                        <input
                          type="text"
                          placeholder="State"
                          value={offlineCustomer.state}
                          onChange={(e) => handleOfflineCustomerChange('state', e.target.value)}
                        />

                        <input
                          type="text"
                          placeholder="Pincode"
                          value={offlineCustomer.pincode}
                          onChange={(e) => handleOfflineCustomerChange('pincode', e.target.value)}
                        />
                      </div>

                      <label className="whatsapp-checkbox">
                        <input
                          type="checkbox"
                          checked={sendInvoiceOnWhatsApp}
                          onChange={(e) => setSendInvoiceOnWhatsApp(e.target.checked)}
                        />
                        Send invoice on WhatsApp
                      </label>


                      <button onClick={handleFinalizeSale} className="finalize-sale-btn">
                        Finalize Sale
                      </button>
                      <button
                        className="print-invoice-btn"
                        onClick={() => setShowInvoice(true)}
                      >
                        🖨 Reprint Invoice
                      </button>
                      <button
  type="button"
  onClick={handleClearOfflineCart}
  style={{
    background: "#ff4d4f",
    color: "white",
    border: "none",
    padding: "10px 16px",
    borderRadius: "6px",
    cursor: "pointer",
    marginRight: "10px"
  }}
>
  Clear Cart
</button>


                    </>
                  ) : (
                    <p>Cart is empty. Add products to start billing.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        {modalImage && (
          <div className="image-modal-backdrop" onClick={closeImageModal}>
            <div
              className="image-modal-content"
              // Stop propagation so clicking the image itself doesn't close the modal
              onClick={(e) => e.stopPropagation()}
            >
              <button className="close-modal-btn" onClick={closeImageModal}>&times;</button>
              <img src={modalImage} alt="Full Product View" className="full-image-display" />
            </div>
          </div>
        )}

      </div>
      {showInvoice && invoiceData && (
        <div className="invoice-print">
          <div id="invoice-pdf" className="invoice-container compact-invoice">

            {/* ================= HEADER (CENTER) ================= */}
            <div className="invoice-header">
              <h2>TANISHKA IMITATION JEWELLERY</h2>
              <p>Streets Of Europe, Hinjewadi, Pune</p>
              <p>Pune, PIN CODE-412101.</p>
              <p>Phone :- +91 78978 97441</p>
              <p><strong>GSTN :</strong> 27CRAPA0906N1Z0</p>
            </div>

            {/* ========== INVOICE + CUSTOMER INFO (LEFT / TOP) ========== */}
            <div className="invoice-top-info">
              <p><strong>Invoice No :</strong> {invoiceData.invoiceNumber}</p>
              <p><strong>Date :</strong> {invoiceData.invoiceDate.toLocaleDateString()}</p>
              <p><strong>Name :</strong> {invoiceData.customer.fullName}</p>
              <p><strong>Address :</strong> {invoiceData.customer.addressLine1}</p>
              <p><strong>GSTN No :</strong> {invoiceData.customer.gst || 'N/A'}</p>
            </div>

            {/* ================= ITEM TABLE (BELOW) ================= */}
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Sr</th>
                  <th>Item Name</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {invoiceData.items.map((item, index) => {
                  const lineTotal = item.price * item.quantity;
                  return (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>{item.productName}</td>
                      <td>{item.quantity}</td>
                      <td>{item.price.toFixed(2)}</td>
                      <td>{lineTotal.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* ================= TOTALS (RIGHT) ================= */}
            <div className="invoice-summary">
              <div>
                <span>Total :</span>
                <span>₹{invoiceData.subtotal.toFixed(2)}</span>
              </div>
              <div>
                <span>IGST @ {(invoiceData.gstRate * 100).toFixed(0)}% :</span>
                <span>₹{invoiceData.gstAmount.toFixed(2)}</span>
              </div>
              {invoiceData.shippingFee > 0 && (
  <div>
    <span>Shipping :</span>
    <span>₹{invoiceData.shippingFee.toFixed(2)}</span>
  </div>
)}
              <div className="net-total">
                <span>Net Total :</span>
                <span>₹{invoiceData.total.toFixed(2)}</span>
              </div>
            </div>

            {/* ================= AMOUNT IN WORDS ================= */}
            <p className="amount-words">
              {convertNumberToWords(invoiceData.total)} Only
            </p>

            {/* ================= FOOTER ================= */}
            <div className="invoice-footer">
              <div>
                <p><strong>Invoice No :</strong> {invoiceData.invoiceNumber}</p>
                <p><strong>Date :</strong> {invoiceData.invoiceDate.toLocaleDateString()}</p>
              </div>

              <div className="signature">
                <p>For TANISHKA IMITATION JEWELLERY</p>
                <div className="signature-line">Receiver's Signature</div>
              </div>
            </div>

          </div>
        </div>
      )}
      {/* ===============================
   LAST SCANNED PRODUCT POPUP
=============================== */}
      {lastScannedProduct && (
        <div className="scan-popup">
          <div className="scan-popup-content">
            <div className="scan-success">✅ Added</div>

            <div className="scan-product-name">
              {lastScannedProduct.name}
            </div>

            <div className="scan-product-code">
              Code: {lastScannedProduct.code}
            </div>
          </div>
        </div>
      )}

      {/* 📷 CAMERA SCANNER MODAL */}
      {showCameraScanner && (
        <div className="camera-scanner-modal">
          <div className="scanner-container">

            {/* Camera Feed Wrapper */}
            <div className="camera-wrapper">
              <div id="camera-scanner" />

              {/* Overlay INSIDE camera wrapper */}
              <div className="scanner-overlay">
                <div className="laser-line"></div>
              </div>
            </div>

            <button
              onClick={() => setShowCameraScanner(false)}
              className="close-scanner-btn"
            >
              Close Scanner
            </button>

          </div>
        </div>
      )}
      {variantSelectionProduct && (
  <div className="variant-modal-backdrop">
    <div className="variant-modal">
      <h3>Select Variant</h3>

      {variantSelectionProduct.variations.map((variant, index) => (
        <button
          key={index}
          disabled={Number(variant.quantity) <= 0}
          onClick={() => {
            handleOfflineAddToCart(
              variantSelectionProduct,
              variant
            );
            setVariantSelectionProduct(null);
          }}
        >
          {variant.color} {variant.size}
          (Stock: {variant.quantity})
        </button>
      ))}

      <button
        onClick={() => setVariantSelectionProduct(null)}
      >
        Cancel
      </button>
    </div>
  </div>
)}




    </div>
  );
};

export default AdminPage;