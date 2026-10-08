const admin = require('firebase-admin');
const serviceAccount = require('../downloads/kiyuziyu-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function checkFailedJobs() {
    const jobs = await db.collection('apiSyncJobs')
        .where('status', '==', 'FAILED')
        .orderBy('createdAt', 'desc')
        .limit(3)
        .get();
        
    jobs.forEach(doc => {
        console.log('\n--- Job ID:', doc.id);
        console.log(JSON.stringify(doc.data(), null, 2));
    });
}
checkFailedJobs().catch(console.error);
