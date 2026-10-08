const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../downloads/kiyuziyu-service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function getLatestFailedJob() {
  const snapshot = await db.collection('apiUsers')
    .doc('AZoEXrHnwFgqZ4hoVKkJ6BJN5Bi1') // User UID from the logs
    .collection('tenantId') // Or wait, apiUsers/{uid} has tenantId field?
    // Let me query apiSyncJobs directly if it's a top level collection, but it's likely a subcollection.
    // The instructions say "inspect the latest apiSyncJobs record for: tenantId: tenant_7802bd5e01fb". 
    // Let's use collectionGroup.
    .get();
}

async function queryCollectionGroup() {
  console.log("Querying apiSyncJobs...");
  const snapshot = await db.collection('apiSyncJobs')
    .where('tenantId', '==', 'tenant_7802bd5e01fb')
    .get();

  if (snapshot.empty) {
    console.log("No jobs found");
    return;
  }

  const docs = snapshot.docs.map(d => d.data());
  docs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const job = docs[0];
  console.log(JSON.stringify(job, null, 2));
}

queryCollectionGroup().catch(console.error).finally(() => process.exit(0));
