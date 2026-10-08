const http = require('http');

const request = (path, method, headers, body) => new Promise((resolve) => {
  const req = http.request({
    hostname: 'localhost',
    port: 8080,
    path,
    method,
    headers
  }, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => resolve({ status: res.statusCode, data }));
  });
  if (body) req.write(JSON.stringify(body));
  req.end();
});

async function run() {
  const b = await request('/api/v1/products/715', 'GET', { 'X-API-Key': 'kyz_live_ZtwqnTfXo8_d8cad1L-40WLECAJg18W9kxz3LOt-TLg' });
  console.log('Client B:', b.status, b.data.substring(0, 100));

  const a = await request('/api/v1/products/715', 'GET', { 'X-API-Key': 'kyz_live_NnztWeWoGlkmEql1AzScBOGq1MvPjUkhDuU9AyQ5YeU' });
  console.log('Client A:', a.status, a.data.substring(0, 100));

  const amiss = await request('/api/v1/internal/admin/clients', 'POST', { 'Content-Type': 'application/json' }, { clientName: 'Test' });
  console.log('Admin Miss:', amiss.status, amiss.data);

  const ainv = await request('/api/v1/internal/admin/clients', 'POST', { 'X-Admin-Token': 'wrong', 'Content-Type': 'application/json' }, { clientName: 'Test' });
  console.log('Admin Inv:', ainv.status, ainv.data);

  const aval = await request('/api/v1/internal/admin/clients', 'POST', { 'X-Admin-Token': 'my_super_secret_admin_token', 'Content-Type': 'application/json' }, { clientName: 'Test', domain: 'test.com' });
  console.log('Admin Val:', aval.status, aval.data);
}
run();
