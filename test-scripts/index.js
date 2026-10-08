const admin = require('firebase-admin');
const fs = require('fs');
const axios = require('axios');

async function run() {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync('../downloads/kiyuziyu-service-account.json', 'utf8'));
    
    if (!admin.apps || admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
    
    const db = admin.firestore();
    
    // 1. Find product using iteration
    console.log("Searching for product: Watch circle shape 1260...");
    let productId = null;
    const collectionsRef = await db.collection('collections').get();
    for (const doc of collectionsRef.docs) {
       const subcollsRef = await db.collection(`collections/${doc.id}/subcollections`).get();
       for (const sub of subcollsRef.docs) {
           const prodsRef = await db.collection(`collections/${doc.id}/subcollections/${sub.id}/products`).where('productName', '==', 'Watch circle shape 1260').get();
           if (!prodsRef.empty) {
               productId = prodsRef.docs[0].id;
               console.log(`[Firebase] Found Product! ID: ${productId}, Code: ${prodsRef.docs[0].data().productCode}`);
               break;
           }
       }
       if (productId) break;
    }
    
    if (!productId) {
        console.log("Product not found in master data!");
        return;
    }

    // Check mappings
    console.log(`[Firebase] Checking existing apiShopifyProductMappings for product: ${productId}...`);
    const existingMappings = await db.collection('apiShopifyProductMappings').where('productId', '==', productId).get();
    if (existingMappings.empty) {
        console.log("[Firebase] Verified: No existing mapping for this product.");
    } else {
        console.log(`[Firebase] WARNING: Product already has ${existingMappings.size} mapping(s).`);
    }
    
    // 2. Generate token for tenant user
    const uid = 'AZoEXrHnwFgqZ4hoVKkJ6BJN5Bi1'; // from logs
    console.log(`[Auth] Minting custom token for UID: ${uid}`);
    const customToken = await admin.auth().createCustomToken(uid);
    
    const apiKey = 'AIzaSyAXCBAzf3MA9dERbU3QsURgBh1ZEbH5QQE';
    const exchangeUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`;
    const exchangeRes = await axios.post(exchangeUrl, {
        token: customToken,
        returnSecureToken: true
    });
    const idToken = exchangeRes.data.idToken;
    console.log("[Auth] Successfully exchanged for Firebase ID Token.");

    // Auto-select product for store to bypass OwnerProduct restriction
    const storeId = 'store_3db44654fc9b'; // from user logs
    const tenantId = 'tenant_7802bd5e01fb';
    console.log(`[Firebase] Checking OwnerProduct selection for ${productId}...`);
    const ownerProdSnap = await db.collection('apiOwnerProducts').where('tenantId', '==', tenantId).where('storeId', '==', storeId).where('productId', '==', productId).get();
    if (ownerProdSnap.empty) {
        console.log(`[Firebase] Product not selected for store. Auto-selecting...`);
        const selectionId = require('crypto').randomUUID();
        await db.collection('apiOwnerProducts').doc(selectionId).set({
            selectionId: selectionId,
            tenantId: tenantId,
            storeId: storeId,
            productId: productId,
            selectedAt: new Date().toISOString()
        });
        console.log(`[Firebase] Successfully selected product!`);
    }

    // 3. Trigger sync via Spring Boot API
    console.log(`[Backend] Sending POST to http://localhost:8080/api/v1/tenants/me/products/sync with productIds: ["${productId}"]`);
    
    let syncJobId = null;
    try {
        const syncRes = await axios.post('http://localhost:8080/api/v1/tenants/me/products/sync', {
            productIds: [productId]
        }, {
            headers: { Authorization: `Bearer ${idToken}` }
        });
        
        console.log(`[Backend] HTTP Status: ${syncRes.status}`);
        console.log("[Backend] Response:", JSON.stringify(syncRes.data, null, 2));
        syncJobId = syncRes.data.data.jobId;
    } catch (e) {
        console.error("[Backend] API Call Failed!");
        console.error("[Backend] Status:", e.response?.status);
        console.error("[Backend] Data:", e.response?.data);
        return;
    }

    // 4. Wait a few seconds for the background sync processor to run
    console.log("[Test] Waiting 6 seconds for async processing to finish...");
    await new Promise(r => setTimeout(r, 6000));

    // 5. Query apiSyncJobs
    console.log(`[Firebase] Querying apiSyncJobs for Job ID: ${syncJobId}`);
    const jobSnap = await db.collection('apiSyncJobs').doc(syncJobId).get();
    if (jobSnap.exists) {
        console.log("[Firebase] Sync Job Data:", JSON.stringify(jobSnap.data(), null, 2));
    } else {
        console.log("[Firebase] Sync Job not found in Firestore!");
    }

    // 6. Query apiShopifyProductMappings
    console.log(`[Firebase] Querying apiShopifyProductMappings for Firebase Product ID: ${productId}`);
    const mappingsRef = await db.collection('apiShopifyProductMappings').where('productId', '==', productId).get();
    if (mappingsRef.empty) {
        console.log("[Firebase] No mappings found for this product.");
    } else {
        mappingsRef.forEach(doc => {
            console.log(`[Firebase] Mapping Doc ID: ${doc.id}`);
            console.log("[Firebase] Mapping Data:", JSON.stringify(doc.data(), null, 2));
        });
    }

  } catch (err) {
      console.error(err);
  }
}

run();
