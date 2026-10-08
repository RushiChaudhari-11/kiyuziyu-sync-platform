import React, { useEffect, useState, useMemo,useRef} from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  onSnapshot,
  getDoc,
  limit,
  startAfter
} from "firebase/firestore";

import { db } from "../../firebase";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { FaShoppingCart, FaArrowLeft, FaFilter, FaTimes, FaSpinner, FaDownload } from 'react-icons/fa';

import StoreProductCard from "../../components/StoreProductCard";
import { useStoreCart } from "../store/StoreCartContext";
import { useStoreAuth } from "../store/StoreAuthContext"; 
import { getCleanDomain } from "../../utils/domain";
import "../../pages/ProductsPage.css"
import StoreTopbar from "../store/StoreTopbar";
const SellerStore = () => {

  const location = useLocation();
const [homepage, setHomepage] = useState(null);
  const { cart, addToCart, removeFromCart, cartItemsCount } = useStoreCart();
  const [isControlsVisible, setIsControlsVisible] = useState(false);

  /* ===============================
  STATE
  =============================== */

  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const backgroundFetchCount = useRef(0);
const isBackgroundFetch = useRef(false);
const [lastDoc, setLastDoc] = useState(null);
const [hasMore, setHasMore] = useState(true);
  const [collections, setCollections] = useState([]);
  
  const [subcollectionsMap, setSubcollectionsMap] = useState({});
 const initialCollection =
    location.state?.collectionId ||
    localStorage.getItem("selectedCollection") ||
    "";
const [selectedCollection, setSelectedCollection] = useState(initialCollection || "");
  const [selectedSubcollection, setSelectedSubcollection] = useState("");

  const [loading, setLoading] = useState(true);
 const { user } = useStoreAuth();
   const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("default");
const [searchTerm, setSearchTerm] = useState("");
const observer = useRef(null);
const loadingMore = useRef(false);
const autoLoadingMore = useRef(false);
const [isLoadingMore, setIsLoadingMore] = useState(false);
const inventoryListeners = useRef([]);
  /* ===============================
  NAVIGATION DATA
  =============================== */

 

  const passedDomain =
    location.state?.storeDomain || getCleanDomain();

  /* ===============================
  LOAD STORE
  =============================== */

 useEffect(() => {

  let inventoryListeners = [];

 const loadStore = async () => {

  console.time("TOTAL STORE LOAD");

  try {

    setLoading(true);
    setProducts([]);
    setLastDoc(null);
    setHasMore(true);

    console.log("STORE LOADING...");

    /* ===============================
       HOMEPAGE
    =============================== */

    console.time("homepage");

    const domain = getCleanDomain();

    const homepageRef = doc(db, "storeHomepages", domain);
    const homepageSnap = await getDoc(homepageRef);

    console.timeEnd("homepage");

    if (homepageSnap.exists()) {
      setHomepage(homepageSnap.data());
    }

    /* ===============================
       SELLER
    =============================== */

    console.time("seller");

    const sellerSnap = await getDocs(
      query(
        collection(db, "users"),
        where("storeDomain", "==", passedDomain)
      )
    );

    console.timeEnd("seller");

    if (sellerSnap.empty) {
      console.log("Seller not found");
      setLoading(false);
      return;
    }

    const sellerDoc = sellerSnap.docs[0];
    const sellerId = sellerDoc.id;

    setSeller({
      id: sellerId,
      ...sellerDoc.data()
    });

    console.log("Seller ID:", sellerId);

    /* ===============================
       PRICING
    =============================== */

    console.time("pricing");

    const pricingSnap = await getDocs(
      collection(db, "dropshipperPricing", sellerId, "pricing")
    );

    console.timeEnd("pricing");

    const pricingMap = {};

    pricingSnap.docs.forEach(d => {
      pricingMap[d.id] = d.data();
    });

    console.log(
      "Pricing loaded:",
      Object.keys(pricingMap).length
    );

    /* ===============================
       PRODUCTS
    =============================== */

    console.time("products");

    const baseRef = collection(
      db,
      "storeProducts",
      sellerId,
      "products"
    );

    let q;

    if (selectedSubcollection) {

     q = query(
  baseRef,
  where("collectionId", "==", selectedCollection),
  where("subcollectionId", "==", selectedSubcollection),
  where("enabled", "==", true),
  ...(searchTerm.trim()
    ? [where("productCode", "==", searchTerm.trim())]
    : [limit(25)])
);

    } else {

      q = query(
  baseRef,
  where("collectionId", "==", selectedCollection),
  where("enabled", "==", true),
  ...(searchTerm.trim()
    ? [where("productCode", "==", searchTerm.trim())]
    : [limit(25)])
);

    }

    const storeSnap = await getDocs(q);

    console.timeEnd("products");

    console.log(
      "FIRST QUERY DOC COUNT:",
      storeSnap.docs.length
    );

    if (!storeSnap.empty) {

      const last =
        storeSnap.docs[storeSnap.docs.length - 1];

      setLastDoc(last);

    }

    if (storeSnap.docs.length < 25) {
      setHasMore(false);
    } else {
      setHasMore(true);
    }

    let storeProducts = storeSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    storeProducts = storeProducts.map(p => {

      const pricingKey =
        `${p.collectionId}_${p.subcollectionId}`;

      const tiers =
        pricingMap[pricingKey]?.tieredPricing || [];

      const normalized = tiers.map(t => ({
        min_quantity: Number(t.min_quantity),
        max_quantity: Number(t.max_quantity),
        price: Number(t.price),
        costPrice: Number(t.costPrice ?? 0)
      }));

      return {
        ...p,
        sellerId,
        minimumOrderValue:
          sellerDoc.data().minimumOrderValue ?? 0,
        shippingSettings:
          sellerDoc.data().shippingSettings ?? null,
        tieredPricing: {
          retail: normalized,
          wholesale: normalized,
          dealer: normalized,
          distributor: normalized,
          vip: normalized
        }
      };

    });

    console.log(
      "PRODUCTS AFTER PRICING:",
      storeProducts.length
    );

    setProducts(storeProducts);

    /* ===============================
       INVENTORY LISTENERS
    =============================== */

    console.time("listeners");

    console.log(
      "Inventory listeners being created:",
      storeProducts.length
    );

    storeProducts.forEach((p) => {
  const ref = doc(
    db,
    "collections",
    p.collectionId,
    "subcollections",
    p.subcollectionId,
    "products",
    p.productId
  );

  console.log("🔎 INVENTORY CHECK:", {
    storeProductId: p.id,
    productId: p.productId,
    productCode: p.productCode,
    productName: p.productName,
    path: ref.path,
  });

  const unsub = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        console.warn("❌ INVENTORY NOT FOUND:", {
          productName: p.productName,
          productId: p.productId,
          path: ref.path,
        });

        setProducts((prev) =>
          prev.map((prod) =>
            prod.id === p.id
              ? {
                  ...prod,
                  quantity: 0,
                  inventoryQuantity: 0,
                  inventoryLoaded: true,
                }
              : prod
          )
        );

        return;
      }

      const data = snap.data();

      let totalStock = 0;

      if (
        Array.isArray(data.variations) &&
        data.variations.length > 0
      ) {
        totalStock = data.variations.reduce(
          (sum, variation) =>
            sum + Number(variation.quantity || 0),
          0
        );
      } else {
        totalStock = Number(data.quantity || 0);
      }

      console.log("✅ INVENTORY FOUND:", {
        productName: p.productName,
        productId: p.productId,
        inventoryDocId: snap.id,
        quantity: totalStock,
        path: ref.path,
      });

      setProducts((prev) =>
        prev.map((prod) => {
          if (prod.id !== p.id) {
            return prod;
          }

          return {
            ...prod,
            quantity: totalStock,
            inventoryQuantity: totalStock,
            inventoryLoaded: true,

            ...(Array.isArray(data.variations)
              ? {
                  variations: data.variations,
                }
              : {}),
          };
        })
      );
    },
    (error) => {
      console.error(
        "❌ INVENTORY LISTENER ERROR:",
        p.productName,
        p.productId,
        error
      );
    }
  );

  inventoryListeners.current.push(unsub);
});

    console.timeEnd("listeners");

    /* ===============================
       COLLECTIONS
    =============================== */

/* ===============================
   COLLECTIONS + SUBCOLLECTIONS
   OPTIMIZED
=============================== */

console.time("collections + subcollections");

const subMap = {};

storeProducts.forEach(p => {

  if (!subMap[p.collectionId]) {
    subMap[p.collectionId] = new Set();
  }

  subMap[p.collectionId].add(
    p.subcollectionId
  );

});

const validCollections = [];
const finalSubMap = {};

/*
  Load ONLY collections used
  by current products
*/

for (const colId of Object.keys(subMap)) {

  try {

    /* ===============================
       COLLECTION DOC
    =============================== */

    const collectionDoc = await getDoc(
      doc(
        db,
        "collections",
        colId
      )
    );

    if (collectionDoc.exists()) {

      validCollections.push({
        id: collectionDoc.id,
        ...collectionDoc.data()
      });

    }

    /* ===============================
       SUBCOLLECTIONS
    =============================== */

    const subSnap = await getDocs(
      collection(
        db,
        "collections",
        colId,
        "subcollections"
      )
    );

    finalSubMap[colId] = subSnap.docs
      .map(d => ({
        id: d.id,
        ...d.data()
      }))
      .filter(s =>
        subMap[colId].has(s.id)
      );

  } catch (err) {

    console.error(
      "Collection load error:",
      colId,
      err
    );

  }

}

setCollections(validCollections);
setSubcollectionsMap(finalSubMap);

console.timeEnd(
  "collections + subcollections"
);

console.log(
  "Collections loaded:",
  validCollections.length
);

} catch (err) {

  console.error(
    "Store load error:",
    err
  );

} finally {

  setLoading(false);

  console.timeEnd(
    "TOTAL STORE LOAD"
  );

}

};

  loadStore();

 return () => {
  inventoryListeners.current.forEach((unsub) => unsub());
  inventoryListeners.current = [];
};
}, [selectedCollection, selectedSubcollection, searchTerm]);
  /* ===============================
  SAVE SELECTION (REFRESH SAFE)
  =============================== */

  useEffect(() => {
    if (selectedCollection) {
      localStorage.setItem("selectedCollection", selectedCollection);
    }
  }, [selectedCollection]);

 
  const getTierPrice = (tiers, quantity) => {

  if (!tiers || tiers.length === 0) return 0;

  let selected = tiers[0];

  for (const tier of tiers) {

    const min = Number(tier.min_quantity);
    const max = Number(tier.max_quantity) || Infinity;

    if (quantity >= min && quantity <= max) {
      selected = tier;
    }
  }

  return Number(selected.price);
};

