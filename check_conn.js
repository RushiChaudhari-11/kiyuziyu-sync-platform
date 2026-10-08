const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./downloads/kiyuziyu-service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkConn() {
    const doc = await db.collection('apiShopifyConnections').doc('sc_85d76e5db380').get();
    console.log("Exists?", doc.exists);
    if (doc.exists) console.log(JSON.stringify(doc.data(), null, 2));
}
checkConn().catch(console.error);
