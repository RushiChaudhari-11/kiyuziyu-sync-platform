# 🛍️ Kiyuziyu - Multi-Tenant B2B E-Commerce & Shopify Integration Platform

> **Comprehensive Architecture, File Directory Guide, Data Flow & Operations Manual**  
> *प्रकल्प संपूर्ण माहिती, फाईल गाईड, माहितीचा प्रवाह आणि वापरण्याची पद्धत*

---

## 📌 Table of Contents / अनुक्रमणिका

1. [प्रकल्प परिचय (Project Overview)](#-1-प्रकल्प-परिचय-project-overview)
2. [माहितीचा प्रवाह (Complete Information & Data Flow)](#-2-माहितीचा-प्रवाह-complete-information--data-flow)
   - [Flow 1: Shopify OAuth & Store Connection](#flow-1-shopify-oauth--store-connection)
   - [Flow 2: Product Catalog & Pricing Resolution](#flow-2-product-catalog--pricing-resolution)
   - [Flow 3: Single & Bulk Product Sync to Shopify](#flow-3-single--bulk-product-sync-to-shopify)
   - [Flow 4: Real-time Stock & Inventory Auto-Sync](#flow-4-real-time-stock--inventory-auto-sync)
3. [कोणती फाईल का बनवली आहे? (File-by-File Purpose Guide)](#-3-कोणती-फाईल-का-बनवली-आहे-file-by-file-purpose-guide)
   - [Backend Core Services](#backend-services)
   - [Backend Integration Clients](#backend-integration-clients)
   - [Backend Controllers & REST APIs](#backend-controllers)
   - [Backend Data Models & Repositories](#backend-models--repositories)
   - [Frontend React Dashboard & UI](#frontend-react-ui)
4. [महत्त्वाची वैशिष्ट्ये (Key System Features)](#-4-महत्त्वाची-वैशिष्ट्ये-key-system-features)
5. [सिस्टम कशी सुरू आणि वापरायची? (How to Run and Use)](#-5-सिस्टम-कशी-सुरू-आणि-वापरायची-how-to-run-and-use)
6. [नेहमी लागणारे Commands व Troubleshooting](#-6-नेहमी-लागणारे-commands-व-troubleshooting)
7. [Firebase Read Optimization & Zero-Stock Elimination (खर्च बचत अपडेट)](#-7-firebase-read-optimization--zero-stock-elimination)

---

## 🌟 1. प्रकल्प परिचय (Project Overview)

**Kiyuziyu** हे एक आधुनिक Multi-Tenant B2B ज्वेलरी व ई-कॉमर्स प्लॅटफॉर्म आहे.  
या सिस्टीममध्ये **Admin (Kiyuziyu Central Owner)** संपूर्ण प्रॉडक्ट कॅटलॉग, मूळ किंमत (Base Price), आणि स्टॉक व्यवस्थापित करतो. विविध **Tenants (किंवा Clients/Retailers)** या प्लॅटफॉर्मशी जोडले जातात आणि ते स्वतःचे **Shopify Stores** कनेक्ट करून एका क्लिकवर प्रॉडक्ट्स स्वतःच्या स्टोअरमध्ये विकण्यासाठी sync करतात.

### मुख्य क्षमता (Core Highlights):
- 🏢 **Multi-Tenancy**: प्रत्येक टेनंटचा डेटा, स्टोअर क्रेडेंशियल्स आणि सेलिंग प्राईस स्वतंत्र राहतात.
- 🔗 **Direct Shopify GraphQL Integration**: जलद, अचूक आणि सुरक्षित Shopify Admin API (2024-01+) वापर.
- 💰 **Custom Margin/Pricing Engine**: टेनंट स्वतःची सेलिंग प्राईस ठरवू शकतात (पण ती बेस प्राईसपेक्षा कमी होऊ शकत नाही).
- ⚡ **Realtime Inventory Sync**: ॲडमिनने डेटाबेसमध्ये स्टॉक वाढवला/कमी केला की सर्व सिंक केलेल्या Shopify स्टोअर्समध्ये **आपोआप (real-time)** स्टॉक अपडेट होतो.
- 📦 **Bulk & Single Sync with Background Queue**: शेकडो प्रॉडक्ट्स सिंक करताना ब्राउझर किंवा सर्व्हर हँग न होता बॅकग्राउंड जॉब्सद्वारे प्रक्रिया होते.

---

## 🔄 2. माहितीचा प्रवाह (Complete Information & Data Flow)

### Flow 1: Shopify OAuth & Store Connection
```text
Tenant Browser  ──▶  ShopifyOAuthController  ──▶  Shopify OAuth Dialog
      ▲                                                      │
      │                                                      ▼
Redirect Back   ◀──  ShopifyCallback (Exchange Token) ◀── User Authorizes
      │
      ▼
ShopifyConnectionService (Encrypts and Saves Token in Firestore)
```
1. टेनंट डॅशबोर्डवरून "Connect Shopify Store" वर क्लिक करतो (`storeDomain.myshopify.com`).
2. `ShopifyOAuthController` टेनंटला Shopify च्या परवानगी पानावर रिडायरेक्ट करतो.
3. टेनंटने ॲक्सेस दिला की Shopify ऑथोरायझेशन कोड परत पाठवते.
4. `ShopifyOAuthService` हा कोड वापरून कायमस्वरूपी `accessToken` मिळवतो.
5. `ShopifyConnectionService` हे टोकन सुरक्षितरीत्या कूटबद्ध (encrypted) करून Firestore मधील `shopify_store_connections` मध्ये साठवते.

---

### Flow 2: Product Catalog & Pricing Resolution
```text
Admin Firestore (`products`)
   ├── Base Price: ₹500
   └── Stock: 25
         │
         ▼
Tenant Override Query (`client_product_overrides`)
   ├── Selling Price: ₹750  (Valid: >= Base Price) ✅
   └── If < Base Price: Rejected with BadRequestException ❌
         │
         ▼
Customer Price on Shopify: ₹750 | Kiyuziyu Base Price: ₹500
```
- **Base Price Guardrail**: टेनंट प्रॉडक्ट विकताना नफा कमवू शकतो, परंतु तो Kiyuziyu च्या मूळ बेस प्राईसपेक्षा कमी भावात विकू शकत नाही.
- जर टेनंटने कोणतीही किंमत बदलली नसेल, तर डीफॉल्ट बेस प्राईसच वापरली जाते.

---

### Flow 3: Single & Bulk Product Sync to Shopify
```text
Tenant UI (`TenantProducts.jsx`)
       │ Click "Sync Now" / "Bulk Sync"
       ▼
SyncJobController / ShopifyProductController
       │ Creates SyncJob (`status: QUEUED`)
       ▼
SyncJobProcessor (Async Background Worker)
       │ Picks up QUEUED job
       ▼
ShopifyProductService / ShopifyBulkProductSyncService
       │
       ├── 1. Check Duplicate via Metafield `kiyuziyu.product_id`
       ├── 2. Calculate Effective Stock (Root / Variations)
       ├── 3. Create or Update Product via GraphQL Client
       ├── 4. Set Metafields (product_id, product_code, base_price, variations)
       ├── 5. Set Product Type & Auto-assign Shopify Collection
       └── 6. Set Inventory via `inventorySetQuantities`
       ▼
Firestore Mapping Updated (`ShopifyProductMapping`: status = SYNCED)
```

---

### Flow 4: Real-time Stock & Inventory Auto-Sync
*(सर्वात महत्त्वाचा flow: जेव्हा Admin stock बदलतो)*

```text
Admin modifies stock in Database (Firestore `products` collection)
                         │
                         ▼
        RealtimeStockListener.java (`MODIFIED` snapshot event)
                         │
                         ▼
       Find all mapped stores (`ShopifyProductMapping`)
       for this productId where status is MAPPED/SYNCED
                         │
                         ▼
       Queue automatic background job (`job_auto_xxxxxxxxxxxx`)
                         │
                         ▼
             SyncJobProcessor.java (`processJobAsync`)
                         │
                         ▼
       ShopifyProductService.java (`syncProductToShopify`)
                         │
                         ▼
       ShopifyGraphQLClient.java (`updateProduct`)
                         │
                         ▼
  GraphQL: `inventorySetQuantities` @idempotent
                         │
                         ▼
     ✅ Shopify Store Inventory Updated Automatically!
```

---

## 📂 3. कोणती फाईल का बनवली आहे? (File-by-File Purpose Guide)

### Backend Services
| File Path & Name | कशासाठी बनवली आहे? (Purpose) |
|---|---|
| [`RealtimeStockListener.java`](file:///d:/Syteos%20Project/kiyuziyunew-main/backend/src/main/java/com/kiyuziyu/api/service/RealtimeStockListener.java) | **Firebase Real-time Listener:** ॲडमिनने डेटाबेसमध्ये प्रॉडक्टचा स्टॉक बदलल्यास हा लिसनर लगेच तो बदल डिटेक्ट करतो आणि ज्या टेनंट्सनी प्रॉडक्ट सिंक केले आहे त्यांच्यासाठी ऑटोमॅटिक सिंक जॉब तयार करतो. |
| [`ShopifyProductService.java`](file:///d:/Syteos%20Project/kiyuziyunew-main/backend/src/main/java/com/kiyuziyu/api/service/ShopifyProductService.java) | **Single Product Sync Engine:** एका प्रॉडक्टची माहिती, इमेजेस, टॅग्ज, व्हेरिएशन्स, कॅल्क्युलेटेड स्टॉक आणि प्राईस व्हॅलिडेट करून Shopify वर तयार/अपडेट करतो. |
| [`ShopifyBulkProductSyncService.java`](file:///d:/Syteos%20Project/kiyuziyunew-main/backend/src/main/java/com/kiyuziyu/api/service/ShopifyBulkProductSyncService.java) | **Bulk Sync Engine:** एकाच वेळी अनेक प्रॉडक्ट्स बॅचमध्ये प्रक्रिया करून रेट-लिमिट सांभाळून सिंक करतो. |
| [`SyncJobProcessor.java`](file:///d:/Syteos%20Project/kiyuziyunew-main/backend/src/main/java/com/kiyuziyu/api/service/SyncJobProcessor.java) | **Background Job Worker:** Queue मध्ये आलेले सिंक जॉब्स उचलून बॅकग्राउंड थ्रेडवर एक्झिक्युट करतो, ज्यामुळे UI ब्लॉक होत नाही. |
| [`SyncJobService.java`](file:///d:/Syteos%20Project/kiyuziyunew-main/backend/src/main/java/com/kiyuziyu/api/service/SyncJobService.java) | सिंक जॉब्सची स्थिती (Queued, In Progress, Completed, Failed) ट्रॅक आणि व्यवस्थापित करतो. |
| [`ShopifyOAuthService.java`](file:///d:/Syteos%20Project/kiyuziyunew-main/backend/src/main/java/com/kiyuziyu/api/service/ShopifyOAuthService.java) | Shopify OAuth हँडशेक, ऑथ कोडवरून टोकन एक्स्चेंज आणि सुरक्षा व्हेरिफिकेशन करतो. |
| [`ShopifyConnectionService.java`](file:///d:/Syteos%20Project/kiyuziyunew-main/backend/src/main/java/com/kiyuziyu/api/service/ShopifyConnectionService.java) | टेनंटच्या स्टोअरचे ॲक्सेस टोकन्स एनक्रिप्ट करून सेव्ह करतो आणि ॲक्टिव्ह कनेक्शन मॅनेज करतो. |
| [`ShopifyProductMappingService.java`](file:///d:/Syteos%20Project/kiyuziyunew-main/backend/src/main/java/com/kiyuziyu/api/service/ShopifyProductMappingService.java) | Firebase चा प्रॉडक्ट ID आणि Shopify चा `gid://shopify/Product/...` ID यांमधील मॅपिंग साठवून ठेवतो. |
| [`TenantProductService.java`](file:///d:/Syteos%20Project/kiyuziyunew-main/backend/src/main/java/com/kiyuziyu/api/service/TenantProductService.java) | टेनंट प्रॉडक्ट कॅटलॉग, कस्टम प्राईस ओव्हरराईड आणि मार्जिन ॲडजस्टमेंट हाताळतो. |

---

### Backend Integration Clients
| File Path & Name | कशासाठी बनवली आहे? (Purpose) |
|---|---|
| [`ShopifyGraphQLClient.java`](file:///d:/Syteos%20Project/kiyuziyunew-main/backend/src/main/java/com/kiyuziyu/api/integration/shopify/ShopifyGraphQLClient.java) | **Core Shopify GraphQL API Client:** <br>• `createProduct`: संपूर्ण डेटा, इमेजेस, टॅग्ज आणि स्टॉकसह प्रॉडक्ट बनवणे.<br>• `updateProduct`: आधीच अस्तित्वात असलेला प्रॉडक्ट अपडेट करणे.<br>• `setInventoryQuantity`: `inventorySetQuantities` वापरून Shopify चा स्टॉक बदलणे.<br>• `setProductMetafields`: `kiyuziyu.product_id` आणि बेस प्राईस मेटाफिल्ड्स सेव्ह करणे.<br>• `findOrCreateCollection`: कलेक्शन शोधून प्रॉडक्ट ऑटो-असाइन करणे. |
| [`ShopifyRestClient.java`](file:///d:/Syteos%20Project/kiyuziyunew-main/backend/src/main/java/com/kiyuziyu/api/integration/shopify/ShopifyRestClient.java) | Shopify REST API कॉल्स (उदा. Legacy एंडपॉईंट्स किंवा वेबहुक व्हेरिफिकेशन) साठी वापरला जातो. |

---

### Backend Controllers (REST APIs)
| Controller Name | Endpoints & Function |
|---|---|
| [`ShopifyProductController.java`](file:///d:/Syteos%20Project/kiyuziyunew-main/backend/src/main/java/com/kiyuziyu/api/controller/ShopifyProductController.java) | `POST /api/shopify/sync-product/{productCode}` — सिंगल प्रॉडक्ट सिंक सुरू करतो. |
| [`SyncJobController.java`](file:///d:/Syteos%20Project/kiyuziyunew-main/backend/src/main/java/com/kiyuziyu/api/controller/SyncJobController.java) | `POST /api/sync-jobs/bulk-sync` — बल्क सिंक जॉब तयार करतो.<br>`GET /api/sync-jobs/{jobId}` — सिंक जॉबची सद्यस्थिती आणि प्रगती देतो. |
| [`ShopifyOAuthController.java`](file:///d:/Syteos%20Project/kiyuziyunew-main/backend/src/main/java/com/kiyuziyu/api/controller/ShopifyOAuthController.java) | `GET /api/shopify/oauth/authorize` आणि `/callback` — Shopify ॲप इन्स्टॉलेशन आणि ऑथेंटिकेशन. |
| [`ShopifyConnectionController.java`](file:///d:/Syteos%20Project/kiyuziyunew-main/backend/src/main/java/com/kiyuziyu/api/controller/ShopifyConnectionController.java) | टेनंट स्टोअर कनेक्शनची स्थिती तपासणे आणि डिस्कनेक्ट करणे. |
| [`TenantProductController.java`](file:///d:/Syteos%20Project/kiyuziyunew-main/backend/src/main/java/com/kiyuziyu/api/controller/TenantProductController.java) | टेनंटसाठी कॅटलॉग लिस्टिंग आणि सेलिंग प्राईस ओव्हरराईड (`PUT /api/tenant/products/{productCode}/price`). |

---

### Backend Models & Repositories
| File | Description |
|---|---|
| `Product.java` | Firestore `products` डॉक्युमेंटचे मॉडेल (Base price, stock, variations, collectionData). |
| `ClientProductOverride.java` | विशिष्ट टेनंटने स्वतःच्या स्टोअरसाठी सेट केलेली sellingPrice. |
| `ShopifyProductMapping.java` | Firebase `productId` <-> Shopify `shopifyProductId` चे लिंकेज आणि सिंक स्टेटस. |
| `SyncJob.java` | बॅकग्राउंड सिंक जॉबचा संपूर्ण तपशील (Total, Processed, Succeeded, Failed, Error Logs). |
| `ShopifyStoreConnection.java` | टेनंटच्या Shopify स्टोअरचे डोमेन, ॲक्सेस टोकन आणि लोकेशन आयडी. |

---

### Frontend React UI (`src/pages/API_ADMIN/`)
| File | Description |
|---|---|
| [`TenantProducts.jsx`](file:///d:/Syteos%20Project/kiyuziyunew-main/src/pages/API_ADMIN/TenantProducts.jsx) | **मुख्य टेनंट प्रॉडक्ट्स पेज:** <br>• प्रॉडक्ट्सची संपूर्ण यादी आणि लाईव्ह स्टॉक/किंमत.<br>• सेलिंग प्राईस एडिट करण्याचा पर्याय.<br>• "Sync Now" आणि "Bulk Sync" बटणे.<br>• सिंक चालू असताना रिअल-टाइम प्रोग्रेस दाखवणारे मॉडेल. |
| [`TenantDashboard.jsx`](file:///d:/Syteos%20Project/kiyuziyunew-main/src/pages/API_ADMIN/TenantDashboard.jsx) | टेनंटचे मुख्य डॅशबोर्ड — स्टोअर स्टेटस, एकूण सिंक झालेले प्रॉडक्ट्स आणि ॲक्टिव्हिटी समरी. |
| [`AdminDashboard.jsx`](file:///d:/Syteos%20Project/kiyuziyunew-main/src/pages/API_ADMIN/AdminDashboard.jsx) | ॲडमिनचे डॅशबोर्ड — टेनंट्सची यादी, नवीन टेनंट अप्रूव्हल आणि सेंट्रल प्रॉडक्ट व्यवस्थापन. |
| [`adminAuth.js`](file:///d:/Syteos%20Project/kiyuziyunew-main/src/pages/API_ADMIN/adminAuth.js) | टेनंट/ॲडमिन ऑथेंटिकेशन टोकन, लॉगइन सेशन आणि API इंटरसेप्टर. |

---

## ⚡ 4. महत्त्वाची वैशिष्ट्ये (Key System Features)

### 1. ड्युप्लिकेट प्रॉडक्ट रोखणे (Idempotency & Duplicate Guard)
Shopify वर एकाच प्रॉडक्टची दोनदा नोंद होऊ नये म्हणून प्रत्येक प्रॉडक्टच्या `kiyuziyu.product_id` मेटाफिल्डवर आधारित शोध घेतला जातो:
- जर प्रॉडक्ट Shopify वर आधीच सापडला, तर **`updateProduct`** चालवून फक्त माहिती आणि स्टॉक अपडेट केला जातो.
- जर प्रॉडक्ट पहिल्यांदाच सिंक होत असेल, तरच **`createProduct`** चालवला जातो.

### 2. डायनॅमिक स्टॉक गणना आणि डिस्प्ले (Live Stock & Variant Quantity)
स्टॉक वाचताना आणि Tenant Dashboard वर दाखवताना खालील अचूक नियम पाळला जातो:
1. **व्हेरिएशन प्रॉडक्ट्स (Variant Products)**:
   - प्रत्येक व्हेरिएंटचा थेट लाइव्ह `quantity` दाखवला जातो (उदा. जर `quantity: 0` असेल, तर अचूक `0` दाखवला जातो, `initialQuantity` दाखवली जात नाही).
   - केवळ `quantity` फील्ड उपलब्ध नसतानाच बॅकअप म्हणून `initialQuantity` वापरली जाते.
   - एकूण स्टॉक सर्व व्हेरिएंट्सच्या `quantity` ची बेरीज म्हणून मोजला जातो.
2. **साधे प्रॉडक्ट्स (Simple Products)**:
   - रूट लेव्हलवरील प्रत्यक्ष `quantity` वापरली जाते (नसेल तर `initialQuantity`).
3. **Tenant Dashboard सिंक निवड**:
   - स्टॉक 0 असला तरी कॅटलॉग मॅनेजमेंट आणि रीअल-टाईम इन्व्हेंटरी ट्रॅकिंगसाठी प्रॉडक्ट सिंक करता येतो.
   - Firestore मध्ये जेव्हा ॲडमिन स्टॉक वाढवेल, तेव्हा `RealtimeStockListener` आपोआप Shopify वर तोच लाइव्ह स्टॉक अपडेट करतो.

### 3. प्रॉडक्ट टाईप आणि कलेक्शन्स ऑटोमॅटिक लिंकिंग
Shopify वर प्रॉडक्ट सिंक होताना:
- `collectionData.title` किंवा `subcollectionData.name` नुसार Shopify चा `Product Type` आपोआप सेट होतो.
- त्या नावाचे कलेक्शन Shopify वर अस्तित्वात नसल्यास ते आपोआप तयार केले जाते (`findOrCreateCollection`) आणि प्रॉडक्ट त्या कलेक्शनमध्ये समाविष्ट होतो.

---

## 🚀 5. सिस्टम कशी सुरू आणि वापरायची? (How to Run and Use)

### पूर्वतयारी (Prerequisites)
- **Java 17+** स्थापित असावे (`java -version`).
- **Node.js 18+** आणि npm स्थापित असावे.
- Google Cloud / Firebase सर्व्हिस अकाउंट क्रेडेंशियल्स (`application.yml` मध्ये कॉन्फिगर केलेले असावे).

---

### चरण 1: Backend चालू करणे (Spring Boot)
1. टर्मिनल उघडा आणि `backend` डिरेक्टरीमध्ये जा:
   ```powershell
   cd "d:\Syteos Project\kiyuziyunew-main\backend"
   ```
2. स्प्रिंग बूट ॲप्लिकेशन सुरू करा:
   ```powershell
   mvn spring-boot:run
   ```
   *यशस्वीपणे सुरू झाल्यावर `Tomcat started on port 8080` आणि `[RealtimeStockListener] Initializing Firestore listener...` दिसेल.*

---

### चरण 2: Frontend चालू करणे (React)
1. दुसरे टर्मिनल उघडा आणि मुख्य डिरेक्टरीमध्ये जा:
   ```powershell
   cd "d:\Syteos Project\kiyuziyunew-main"
   ```
2. रिॲक्ट ॲप सुरू करा:
   ```powershell
   npm start
   ```
   *ब्राउझरमध्ये [http://localhost:3000](http://localhost:3000) ओपन होईल.*

---

### चरण 3: सिंक कसे वापरायचे? (Tenant Workflow)
1. ब्राउझरमध्ये **[http://localhost:3000/tenant/login](http://localhost:3000/tenant/login)** वर जाऊन टेनंट खात्याने लॉगइन करा.
2. डाव्या बाजूच्या मेनूमधून **"Products"** (`/tenant/products`) वर जा.
3. तुम्हाला Kiyuziyu चे सर्व उपलब्ध प्रॉडक्ट्स दिसतील:
   - **किंमत बदलायची असल्यास:** "Your Price" रकान्यात तुमची सेलिंग प्राईस टाका (ती बेस प्राईसपेक्षा जास्त असावी).
   - **सिंगल सिंक:** प्रॉडक्ट समोरील **"Sync to Shopify"** बटण दाबा.
   - **बल्क सिंक:** हवे असलेले प्रॉडक्ट्स सिलेक्ट करा आणि वरच्या **"Bulk Sync Selected"** बटणावर क्लिक करा.
4. स्क्रीनवर प्रोग्रेस बार दिसेल. सिंक पूर्ण झाल्यावर Shopify Store मध्ये तो प्रॉडक्ट दिसेल!

---

### चरण 4: Real-time Stock टेस्ट करणे (Admin Workflow)
1. Tenant ने सिंक केलेला कोणताही एक प्रॉडक्ट निवडा.
2. Firebase Console किंवा ॲडमिन पॅनेलमधून त्या प्रॉडक्टचा `quantity` किंवा व्हेरिएशन स्टॉक बदला (उदा. `10` चा `50` करा).
3. **काहीही न करता**, बॅकग्राउंडमध्ये `RealtimeStockListener` तो बदल ओळखेल आणि थेट टेनंटच्या Shopify Store मधील इन्व्हेंटरी आपोआप `50` करेल!

---

## 🛠️ 6. नेहमी लागणारे Commands व Troubleshooting

### जर Port 8080 आधीच चालू असेल (Port Already in Use Error):
```powershell
# Port 8080 वरील प्रोसेसचा PID शोधणे
netstat -ano | findstr :8080

# प्रोसेस बंद करणे (PID नंबर टाका)
taskkill /PID <PID_NUMBER> /F

# त्यानंतर पुन्हा backend सुरू करा
mvn spring-boot:run
```

### Backend टेस्ट्स चालवणे:
```powershell
cd backend
mvn test
```

### Backend Production Jar तयार करणे:
```powershell
cd backend
mvn clean package -DskipTests
```

---

## 💰 7. Firebase Read Optimization & Zero-Stock Elimination (खर्च बचत अपडेट)

> **अद्ययावत: सप्टेंबर 2026** — *Firebase Billing Reads 99.2% कमी करून मोठा खर्च वाचवणारे ऑप्टिमायझेशन.*

### 1. समस्या काय होती? (The Problem)
- Firebase Firestore मधील `products` collection group मध्ये एकूण **1,17,658 प्रॉडक्ट्स** आहेत.
- तपासणीअंती असे आढळले की त्यापैकी तब्बल **1,16,738 प्रॉडक्ट्सचा स्टॉक 0 आहे!** केवळ **920 प्रॉडक्ट्सचाच स्टॉक > 0 आहे.**
- आधीच्या सिस्टीममध्ये Backend कोणतीही अट (filter) न लावता सरसकट सर्व 1,17,658 डॉक्युमेंट्स डेटाबेसमधून मोजत आणि वाचत होते. नंतर Frontend वर 0 स्टॉक असणारे प्रॉडक्ट्स फक्त लपवले जात होते.
- यामुळे:
  - प्रत्येक पानावर आणि पेजिंगच्या वेळी Firebase चे **लाखो Reads** होत होते, ज्यामुळे Firebase चा बिलिंग खर्च प्रचंड वाढत होता.
  - स्क्रीनवर `TOTAL PRODUCTS: 117658` आणि `Page 1 of 2354` दिसत होते.

### 2. आपण काय उपाययोजना केली? (The Fix & Implementation)
1. **Firestore Collection Group Index Exemption:**
   - [`firestore.indexes.json`](file:///d:/Syteos%20Project/kiyuziyunew-main/firestore.indexes.json) मध्ये `collectionGroup: "products"`, field: `quantity` (ASCENDING/DESCENDING) ॲड केले.
   - `firebase deploy --only firestore:indexes` द्वारे Firebase वर इंडेक्स यशस्वीरित्या तयार केला.
2. **Database Query Level Filter (`ProductRepository.java`):**
   - डेटाबेसमधूनच थेट `.whereGreaterThan("quantity", 0)` लावले:
   ```java
   Query baseQuery = firestore.collectionGroup("products").whereGreaterThan("quantity", 0);
   long totalCount = baseQuery.count().get().get().getCount(); // Returns ~920
   Query query = baseQuery.offset(offset).limit(limit);
   ```
   - **आता 0 स्टॉक असलेले 1,16,738 डॉक्युमेंट्स Firebase मधून बाहेरच पडत नाहीत आणि वाचलेच जात नाहीत!**
3. **Live Cloud Run Deployment:**
   - सुधारित Backend कोड नवीन रिव्हिजन **`kiyuziyu-api-00020-tpg`** द्वारे Google Cloud Run वर लगेच Deploy करण्यात आला.
4. **Permanent Credentials Configuration:**
   - `SHOPIFY_CLIENT_ID` आणि `SHOPIFY_CLIENT_SECRET` थेट `backend/src/main/resources/application.yml` मध्ये सेव्ह केले.
   - Firebase Service Account Key `backend/service-account.json` मध्ये ठेवली. आता दररोज PowerShell मध्ये कोणतेही env commands टाकण्याची गरज नाही.

### 3. थेट फायदे आणि परिणाम (Impact & Results)
| बाब | आधी (Before) | आता (After Fix) |
|---|---|---|
| **Firebase Reads** | 1,17,658 डॉक्युमेंट्स | **फक्त 920 डॉक्युमेंट्स (99.2% बचत! 💰)** |
| **Firebase Billing** | खूप जास्त Reads खर्च | **नगण्य (खर्च पूर्णपणे वाचला)** |
| **एकूण उपलब्ध प्रॉडक्ट्स** | 1,17,658 (0 स्टॉक धरून) | **~920 (फक्त विकायला उपलब्ध असलेले)** |
| **पेजेस (Pagination)** | 2,354 पेजेस | **फक्त 19 स्वच्छ पेजेस** |
| **0 Stock प्रॉडक्ट्स** | लोड होत होते | **डेटाबेसमधूनच वगळले** |

---

## 🛍️ 8. Shopify Duplicate Products & Variant Fix (शॉपिफाई डुप्लिकेट व व्हेरियंट अचूकता अपडेट)

> **अद्ययावत: सप्टेंबर 2026** — *Shopify वर प्रॉडक्ट डुप्लिकेट होणे आणि ३ पैकी १ व्हेरियंट गायब होणे या दोन्ही समस्या कायमस्वरूपी सोडवल्या.*

### 1. समस्या काय होत्या? (The Problems)
1. **Dubble Add (Duplicate Products in Shopify):**
   - जेव्हा युझर डॅशबोर्डवरून एखादे प्रॉडक्ट सिंक करायचा, तेव्हा Shopify वर तेच प्रॉडक्ट पुन्हा नव्याने (duplicate) ॲड व्हायचे.
   - **कारण:** `ShopifyGraphQLClient.findProductIdByFirebaseId` हे केवळ `metafields.kiyuziyu.product_id:<id>` द्वारे शोधत होते. Shopify चे GraphQL Search API कस्टम नेमस्पेस मेटाफिल्ड्स इंडेक्स करत नसल्याने शोधामध्ये `null` यायचे आणि सिस्टीम `createProduct` कॉल करून पुन्हा नवीन प्रॉडक्ट बनवायची.
2. **Missing First Variant (3 पैकी फक्त 2 व्हेरियंट दिसणे):**
   - डॅशबोर्डवर ३ व्हेरियंट्स (उदा. `Pwp: 12`, `White: 12`, `M/g: 12`) असताना Shopify वर फक्त २ व्हेरियंट्स (`White` आणि `M/g`) दिसत होते; पहिला व्हेरियंट (`Pwp`) गायब होत होता.
   - **कारण:** Shopify मध्ये `productOptionsCreate` झाल्यावर पहिला व्हेरियंट डीफॉल्ट स्टँडअलोन व्हेरियंटला असाइन व्हायचा. त्यानंतर `productVariantsBulkCreate` मध्ये `strategy: "REMOVE_STANDALONE_VARIANT"` वापरले होते. यामुळे Shopify ने तो मूळ व्हेरियंट (`Pwp`) थेट **डिलीट** करून टाकला आणि फक्त उरलेले २ व्हेरियंट्स ठेवले.

### 2. काय उपाययोजना केली? (The Fix & Implementation)
1. **Multi-Layered Duplicate Protection:**
   - प्रत्येक प्रॉडक्ट तयार किंवा अपडेट होताना त्याला `kiyuziyu_id_<firebaseProductId>` आणि `kiyuziyu_code_<productCode>` हे युनिक टॅग्ज दिले जातात.
   - शोधताना Priority 1: `tag:"kiyuziyu_id_<id>"`, Priority 2: `title:"<name>"`, Priority 3: `sku:"<code>"` आणि Priority 4: मेटाफिल्ड तपासले जाते.
   - यामुळे आधी अस्तित्वात असलेले प्रॉडक्ट १००% अचूक सापडते आणि डुप्लिकेट न होता तेच प्रॉडक्ट अपडेट होते.
2. **Strategy Changed to `DEFAULT`:**
   - `ShopifyGraphQLClient.java` मध्ये व्हेरियंट बल्क क्रिएशनची स्ट्रॅटेजी `"REMOVE_STANDALONE_VARIANT"` वरून बदलून **`"DEFAULT"`** केली.
   - यामुळे पहिला व्हेरियंट डिलीट होत नाही आणि तिन्हीच्या तिन्ही व्हेरियंट्स (`Pwp`, `White`, `M/g`) Shopify वर व्यवस्थित ॲड होतात.
3. **Variant Inventory Quantity Fix (व्हेरियंट साठा 0 न दिसता नेमका दिसणे):**
   - **कारण:** `locations` शोधताना `isActive` व `isPrimary` फील्ड्समुळे Shopify ने `read_locations scope missing` म्हणून `ACCESS_DENIED` एरर दिली होती, ज्यामुळे `locationId` null येऊन इन्व्हेंटरी सेट करण्याचा कॉल स्किप होत होता आणि Shopify वर स्टॉक `0` दिसत होता.
   - **उपाय:** `getActiveLocationId()` मध्ये 2-Step फॉलबॅक लावला — स्कोप नसल्यास तो लगेच `query { locations(first: 10) { edges { node { id } } } }` वापरतो, ज्यामुळे अचूक लोकेशन आयडी मिळतो आणि प्रत्येक व्हेरियंटचा प्रत्यक्ष साठा (उदा. १७, ६, २) Shopify वर १००% सेट होतो.
4. **Tenant Dashboard Variation Display:**
   - [`TenantProducts.jsx`](file:///d:/Syteos%20Project/kiyuziyunew-main/src/pages/API_ADMIN/TenantProducts.jsx) मध्ये जर प्रॉडक्टला व्हेरियंट्स असतील, तर "Total" न दाखवता थेट व्हेरियंटचे नाव व स्टॉक (उदा. `Size 6: 17`, `8 size: 6`, `size 7: 2`) स्वच्छपणे दाखवले जाते. व्हेरियंट नसल्यासच `Total: X` दिसते.
5. **Cloud Run Live Deployment:**
   - हे सर्व बदल Cloud Run सर्व्हिस **`kiyuziyu-api`** (Revision: `kiyuziyu-api-00022-xl6`) वर थेट लाईव्ह डिप्लॉय केले आहेत.

---

*दस्तऐवजीकरण अद्ययावत तारीख: सप्टेंबर 2026 | Kiyuziyu Engineering Team*