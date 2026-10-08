// src/pages/ProductsPage.jsx

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  db,
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDoc as getDocument,
  getStorage,
  ref as storageRef,
  getDownloadURL
} from '../firebase';
import { collectionGroup } from "firebase/firestore";

import ProductCard from '../components/ProductCard';
import { useCart, getPriceForQuantity, createStablePricingId, getCartItemId } from '../components/CartContext';
import { useAuth } from '../components/AuthContext';
import './ProductsPage.css';
import { FaShoppingCart, FaArrowLeft, FaFilter, FaTimes, FaSpinner, FaDownload } from 'react-icons/fa';
import { jsPDF } from 'jspdf';
import * as autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import ProductCardSkeleton from "../components/ProductCardSkeleton";
import { trackMetaEvent } from "../utils/pixels";
// Product fetch limit per batch
const PRODUCTS_PER_PAGE = 20;

// --- Existing Pricing Logic (UNCHANGED) ---
const getProductPrice = (product, subcollectionsMap, pricingKey) => {
  const subcollection = subcollectionsMap[product.subcollectionId];
  if (!subcollection?.tieredPricing) return null;

  const tiers = subcollection.tieredPricing[pricingKey];
  if (!tiers) return null;

  return getPriceForQuantity(tiers, 0);
};



const ProductsPage = () => {
  const { collectionId } = useParams();
  // Always open ProductsPage at the top
  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [collectionId]);
  // 🌟 Loop Fix: Ref to manage initial render skip (Kept for Strict Mode resilience)
  const isInitialRender = useRef(true);
const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  // --- STATE ---
  const [products, setProducts] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const lastVisibleRef = useRef(null);
  const [subcollections, setSubcollections] = useState([]);
  const [selectedSubcollectionId, setSelectedSubcollectionId] = useState('all');
  const [mainCollection, setMainCollection] = useState(null);
  const [subcollectionsMap, setSubcollectionsMap] = useState({});
const [downloadAction, setDownloadAction] = useState(null);
  const [isMetadataReady, setIsMetadataReady] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState(null);
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0); // 0..100

