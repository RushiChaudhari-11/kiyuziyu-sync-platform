const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./downloads/kiyuziyu-service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkFailedJobs() {
    const snapshot = await db.collection('apiSyncJobs')
        .where('status', '==', 'FAILED')
        .get();
        
    const jobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    jobs.sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const db = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return db.getTime() - da.getTime();
    });
        
    jobs.slice(0, 3).forEach(job => {
        console.log('\n--- Job ID:', job.id);
        console.log(JSON.stringify(job, null, 2));
    });
}
checkFailedJobs().catch(console.error);
