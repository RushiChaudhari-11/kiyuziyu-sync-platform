const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../downloads/kiyuziyu-service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const tenantId = "tenant_7802bd5e01fb";
  const jobRef = await db.collection("apiSyncJobs").add({
      tenantId: "tenant_7802bd5e01fb",
      storeId: "kiyuziyu-test-store",
      connectionId: "sc_85d76e5db380",
      productIds: ["A5FYzOThSC5hhE4tetb7"],
      status: "QUEUED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
  });
  console.log("Created job:", jobRef.id);
  process.exit(0);
}

run().catch(console.error);