const [minDownloadQty, setMinDownloadQty] = useState("");
const [maxDownloadQty, setMaxDownloadQty] = useState("");
  const { cart, addToCart, removeFromCart, pricingKey } = useCart();
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [isControlsVisible, setIsControlsVisible] = useState(false);
  const cartItemsCount = Object.values(cart).reduce((total, item) => total + item.quantity, 0);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const allProductsCache = useRef([]); // 🚨 NEW: Stores all products fetched from all subcollections
  const [visibleProductCount, setVisibleProductCount] = useState(PRODUCTS_PER_PAGE);
  const navigate = useNavigate();
  const loadMoreRef = useRef(null);
  // Prevent re-prefetching same images
  const prefetchedImagesRef = useRef(new Set());
  const [isDownloadingImages, setIsDownloadingImages] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStats, setDownloadStats] = useState({
    total: 0,
    completed: 0
  });
  const getPreviewImage = (url) => {
    if (!url) return null;

    // Low-cost preview (small size)
    return `${url}&w=200&quality=40`;
  };


  // ---------------------------------------------------------------------
  // ---------------------------------------------------------------------

  useEffect(() => {
    console.log("EFFECT 1: Starting fetchMetadata for collection:", collectionId);
    const fetchMetadata = async () => {
      setError(null);
      setIsMetadataReady(false);
      try {
        // Fetch Main Collection Title
        const mainCollectionDocRef = doc(db, "collections", collectionId);
        const mainCollectionDocSnap = await getDoc(mainCollectionDocRef);
        if (!mainCollectionDocSnap.exists()) {
          setError(`Main collection "${collectionId}" not found.`);
          console.error(`Metadata Error: Collection "${collectionId}" not found.`);
          return;
        }
        const mainData = { id: mainCollectionDocSnap.id, ...mainCollectionDocSnap.data() };
        setMainCollection(mainData);
        console.log(`Metadata Success: Found main collection: ${mainData.title}`);

        // Fetch Subcollections
        const subcollectionRef = collection(db, "collections", collectionId, "subcollections");
        const subcollectionSnapshot = await getDocs(subcollectionRef);
        const fetchedSubcollections = subcollectionSnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        })).sort((a, b) => (a.showNumber || 0) - (b.showNumber || 0));
        setSubcollections(fetchedSubcollections);

        const map = fetchedSubcollections.reduce((map, sub) => {
          map[sub.id] = sub;
          return map;
        }, {});
        setSubcollectionsMap(map);

        // Set default ID
        if (fetchedSubcollections.length > 0) {
          // Set 'all' as the default selection to trigger the comprehensive fetch
          setSelectedSubcollectionId('all');
          console.log(`Metadata Success: Set default subcollection ID to: all (Triggering fetch all)`);
        } else {
          console.warn("Metadata Warning: No subcollections found. Product fetch will not run.");
        }

      } catch (err) {
        console.error("Metadata Catch Error:", err);
        setError("Failed to load collection categories. Check Firebase rules/connection.");
      } finally {
        setIsMetadataReady(true);
        setIsLoadingProducts(false);
        console.log("Metadata FINISHED. isMetadataReady=true");
      }
    };

    if (collectionId) {
      fetchMetadata();
    }
  }, [collectionId]);

  // --- Debounce Effect (UNCHANGED) ---
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  // ---------------------------------------------------------------------
  // ---------------------------------------------------------------------
  const fetchAllProductsOnLoad = useCallback(async () => {
    if (!collectionId || !isMetadataReady) return;

    console.log("FAST FETCH ALL via collectionGroup");

    setIsLoadingProducts(true);
    setError(null);
    lastVisibleRef.current = null;

    try {
      const q = query(
        collectionGroup(db, "products"),
        where("mainCollection", "==", collectionId),
        orderBy("productCode"),
        limit(PRODUCTS_PER_PAGE)
      );

      const snap = await getDocs(q);

      const fetched = snap.docs.map(d => {
        const pathParts = d.ref.path.split("/");
        const subcollectionId = pathParts[pathParts.indexOf("subcollections") + 1];

        return {
          id: d.id,
          ...d.data(),
          subcollectionId, // ✅ CRITICAL FIX
        };
      });


      setProducts(fetched);

trackMetaEvent("ViewContent", {
  content_name: mainCollection?.title || "Products Collection",
  content_ids: fetched.map(p => p.id),
  content_type: "product"
});
      allProductsCache.current = fetched;

      lastVisibleRef.current =
        snap.docs[snap.docs.length - 1] || null;

      setHasMore(snap.docs.length === PRODUCTS_PER_PAGE);

      console.log(`FAST ALL loaded ${fetched.length}`);
    } catch (err) {
      console.error(err);
      setError("Failed to load products.");
      setHasMore(false);
    } finally {
      setIsLoadingProducts(false);
    }
  }, [collectionId, isMetadataReady]);

  const getAllImageUrls = (product) => {
    const urls = [];
    if (product?.image) urls.push(product.image);
    if (Array.isArray(product?.images)) {
      for (const img of product.images) {
        if (img) urls.push(img);
      }
    }
    return Array.from(new Set(urls));
  };
  const prefetchProductImages = useCallback((productsToPrefetch = []) => {
    productsToPrefetch.forEach((product) => {
      const mainImage =
        product?.image || product?.images?.[0] || null;

      if (!mainImage) return;

      const previewUrl = getPreviewImage(mainImage);

      if (!prefetchedImagesRef.current.has(previewUrl)) {
        const img = new Image();
        img.src = previewUrl; // ✅ small preview only
        prefetchedImagesRef.current.add(previewUrl);
      }
    });
  }, []);

  useEffect(() => {
    if (!products.length) return;

    const PREFETCH_AHEAD = 10; // 👈 number of upcoming products
    const startIndex = products.length;
    const nextProducts = allProductsCache.current.slice(
      startIndex,
      startIndex + PREFETCH_AHEAD
    );

    if (nextProducts.length) {
      prefetchProductImages(nextProducts);
    }
  }, [products, prefetchProductImages]);

  const handleLoadMoreAll = async () => {
    if (isFetchingMore || !hasMore || !lastVisibleRef.current) return;

    setIsFetchingMore(true);

    try {
      const q = query(
        collectionGroup(db, "products"),
        where("mainCollection", "==", collectionId),
        orderBy("productCode"),
        startAfter(lastVisibleRef.current),
        limit(PRODUCTS_PER_PAGE)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        setHasMore(false);
        return;
      }

      const fetched = snap.docs.map(d => {
        const pathParts = d.ref.path.split("/");
        const subcollectionId = pathParts[pathParts.indexOf("subcollections") + 1];

        return {
          id: d.id,
          ...d.data(),
          subcollectionId,
        };
      });


      // ✅ 1. De-duplicate against already rendered products
      let uniqueNewProducts = [];

      setProducts(prev => {
        const seen = new Set(prev.map(p => p.id));
        uniqueNewProducts = fetched.filter(p => !seen.has(p.id));
        return [...prev, ...uniqueNewProducts];
      });

      // ✅ 2. De-duplicate cache as well
      const cacheSeen = new Set(allProductsCache.current.map(p => p.id));
      const uniqueForCache = fetched.filter(p => !cacheSeen.has(p.id));
      allProductsCache.current.push(...uniqueForCache);

      // ✅ 3. 🔥 PREFETCH IMAGES FOR NEXT SCROLL (THIS IS THE KEY ADDITION)
      prefetchProductImages(uniqueNewProducts);

      // ✅ 4. Update cursor
      lastVisibleRef.current = snap.docs[snap.docs.length - 1];

      // ✅ 5. End condition
      if (snap.docs.length < PRODUCTS_PER_PAGE) {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Load more failed:", err);
    } finally {
      setIsFetchingMore(false);
    }
  };




  // 🌟 DEPENDENCY ADJUSTMENT: lastVisible and hasMore MUST be here for "Load More" to function correctly.


  // ---------------------------------------------------------------------
  const fetchProducts = useCallback(async (isLoadMore = false, isSearchOnly = false) => {
    if (!collectionId) return;

    // Ensure we don't run for the 'all' option
    if (!isMetadataReady || selectedSubcollectionId === 'all') {
      console.log(`Products Fetch Skipped: selectedSubcollectionId is '${selectedSubcollectionId}'.`);
      return;
    }

    console.log(`FETCH: Starting product fetch (Load More: ${isLoadMore}) for Subcollection ID: ${selectedSubcollectionId}. Search: ${debouncedSearchTerm}, Sort: ${sortBy}`);

    if (!isLoadMore) {

      // 🚨 FIX 2: Reset Pagination cursor using the Ref
      lastVisibleRef.current = null;
      setHasMore(true); // Keep state update for UI purposes

      if (isSearchOnly) {
        setIsFetchingMore(true);
      } else {
        setIsLoadingProducts(true);
        setProducts([]);
      }
    } else {
      // Scenario: User clicked "Load More".
      setIsFetchingMore(true);
      if (!hasMore) {
        setIsFetchingMore(false);
        return;
      }
    }

    try {
      const productsCollectionPath = collection(
        db,
        "collections",
        collectionId,
        "subcollections",
        selectedSubcollectionId,
        "products"
      );

      let baseQuery = productsCollectionPath;
      const searchUpper = debouncedSearchTerm.toUpperCase();
      let orderField = 'productCode';

      if (searchUpper) {
        baseQuery = query(
          baseQuery,
          where('productCode', '>=', searchUpper),
          where('productCode', '<=', searchUpper + '\uf8ff'),
          orderBy('productCode')
        );
      } else {
        if (sortBy === 'product-name-asc') {
          orderField = 'productName';
        }
        baseQuery = query(baseQuery, orderBy(orderField, 'asc'));
      }

      // 🚨 FIX 3: Read cursor value from the Ref
      const lastDoc = isLoadMore ? lastVisibleRef.current : null;
      if (lastDoc) {
        baseQuery = query(baseQuery, startAfter(lastDoc));
      }

      const finalQuery = query(baseQuery, limit(PRODUCTS_PER_PAGE));

      console.log(`FETCH: Query executed. Awaiting getDocs result...`);
      const documentSnapshots = await getDocs(finalQuery);
      console.log(`FETCH SUCCESS: Received ${documentSnapshots.docs.length} product documents.`);

      const fetchedProducts = documentSnapshots.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        subcollectionId: selectedSubcollectionId,
      }));

      if (isLoadMore) {
        setProducts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const uniqueNewProducts = fetchedProducts.filter(p => !existingIds.has(p.id));
          return [...prev, ...uniqueNewProducts];
        });
      } else {
        setProducts(fetchedProducts);
      }

      if (documentSnapshots.docs.length < PRODUCTS_PER_PAGE) {
        setHasMore(false);
        // No need to update lastVisibleRef.current here
      } else {
        // 🚨 FIX 4: Write new cursor value to the Ref
        lastVisibleRef.current = documentSnapshots.docs[documentSnapshots.docs.length - 1];
        setHasMore(true);
      }

    } catch (err) {
      console.error("PRODUCTS FETCH CATCH ERROR:", err);
      setError("Failed to load products. Check console for required index link or permission errors.");
      setHasMore(false);
    } finally {
      setIsLoadingProducts(false);
      setIsFetchingMore(false);
      console.log("PRODUCTS FETCH FINISHED.");
    }
    // 🚨 FIX 5: Remove lastVisible and hasMore from dependencies to break the loop!
  }, [collectionId, selectedSubcollectionId, debouncedSearchTerm, sortBy, isMetadataReady]);
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return;
    console.log("SCROLL TRIGGER", selectedSubcollectionId);

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !isFetchingMore &&
          !isLoadingProducts
        ) {
          if (selectedSubcollectionId === "all") {
            handleLoadMoreAll();          // ✅ CORRECT
          } else {
            fetchProducts(true, false);  // ✅ CORRECT
          }
        }
      },
      {
        rootMargin: "400px",
        threshold: 0.01
      }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [
    hasMore,
    isFetchingMore,
    isLoadingProducts,
    selectedSubcollectionId,
    handleLoadMoreAll,
    fetchProducts
  ]);



  // src/pages/ProductsPage.jsx (Find and replace the existing EFFECT 2)

  // src/pages/ProductsPage.jsx (Find and replace the existing EFFECT 2)

  // src/pages/ProductsPage.jsx (Around line 320)

  useEffect(() => {

    if (!collectionId || !isMetadataReady) {
      return;
    }

    console.log(`EFFECT 2: Current Selected Subcollection ID: ${selectedSubcollectionId}`);

    if (selectedSubcollectionId === 'all') {
      // A. Fetch ALL products (Runs on initial load)
      console.log("EFFECT 2: Triggering fetchAllProductsOnLoad.");
      fetchAllProductsOnLoad();

    } else {
      // B. Fetch SINGLE subcollection products (Runs on category/filter change)
      const isSearchOnly = Boolean(debouncedSearchTerm);

      // This is to prevent the single-subcollection fetch from running immediately 
      // after the 'all' fetch completes on initial page load.
      if (isInitialRender.current && !isSearchOnly) {
        console.log("EFFECT 2: Skipping single fetch during initial 'all' load.");
        isInitialRender.current = false;
        return;
      }

      console.log("EFFECT 2: Triggering single-subcollection fetchProducts (Resetting pagination).");
      fetchProducts(false, isSearchOnly);
    }

    // This runs after the first intended fetch cycle completes
    isInitialRender.current = false;

  }, [
    collectionId,
    selectedSubcollectionId,
    debouncedSearchTerm,
    sortBy,
    isMetadataReady,
    isInitialRender,
    fetchAllProductsOnLoad,
    fetchProducts
  ]);

  // ---------------------------------------------------------------------
  // ---------------------------------------------------------------------

  const sortedProducts = useMemo(() => {
    let currentProducts = [...products];
    const searchUpper = debouncedSearchTerm.toUpperCase();

    // 1️⃣ Client-side filtering
    if (searchUpper) {
      currentProducts = currentProducts.filter(product => {
        const codeMatch =
          product.productCode &&
          product.productCode.toUpperCase().includes(searchUpper);

        const nameMatch =
          product.productName &&
          product.productName.toUpperCase().includes(searchUpper);

        return codeMatch || nameMatch;
      });
    }

    // 2️⃣ Client-side price sorting (ROLE-FREE)
    if (sortBy === 'price-asc') {
      currentProducts.sort((a, b) => {
        const priceA = getProductPrice(a, subcollectionsMap, pricingKey);
        const priceB = getProductPrice(b, subcollectionsMap, pricingKey);
        return (priceA ?? Infinity) - (priceB ?? Infinity);
      });
    } else if (sortBy === 'price-desc') {
      currentProducts.sort((a, b) => {
        const priceA = getProductPrice(a, subcollectionsMap, pricingKey);
        const priceB = getProductPrice(b, subcollectionsMap, pricingKey);
        return (priceB ?? -Infinity) - (priceA ?? -Infinity);
      });
    }
    else if (sortBy === 'qty-asc') {
  currentProducts.sort((a, b) => {

    const qtyA = Array.isArray(a.variations) && a.variations.length > 0
      ? a.variations.reduce(
          (sum, v) => sum + (Number(v.quantity) || 0),
          0
        )
      : (Number(a.quantity) || 0);

    const qtyB = Array.isArray(b.variations) && b.variations.length > 0
      ? b.variations.reduce(
          (sum, v) => sum + (Number(v.quantity) || 0),
          0
        )
      : (Number(b.quantity) || 0);

    return qtyA - qtyB;
  });
}
else if (sortBy === 'qty-desc') {
  currentProducts.sort((a, b) => {

    const qtyA = Array.isArray(a.variations) && a.variations.length > 0
      ? a.variations.reduce(
          (sum, v) => sum + (Number(v.quantity) || 0),
          0
        )
      : (Number(a.quantity) || 0);

    const qtyB = Array.isArray(b.variations) && b.variations.length > 0
      ? b.variations.reduce(
          (sum, v) => sum + (Number(v.quantity) || 0),
          0
        )
      : (Number(b.quantity) || 0);

    return qtyB - qtyA;
  });
}

    return currentProducts;
  }, [
    products,
    sortBy,
    subcollectionsMap,
    pricingKey,
    debouncedSearchTerm
  ]);
  const inStockProducts = useMemo(() => {
  return sortedProducts.filter(product => {

    if (Array.isArray(product.variations) && product.variations.length > 0) {
      return product.variations.some(v => Number(v.quantity) > 0);
    }

    return Number(product.quantity) > 0;
  });
}, [sortedProducts]);
  const handleAddToCart = (product, variation) => {
    if (!currentUser) {
      alert("To Add Products To Cart Please Log in");
      navigate('/login');
      return;
    }

    const subcollection = subcollectionsMap[product.subcollectionId];
    if (!subcollection?.tieredPricing) {
      console.error('Pricing information is missing for this product.');
      return;
    }

    const tieredPricingData = subcollection.tieredPricing;
    const roleBasedTiers = tieredPricingData[pricingKey];

    if (!roleBasedTiers) {
      console.error(`No pricing tiers found for pricingKey: ${pricingKey}`);
      return;
    }

    const pricingId = createStablePricingId(roleBasedTiers);

    const productData = {
      id: product.id,
      productName: product.productName,
      productCode: product.productCode,
      image: product.image,
      images: product.images,
      tieredPricing: tieredPricingData,
      subcollectionId: product.subcollectionId,
      collectionId,
      pricingId,
      variation
    };
trackMetaEvent("AddToCart", {
  content_name: product.productName,
  content_ids: [product.id],
  content_type: "product",
  value: getProductPrice(product, subcollectionsMap, pricingKey) || 0,
  currency: "INR"
});
    addToCart(productData);
  };

  const fetchAllProductsForDownload = async () => {
    const q = query(
      collectionGroup(db, "products"),
      where("mainCollection", "==", collectionId),
      orderBy("productCode")
    );

    const snap = await getDocs(q);

    return snap.docs.map(d => {
      const pathParts = d.ref.path.split("/");
      const subcollectionId =
        pathParts[pathParts.indexOf("subcollections") + 1];

      return {
        id: d.id,
        ...d.data(),
        subcollectionId
      };
    });
  };
  const fetchProductsForImageDownload = async () => {
    // 🔥 CASE 1 — ALL PRODUCTS
    if (selectedSubcollectionId === "all") {
      const q = query(
        collectionGroup(db, "products"),
        where("mainCollection", "==", collectionId),
        orderBy("productCode")
      );

      const snap = await getDocs(q);

      return snap.docs.map(d => {
        const pathParts = d.ref.path.split("/");
        const subcollectionId =
          pathParts[pathParts.indexOf("subcollections") + 1];

        return {
          id: d.id,
          ...d.data(),
          subcollectionId
        };
      });
    }

    // 🔥 CASE 2 — SINGLE SUBCOLLECTION
    const productsCollectionPath = collection(
      db,
      "collections",
      collectionId,
      "subcollections",
      selectedSubcollectionId,
      "products"
    );

    const q = query(productsCollectionPath, orderBy("productCode"));
    const snap = await getDocs(q);

    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      subcollectionId: selectedSubcollectionId
    }));
  };


  const handleDownloadCollectionImagesDirect = async () => {
    try {
      setIsDownloadingImages(true);
      setDownloadProgress(0);
      setDownloadStats({ total: 0, completed: 0 });

      const storageInstance = getStorage();

      // 🔥 Fetch ALL products (no pagination)
      const allProducts = await fetchProductsForImageDownload();


      if (!allProducts.length) {
        alert("No products found");
        return;
      }

      // 📸 Collect all image paths first
      const imageJobs = [];

    const minQty = Number(minDownloadQty) || 0;
const maxQty = maxDownloadQty ? Number(maxDownloadQty) : Infinity;

for (const product of allProducts) {

  let qty = 0;

  // check variant stock
  if (Array.isArray(product.variations) && product.variations.length > 0) {
    qty = product.variations.reduce(
      (sum, v) => sum + (Number(v.quantity) || 0),
      0
    );
  } else {
    qty = Number(product.quantity) || 0;
  }

  // 🚫 skip if outside range
  if (qty < minQty || qty > maxQty) {
    continue;
  }

  const paths = getAllImagePathsForProduct(product);

  paths.forEach((path, index) => {
    imageJobs.push({ product, path, index });
  });
}

      if (!imageJobs.length) {
        alert("No images found");
        return;
      }

      // 🎯 Set total images
      setDownloadStats({ total: imageJobs.length, completed: 0 });

      let completed = 0;

      for (const job of imageJobs) {
        try {
          const imageRef = storageRef(storageInstance, job.path);
          const url = await getDownloadURL(imageRef);

          const response = await fetch(url);
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);

          const safeCode =
            (job.product.productCode || job.product.id || "product")
              .toString()
              .replace(/[^\w\-]+/g, "_");

          const ext = blob.type.split("/")[1] || "jpg";
          const suffix = job.index > 0 ? `_${job.index + 1}` : "";

          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = `${safeCode}${suffix}.${ext}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);

          completed++;
          const percent = Math.round((completed / imageJobs.length) * 100);

          // 🔄 UPDATE UI
          setDownloadStats(prev => ({
            ...prev,
            completed
          }));
          setDownloadProgress(percent);

          // ⏳ Required delay (browser-safe)
          await new Promise(res => setTimeout(res, 250));
        } catch (err) {
          console.warn("Image skipped:", err);
        }
      }

      alert(`Download started for ${completed} images`);
    } catch (err) {
      console.error(err);
      alert("Image download failed");
    } finally {
      setIsDownloadingImages(false);
    }
  };




  // // src/pages/ProductsPage.jsx (Inside ProductsPage component)

  // // src/pages/ProductsPage.jsx (Inside ProductsPage component)

  // // src/pages/ProductsPage.jsx (Inside ProductsPage component)

  // // src/pages/ProductsPage.jsx (Inside ProductsPage component)

  const handleGeneratePDF = async () => {
    if (selectedSubcollectionId === 'all') {
      alert('Please select a specific category to generate the PDF.');
      return;
    }

    setIsFetchingMore(true);
    const subcollectionName = subcollectionsMap[selectedSubcollectionId]?.name || 'Category';

    try {
      const minQty = Number(minDownloadQty) || 0;
const maxQty = maxDownloadQty ? Number(maxDownloadQty) : Infinity;
      // 1. Fetch ALL products (no limit)
      const productsCollectionPath = collection(
        db,
        "collections",
        collectionId,
        "subcollections",
        selectedSubcollectionId,
        "products"
      );

      const allProductsQuery = query(productsCollectionPath, orderBy('productCode'));
      const snapshot = await getDocs(allProductsQuery);

      if (snapshot.empty) {
        alert('No products found in this category.');
        return;
      }

      const doc = new jsPDF();
      let productCount = 0;
      const docWidth = doc.internal.pageSize.getWidth();
      const docHeight = doc.internal.pageSize.getHeight();
      const margin = 10; // A small margin for padding

      // 2. Fetch all image data URLs concurrently
      const imagePromises = snapshot.docs.map(async (productDoc, index) => {
        const product = productDoc.data();

        // 🚫 Skip products with quantity 0
       let qty = 0;

// check variant stock
if (Array.isArray(product.variations) && product.variations.length > 0) {
  qty = product.variations.reduce(
    (sum, v) => sum + (Number(v.quantity) || 0),
    0
  );
} else {
  qty = Number(product.quantity) || 0;
}

// 🚫 skip if outside range
if (qty < minQty || qty > maxQty) {
  return null;
}
        if (product.image) {
          try {
            const storageInstance = getStorage();
            const imageRef = storageRef(storageInstance, product.image);
            const url = await getDownloadURL(imageRef);

            // Fetch the image and convert it to a Data URL (Base64)
            const response = await fetch(url);
            const blob = await response.blob();

            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                resolve({
                  dataUrl: reader.result,
                  productCode: product.productCode || `Product ${index + 1}`,
                  quantity: qty ?? 'N/A' // Use ?? to handle missing/null quantity

                });
              };
              reader.readAsDataURL(blob);
            });
          } catch (urlError) {
            console.error(`Error processing image for product ${product.productCode}:`, urlError);
            return null; // Skip problematic images
          }
        }
        return null;
      });

      // Resolve all promises, filtering out any nulls
      const images = (await Promise.all(imagePromises)).filter(img => img !== null);

      if (images.length === 0) {
        alert('No images found to include in the PDF.');
        return;
      }

      // 3. Embed images into the PDF (one per page)
      images.forEach((img, index) => {
        if (index > 0) {
          doc.addPage();
        }

        // Get image type (jsPDF supports JPEG, PNG, WEBP)
        const imgType = img.dataUrl.match(/^data:image\/(.+?);/)[1].toUpperCase();

        // Add header text
        doc.setFontSize(12);
        doc.text(
          `${img.productCode} (${subcollectionName}) | Qty: ${img.quantity}`,
          margin,
          margin
        );

        // Add the image. We assume a full-width image for simplicity.
        // Start position Y is 15 (below the header text)
        const startY = 15;
        const availableHeight = docHeight - startY - margin;
        const availableWidth = docWidth - (2 * margin);

        // For demonstration, let's use a fixed size that fits well (e.g., 180mm width)
        const imgWidth = 180;
        const imgHeight = 180; // Placeholder, in a real app you'd calculate aspect ratio

        doc.addImage(
          img.dataUrl,
          imgType,
          (docWidth - imgWidth) / 2, // Center the image horizontally
          startY,
          imgWidth,
          availableHeight > imgHeight ? imgHeight : availableHeight
        );

        productCount++;
      });

      // 4. Save and download the PDF
      doc.save(`${subcollectionName}_Images.pdf`);
      alert(`Successfully generated a PDF with ${productCount} images for ${subcollectionName}.`);

    } catch (err) {
      console.error("PDF Generation Error:", err);
      // Show a generic error to the user
      alert("Failed to generate the image PDF. Check console for details.");
    } finally {
      setIsFetchingMore(false);
    }
  };

  // Helper function to get the image URL (must be defined or imported)
  // Ensure this helper is available in your component scope or is defined globally




  // --- Loading and Error States (Final Check) ---
  if (error) {
    return <div className="products-page-container"><p className="error-message">{error}</p></div>;
  }

  if (!isMetadataReady) {
    return <div className="products-page-container loading-state">
      <FaSpinner className="loading-spinner" />
      <p>Loading collection categories...</p>
    </div>;
  }
  const isActivelySearching = debouncedSearchTerm.length > 0;
  // Only show spinner if we are actively loading AND we have no products yet
  if (isLoadingProducts && products.length === 0 && !isActivelySearching) {
    return <div className="products-page-container loading-state">
      <FaSpinner className="loading-spinner" />
    </div>;
  }

  const getAllImagePathsForProduct = (product) => {
    const paths = [];
    if (product?.image) paths.push(product.image);
    if (Array.isArray(product?.images)) {
      for (const p of product.images) if (p) paths.push(p);
    }
    // de-dupe just in case
    return Array.from(new Set(paths));
  };


  // --- JSX RENDER (UNCHANGED) ---
  return (
    <>
      <div className="products-page-container">

        {/* HEADER */}
        <div className="page-header-container">
          <Link
            to="/"
            className="back-to-collections-icon"
            aria-label="Back to Collections"
          >
            <FaArrowLeft />
          </Link>

          <div className="title-and-toggle-wrapper">

            <button
              className="mobile-controls-toggle"
              onClick={() => setIsControlsVisible(!isControlsVisible)}
              aria-label={isControlsVisible ? "Close filters and search" : "Open filters and search"}
            >
              {isControlsVisible ? <FaTimes /> : <FaFilter />}
            </button>
          </div>
        </div>

        {/* CONTROLS BLOCK */}
        <div className={`product-controls ${isControlsVisible ? 'open' : ''}`}>

          {/* Filter by Subcollection */}
          <div className="filter-group">
            <label htmlFor="subcollection-select">Filter:</label>
            <select
              id="subcollection-select"
              value={selectedSubcollectionId}
              onChange={(e) => {
                // Trigger the fetch by changing the ID
                setSelectedSubcollectionId(e.target.value);
              }}
            >
              <option
                value="all"
              >
                {subcollections.length === 0 ? 'No Categories Found' : 'All Products'}
              </option>
              {subcollections.map(sub => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>
          {selectedSubcollectionId !== 'all' && (
            <div className="filter-group">
             <button
  onClick={() => {
    setDownloadAction("pdf");
    setShowDownloadOptions(true);
  }}
  disabled={isFetchingMore || isLoadingProducts}
  className="download-btn"
  title={`Generate PDF catalog for ${
    subcollectionsMap[selectedSubcollectionId]?.name || "category"
  }`}
>
  <FaDownload />
  {isFetchingMore ? "Preparing PDF..." : "Generate PDF"}
</button>
            </div>
          )}
          <div className="filter-group">
      <button
  onClick={() => {
    setDownloadAction("images");
    setShowDownloadOptions(true);
  }}
  className="download-btn"
>
  <FaDownload />
  {selectedSubcollectionId === "all"
    ? "Download All Images"
    : "Download Category Images"}
</button>

{showDownloadOptions && (
  <div className="download-options">

    <div className="qty-range-inputs">
      <label>Min Qty</label>
      <input
        type="number"
        value={minDownloadQty}
        onChange={(e) => setMinDownloadQty(e.target.value)}
        placeholder="1"
      />

      <label>Max Qty</label>
      <input
        type="number"
        value={maxDownloadQty}
        onChange={(e) => setMaxDownloadQty(e.target.value)}
        placeholder="100"
      />
    </div>

    {downloadAction === "images" && (
      <button
        onClick={() => {
          setShowDownloadOptions(false);
          handleDownloadCollectionImagesDirect();
        }}
        className="download-confirm-btn"
      >
        Start Download
      </button>
    )}

    {downloadAction === "pdf" && (
      <button
        onClick={() => {
          setShowDownloadOptions(false);
          handleGeneratePDF();
        }}
        className="download-confirm-btn"
      >
        Generate PDF
      </button>
    )}

  </div>
)}


            {isDownloadingImages && (
              <div className="download-progress-card">
                <div className="progress-header">
                  <span>
                    {selectedSubcollectionId === "all"
                      ? "Downloading Collection Images"
                      : "Downloading Category Images"}
                  </span>
                  <span>{downloadProgress}%</span>
                </div>

                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>

                <div className="progress-meta">
                  {downloadStats.completed} / {downloadStats.total} images
                </div>
              </div>
            )}
          </div>


          {/* Sort by */}
          <div className="filter-group">
            <label htmlFor="sort-by">Sort by:</label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="default">Default (By Code)</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="qty-asc">Qty: Low to High</option>
<option value="qty-desc">Qty: High to Low</option>
            </select>
          </div>

          {/* Search Bar */}
          <div className="search-group">
            <input
              type="text"
              placeholder="Search by product code/name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
        {/* END OF CONTROLS BLOCK */}

        {/* PRODUCTS GRID */}
{inStockProducts.length === 0 && !isLoadingProducts && !isFetchingMore ? (
    <div className="no-products-message">

    {selectedSubcollectionId !== "all" ? (
      <>
        <h3>🚧 Out of Stock</h3>
        <p>
          This category is currently out of stock.
        </p>
        <p>
          Please check back soon — we are restocking new products.
        </p>
      </>
    ) : (
      <p>
        No products found for this selection.
      </p>
    )}

  </div>
) : (
          <div className="products-grid collections-grid">
            {/* REAL PRODUCTS */}
            {inStockProducts.map((product) => {
              const price = getProductPrice(product, subcollectionsMap, pricingKey);

              const subcollection = subcollectionsMap[product.subcollectionId];
              const tieredPricing = subcollection
                ? subcollection.tieredPricing ?? null
                : null;



              return (
                <ProductCard
                  key={`${product.id}-${product.subcollectionId || "all"}`}
                  product={{
                    ...product,
                    tieredPricing
                  }}
                  onIncrement={(productData) =>
                    handleAddToCart(productData, productData.variation)
                  }
                  onDecrement={(cartItemId) => removeFromCart(cartItemId)}
                  cart={cart}
                />

              );
            })}


            {/* 🔥 SKELETONS WHILE LOADING MORE */}
            {(isLoadingProducts || isFetchingMore) &&
              Array.from({ length: 6 }).map((_, index) => (
                <ProductCardSkeleton key={`skeleton-${index}`} />
              ))}
          </div>

        )}
        {/* 🔽 Infinite scroll sentinel */}
        {/* 🔽 Infinite scroll sentinel */}
        <div ref={loadMoreRef} style={{ height: 1 }} />

        {/* 🔄 Bottom loading indicator */}
        {isFetchingMore && hasMore && (
          <div className="infinite-loader">
            <FaSpinner className="spin" />
            <span>Loading more products…</span>
          </div>
        )}



        {/* LOAD MORE BUTTON */}
        {/* LOAD MORE BUTTON */}
        {/* Check hasMore for subcollection view, or if there are more items in the cache for 'all' view */}
        {/* The hasMore state is now correctly managed for both the Firebase query and the client-side cache */}



        {/* VIEW CART OVERLAY */}
        {cartItemsCount > 0 && (
          <div className="view-cart-fixed-container">
            <Link to="/cart" className="view-cart-btn-overlay">
              <div className="cart-icon-wrapper">
                <FaShoppingCart />
              </div>
              <div className="cart-details-wrapper">
                <span className="view-cart-text">View cart</span>
                <span className="cart-items-count-overlay">{cartItemsCount} item{cartItemsCount !== 1 ? 's' : ''}</span>
              </div>
              <div className="cart-arrow-wrapper">
                &gt;
              </div>
            </Link>
          </div>
        )}
      </div>
    </>
  );
};
export default ProductsPage;