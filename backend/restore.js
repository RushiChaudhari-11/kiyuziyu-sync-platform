const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/`n/g, '\n')
  })
});
admin.firestore().collection('apiClients').doc('0527368a-a2fd-43cb-8088-09a311ed0fa2').update({status: 'ACTIVE'}).then(() => {
  console.log('Restored');
  process.exit(0);
}).catch(console.error);
