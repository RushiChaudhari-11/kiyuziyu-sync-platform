const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./downloads/kiyuziyu-service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkConns() {
    const snapshot = await db.collection('apiShopifyConnections')
        .where('tenantId', '==', 'tenant_7802bd5e01fb')
        .get();
    
    snapshot.docs.forEach(doc => {
        console.log("Conn:", doc.id, doc.data().updatedAt, doc.data().accessToken ? "HAS TOKEN" : "NO TOKEN");
    });
}
checkConns().catch(console.error);
