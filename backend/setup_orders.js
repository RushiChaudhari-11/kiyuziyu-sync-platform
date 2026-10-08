const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  })
});

const db = getFirestore();

// We know Client A is 2f9d850f-a365-4f38-bc02-4fc99db0c242 from earlier tests.
const CLIENT_A = "2f9d850f-a365-4f38-bc02-4fc99db0c242";
const CLIENT_A_API_KEY = "my_super_secret_api_key_A";
const PRODUCT_CODE = "200";

async function setupOverride() {
  const overrideRef = db.collection('clientProductOverrides').doc(`${CLIENT_A}_${PRODUCT_CODE}`);
  await overrideRef.set({
    clientId: CLIENT_A,
    productId: PRODUCT_CODE,
    productCode: PRODUCT_CODE,
    customProductName: "Test Ordered EarCuff",
    sellingPrice: 50.0,
    enabled: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  console.log("Client A override set for product " + PRODUCT_CODE);

  // Set API Key for Client A
  const hashedKey = crypto.createHash('sha256').update(CLIENT_A_API_KEY).digest('hex');
  const credRef = db.collection('apiCredentials').doc(CLIENT_A);
  await credRef.set({
    clientId: CLIENT_A,
    apiKeyHash: hashedKey, // <--- Correct field name based on ApiCredential model!
    status: "ACTIVE",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  // Set ApiClient for Client A
  const clientRef = db.collection('apiClients').doc(CLIENT_A);
  await clientRef.set({
    clientId: FieldValue.delete(), // Remove it from the payload to avoid @DocumentId crash
    clientName: "Test Client A",
    domain: "test.com",
    status: "ACTIVE",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  console.log("Client A API key and Client Profile configured.");
}

setupOverride().then(() => {
    console.log("Setup complete. Ready to run tests.");
    process.exit(0);
}).catch(console.error);