const loadMoreProducts = async () => {
  if (loadingMore.current) return;
  if (!lastDoc) return;
  if (!seller?.id) return;
  if (!hasMore) return;

  loadingMore.current = true;
  setIsLoadingMore(true);

  try {
    const baseRef = collection(
      db,
      "storeProducts",
      seller.id,
      "products"
    );

    let q;

    if (selectedSubcollection) {
      q = query(
        baseRef,
        where("collectionId", "==", selectedCollection),
        where("subcollectionId", "==", selectedSubcollection),
        where("enabled", "==", true),
        startAfter(lastDoc),
        limit(25)
      );
    } else {
      q = query(
        baseRef,
        where("collectionId", "==", selectedCollection),
        where("enabled", "==", true),
        startAfter(lastDoc),
        limit(25)
      );
    }

    const snap = await getDocs(q);

    console.log(
      "LOAD MORE DOC COUNT:",
      snap.docs.length
    );

    if (snap.empty) {
      setHasMore(false);
      return;
    }

    let newProducts = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // ===============================
    // PRICING
    // ===============================

    const pricingSnap = await getDocs(
      collection(
        db,
        "dropshipperPricing",
        seller.id,
        "pricing"
      )
    );

    const pricingMap = {};

    pricingSnap.docs.forEach((d) => {
      pricingMap[d.id] = d.data();
    });

    newProducts = newProducts.map((p) => {
      const pricingKey =
        `${p.collectionId}_${p.subcollectionId}`;

      const tiers =
        pricingMap[pricingKey]?.tieredPricing || [];

      const normalized = tiers.map((t) => ({
        min_quantity: Number(t.min_quantity),
        max_quantity: Number(t.max_quantity),
        price: Number(t.price),
        costPrice: Number(t.costPrice ?? 0),
      }));

      return {
        ...p,
        sellerId: seller.id,

        minimumOrderValue:
          seller.minimumOrderValue ?? 0,

        shippingSettings:
          seller.shippingSettings ?? null,

        tieredPricing: {
          retail: normalized,
          wholesale: normalized,
          dealer: normalized,
          distributor: normalized,
          vip: normalized,
        },
      };
    });

    // ===============================
    // UPDATE PAGINATION FIRST
    // ===============================

    const newLastDoc =
      snap.docs[snap.docs.length - 1];

    setLastDoc(newLastDoc);

    if (snap.docs.length < 25) {
      setHasMore(false);
    }

    // ===============================
    // ADD PRODUCTS
    // ===============================

    setProducts((prev) => [
      ...prev,
      ...newProducts,
    ]);

    // ===============================
    // INVENTORY LISTENERS
    // ===============================

    newProducts.forEach((p) => {
      const ref = doc(
        db,
        "collections",
        p.collectionId,
        "subcollections",
        p.subcollectionId,
        "products",
        p.productId
      );

      console.log(
        "🔎 INVENTORY CHECK (MORE):",
        {
          productName: p.productName,
          productId: p.productId,
          path: ref.path,
        }
      );

      const unsub = onSnapshot(
        ref,
        (snap) => {
          if (!snap.exists()) {
            console.warn(
              "❌ INVENTORY NOT FOUND (MORE):",
              p.productName,
              p.productId
            );

            setProducts((prev) =>
              prev.map((prod) =>
                prod.id === p.id
                  ? {
                      ...prod,
                      quantity: 0,
                      inventoryQuantity: 0,
                      inventoryLoaded: true,
                    }
                  : prod
              )
            );

            return;
          }

          const data = snap.data();

          let totalStock = 0;

          if (
            Array.isArray(data.variations) &&
            data.variations.length > 0
          ) {
            totalStock =
              data.variations.reduce(
                (sum, variation) =>
                  sum +
                  Number(
                    variation.quantity || 0
                  ),
                0
              );
          } else {
            totalStock =
              Number(data.quantity || 0);
          }

          console.log(
            "✅ INVENTORY FOUND (MORE):",
            {
              productName: p.productName,
              productId: p.productId,
              quantity: totalStock,
            }
          );

          setProducts((prev) =>
            prev.map((prod) =>
              prod.id === p.id
                ? {
                    ...prod,
                    quantity: totalStock,
                    inventoryQuantity:
                      totalStock,
                    inventoryLoaded: true,

                    ...(Array.isArray(
                      data.variations
                    )
                      ? {
                          variations:
                            data.variations,
                        }
                      : {}),
                  }
                : prod
            )
          );
        },
        (error) => {
          console.error(
            "❌ INVENTORY ERROR (MORE):",
            p.productName,
            error
          );
        }
      );

      inventoryListeners.current.push(unsub);
    });

  } catch (error) {
    console.error(
      "Load more error:",
      error
    );
  } finally {
    loadingMore.current = false;
    setIsLoadingMore(false);
  }
};
const lastProductRef = (node) => {
  if (loading) return;

  if (observer.current) {
    observer.current.disconnect();
  }

  observer.current = new IntersectionObserver((entries) => {
    if (
      entries[0].isIntersecting &&
      hasMore &&
      !loadingMore.current
    ) {
      loadMoreProducts();
    }
  });

  if (node) {
    observer.current.observe(node);
  }
};
  /* ===============================
  FILTER PRODUCTS
  =============================== */

 const filteredProducts = useMemo(() => {

  console.log("------------ FILTER PIPELINE ------------");
  console.log("PRODUCTS IN STATE:", products.length);
  console.log("Selected Collection:", selectedCollection);
  console.log("Selected Subcollection:", selectedSubcollection);

  let list = [...products];

  /* ===============================
  SEARCH FILTER
  =============================== */

  if (search) {

    const term = search.toLowerCase();

    list = list.filter(p =>
      p.productName?.toLowerCase().includes(term) ||
      p.productCode?.toLowerCase().includes(term)
    );

    console.log("AFTER SEARCH FILTER:", list.length);

  }

  /* ===============================
  PRICE CALCULATION
  =============================== */

  const mapped = list.map(product => {

    const tiers = product.tieredPricing?.retail ?? [];

    const subQty = Object.values(cart).reduce((sum, item) => {

      if (item.subcollectionId === product.subcollectionId) {
        return sum + item.quantity;
      }

      return sum;

    }, 0);

    const price = getTierPrice(tiers, subQty || 1);

    return {
      ...product,
      displayPrice: price
    };

  });

  console.log("FINAL PRODUCTS RENDERED:", mapped.length);
  console.log("-----------------------------------------");

  return mapped;

}, [products, search, cart]);
const visibleProducts = useMemo(() => {
  return filteredProducts.filter((product) => {
    const totalStock =
      product.variations?.length > 0
        ? product.variations.reduce(
            (sum, v) => sum + Number(v.quantity || 0),
            0
          )
        : Number(product.quantity || 0);

    return totalStock > 0;
  });
}, [filteredProducts]);
useEffect(() => {
  if (loading) return;
  if (visibleProducts.length > 0) return;
  if (!hasMore) return;
  if (!lastDoc) return;
  if (loadingMore.current) return;
  if (autoLoadingMore.current) return;

  autoLoadingMore.current = true;

  loadMoreProducts().finally(() => {
    autoLoadingMore.current = false;
  });
}, [
  loading,
  visibleProducts.length,
  hasMore,
  lastDoc,
]);
 useEffect(() => {

  if (!window.fbq) return;

 if (visibleProducts.length > 0) {

  window.fbq("track", "ViewContent", {
    content_type: "product_group",
    content_ids: visibleProducts.map((p) => p.productId),
    currency: "INR",
  });

}

}, [visibleProducts]);
  /* ===============================
  UI
  =============================== */

 
