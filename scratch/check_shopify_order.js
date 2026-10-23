const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../downloads/kiyuziyu-service-account.json');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function check() {
  const conns = await db.collection('apiShopifyConnections').get();
  for (const d of conns.docs) {
    const data = d.data();
    console.log('Connection:', d.id, data.shopifyStoreDomain, data.tenantId, data.storeId);
    const domain = data.shopifyStoreDomain;
    const token = data.accessToken;
    if (!token) continue;

    const query = `query {
      product(id: "gid://shopify/Product/10241636598016") {
        id
        title
        variants(first: 10) {
          edges {
            node {
              id
              title
              sku
              inventoryQuantity
              selectedOptions {
                name
                value
              }
            }
          }
        }
      }
      order(id: "gid://shopify/Order/7261775888640") {
        id
        name
        lineItems(first: 10) {
          edges {
            node {
              id
              title
              variantTitle
              sku
              quantity
              variant {
                id
                title
                sku
                product {
                  id
                }
              }
            }
          }
        }
      }
    }`;

    try {
      const res = await fetch(`https://${domain}/admin/api/2024-04/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token
        },
        body: JSON.stringify({ query })
      });
      const json = await res.json();
      console.log('Shopify result:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.error(e);
    }
  }
}
check();

