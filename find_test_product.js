const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  })
});

const db = getFirestore();

async function run() {
  const collections = await db.collection('collections').get();
  for (let col of collections.docs) {
    const subcollections = await col.ref.collection('subcollections').get();
    for (let sub of subcollections.docs) {
      const products = await sub.ref.collection('products').get();
      for (let p of products.docs) {
        let data = p.data();
        let total = 0;
        if (data.variations && data.variations.length > 0) {
            total = data.variations.reduce((sum, v) => sum + (parseInt(v.quantity)||0), 0);
        } else if (data.quantity) {
            total = parseInt(data.quantity);
        }
        if (total > 5) {
            console.log(`Found product: ${data.productCode}, name: ${data.productName}, stock: ${total}, col: ${col.id}, sub: ${sub.id}`);
            if (data.variations) console.log(data.variations);
            process.exit(0);
        }
      }
    }
  }
  console.log('No product found');
}
run();