const domain = getCleanDomain();

const storeName =
  homepage?.navbar?.brandName || seller?.storeName || "Online Store";

const description =
  homepage?.hero?.subtitle ||
  `Shop premium products from ${storeName}`;

  if (loading) {
  return <p style={{ padding: "40px" }}>Loading store...</p>;
}

  if (!seller) {
    return <p style={{ padding: "40px" }}>Store not found</p>;
  }

  return (
    <div className="products-page-container">
      <StoreTopbar data={homepage?.topbar} />
<Helmet>

<title>{storeName}</title>

<meta name="description" content={description} />

<meta property="og:title" content={storeName} />
<meta property="og:description" content={description} />
<meta property="og:type" content="website" />
<meta property="og:url" content={`https://${domain}`} />

<meta
  property="og:image"
  content={homepage?.hero?.images?.[0]?.src || "/default-og.jpg"}
/>

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content={storeName} />
<meta name="twitter:description" content={description} />

<meta
  name="twitter:image"
  content={homepage?.hero?.images?.[0]?.src || "/default-og.jpg"}
/>

</Helmet>
      {/* <h1>{seller.name}'s Store</h1> */}
      {/* <div className="page-header-container">
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
              </div> */}

      {/* FILTERS */}
        <div className={`product-controlss ${isControlsVisible ? 'open' : ''}`}>

  <button
  type="button"
  className="back-to-collections-icon"
  onClick={() => {
    window.location.href = "/";
  }}
  aria-label="Back to Collections"
>
  <FaArrowLeft />
</button>

  <select
    value={selectedCollection}
    onChange={(e) => {
      const col = e.target.value;
      setSelectedCollection(col);
      setSelectedSubcollection("");
    }}
  >
    {collections.map(c => (
      <option key={c.id} value={c.id}>
        {c.title}
      </option>
    ))}
  </select>

  <select
    value={selectedSubcollection}
    onChange={(e) => setSelectedSubcollection(e.target.value)}
  >
    <option value="">All</option>

    {subcollectionsMap[selectedCollection]?.map(sub => (
      <option key={sub.id} value={sub.id}>
        {sub.name}
      </option>
    ))}
  </select>

  <input
    placeholder="Search..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
  />

  <button
    onClick={() => setSearchTerm(search)}
  >
    Search
  </button>

</div>

      {/* PRODUCTS */}
      <div className="products-grid collections-grid">

       {visibleProducts.map((product, index) => {
  const isLastProduct = index === visibleProducts.length - 1;

  return (
   <StoreProductCard
  key={product.id}
  ref={isLastProduct ? lastProductRef : null}
  product={product}
  onIncrement={(product) => {
    if (!user) {
      alert("Please login first");

      navigate("/store/signup", {
        state: {
          redirectTo: location.pathname + location.search,
        },
      });

      return;
    }

    addToCart(product);

    if (window.fbq) {
      window.fbq("track", "AddToCart", {
        content_name: product.productName,
        content_ids: [product.productId],
        content_type: "product",
        value: product.displayPrice || 0,
        currency: "INR",
      });
    }
  }}
  onDecrement={(cartId) => removeFromCart(cartId)}
  cart={cart}
/>
  );
})}

      </div>
      {isLoadingMore && (
  <div style={{ textAlign: "center", padding: "20px" }}>
    <FaSpinner className="spin" />
  </div>
)}

      {/* CART */}
      {cartItemsCount > 0 && (
        <div className="view-cart-fixed-container">
          <Link to="/store/cart" className="view-cart-btn-overlay">
            {cartItemsCount} items - View Cart
          </Link>
        </div>
      )}

    </div>
  );
};

export default SellerStore;