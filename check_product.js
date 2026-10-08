import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('D:/Syteos Project/kiyuziyunew-main/backend/src/main/resources/serviceAccountKey.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkProduct() {
  const colGroups = await db.collectionGroup('products').where('productCode', '==', '171').get();
  if (colGroups.empty) {
    console.log('Product 171 not found');
    return;
  }
  colGroups.forEach(doc => {
    console.log(`Doc ID: ${doc.id}, Path: ${doc.ref.path}`);
    console.log(JSON.stringify(doc.data(), null, 2));
  });
}

checkProduct().catch(console.error);
