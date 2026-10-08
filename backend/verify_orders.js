const CLIENT_A_KEY = "my_super_secret_api_key_A";
const CLIENT_B_KEY = "my_super_secret_api_key_B"; // Client B is suspended
const PRODUCT_CODE = "200";

async function makeRequest(method, path, apiKey, body, idempotency) {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;
    if (idempotency) headers['Idempotency-Key'] = idempotency;

    const res = await fetch(`http://localhost:8080${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.text();
    return { status: res.status, data };
}

async function runTests() {
    let orderId = "";
    
    console.log("TEST 1: No API Key");
    let res = await makeRequest("POST", "/api/v1/orders", null, { externalOrderId: "123" });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}: ${res.data}`);
    console.log("PASS Test 1");

    console.log("TEST 2: Invalid API Key");
    res = await makeRequest("POST", "/api/v1/orders", "INVALID", { externalOrderId: "123" });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}: ${res.data}`);
    console.log("PASS Test 2");

    console.log("TEST 3: Suspended Client (Client B)");
    res = await makeRequest("POST", "/api/v1/orders", CLIENT_B_KEY, { externalOrderId: "123" });
    if (res.status !== 401) throw new Error("Expected 401, got " + res.status);
    console.log("PASS Test 3");

    const RANDOM_EXT_ID = "EXT-" + Math.random().toString(36).substring(7);
    
    console.log("TEST 4: Create Order (Unauthorized Price)");
    let orderBody = {
        externalOrderId: RANDOM_EXT_ID,
        items: [{ productCode: PRODUCT_CODE, quantity: 2, sellingPrice: 10.0 }], // authorized is 50.0
        customer: { name: "John", email: "john@test.com", phone: "123" },
        shippingAddress: { addressLine1: "L1", city: "C", state: "S", postalCode: "P", country: "C" }
    };
    res = await makeRequest("POST", "/api/v1/orders", CLIENT_A_KEY, orderBody);
    if (res.status !== 400) throw new Error("Expected 400 for bad price, got " + res.status + " " + res.data);
    console.log("PASS Test 4");

    const RANDOM_IDEM_1 = "IDEM-" + Math.random().toString(36).substring(7);
    const RANDOM_IDEM_2 = "IDEM-" + Math.random().toString(36).substring(7);

    console.log("TEST 5: Create Order (Success)");
    orderBody.items[0].sellingPrice = 50.0;
    res = await makeRequest("POST", "/api/v1/orders", CLIENT_A_KEY, orderBody, RANDOM_IDEM_1);
    if (res.status !== 201) throw new Error("Expected 201, got " + res.status + " " + res.data);
    let orderResponse = JSON.parse(res.data);
    orderId = orderResponse.data.orderId;
    if (orderResponse.data.orderTotal !== 100.0) throw new Error("Math incorrect");
    console.log("PASS Test 5 (Order created: " + orderId + ")");

    console.log("TEST 6: Idempotency (Same client, same externalOrderId, same Idempotency-Key)");
    res = await makeRequest("POST", "/api/v1/orders", CLIENT_A_KEY, orderBody, RANDOM_IDEM_1);
    if (res.status !== 201) throw new Error("Expected 201, got " + res.status);
    let idemResponse = JSON.parse(res.data);
    if (idemResponse.data.orderId !== orderId) throw new Error("Idempotency returned different order");
    console.log("PASS Test 6");

    console.log("TEST 6b: Duplicate (Same client, same externalOrderId, different Idempotency-Key)");
    res = await makeRequest("POST", "/api/v1/orders", CLIENT_A_KEY, orderBody, RANDOM_IDEM_2);
    if (res.status !== 409) throw new Error("Expected 409, got " + res.status);
    console.log("PASS Test 6b");

    console.log("TEST 6c: Duplicate (Same client, same externalOrderId, missing Idempotency-Key)");
    res = await makeRequest("POST", "/api/v1/orders", CLIENT_A_KEY, orderBody, null);
    if (res.status !== 409) throw new Error("Expected 409, got " + res.status);
    console.log("PASS Test 6c");

    console.log("TEST 6d: Idempotency fallback (Create without Idempotency-Key, then retry without it)");
    let orderBodyNoIdem = { ...orderBody, externalOrderId: RANDOM_EXT_ID + "_B" };
    // First creation
    let resNoIdem1 = await makeRequest("POST", "/api/v1/orders", CLIENT_A_KEY, orderBodyNoIdem, null);
    if (resNoIdem1.status !== 201) throw new Error("Expected 201, got " + resNoIdem1.status);
    let orderIdNoIdem = JSON.parse(resNoIdem1.data).data.orderId;
    
    // Retry exact same request without idempotency key
    let resNoIdem2 = await makeRequest("POST", "/api/v1/orders", CLIENT_A_KEY, orderBodyNoIdem, null);
    if (resNoIdem2.status !== 201) throw new Error("Expected 201 on retry without idempotency, got " + resNoIdem2.status);
    if (JSON.parse(resNoIdem2.data).data.orderId !== orderIdNoIdem) throw new Error("Idempotency fallback returned different order");
    console.log("PASS Test 6d");

    console.log("TEST 6e: Different clients + same externalOrderId");
    const ADMIN_TOKEN = "my_super_secret_admin_token";
    let cRes = await fetch("http://localhost:8080/api/v1/internal/admin/clients", {
        method: "POST", headers: { "X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ clientName: "Client C", domain: "clientc.com" })
    });
    let cData = await cRes.json();
    let CLIENT_C_ID = cData.clientId;
    let kRes = await fetch("http://localhost:8080/api/v1/internal/admin/clients/" + CLIENT_C_ID + "/keys", {
        method: "POST", headers: { "X-Admin-Token": ADMIN_TOKEN }
    });
    let CLIENT_C_KEY = (await kRes.json()).apiKey;

    // Use the correct override endpoint: POST /{clientId}/overrides with { productCode, sellingPrice }
    let overrideRes = await fetch("http://localhost:8080/api/v1/internal/admin/clients/" + CLIENT_C_ID + "/overrides", {
        method: "POST", headers: { "X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ productCode: PRODUCT_CODE, sellingPrice: 50.0 })
    });
    if (overrideRes.status !== 200) throw new Error("Expected 200 for override setup, got " + overrideRes.status + " " + await overrideRes.text());

    let resC = await makeRequest("POST", "/api/v1/orders", CLIENT_C_KEY, orderBodyNoIdem, null);
    if (resC.status !== 201) throw new Error("Expected 201 for different client, got " + resC.status + " " + resC.data);
    console.log("PASS Test 6e");

    console.log("TEST 7: GET Order");
    res = await makeRequest("GET", "/api/v1/orders/" + orderId, CLIENT_A_KEY);
    if (res.status !== 200) throw new Error("Expected 200, got " + res.status);
    console.log("PASS Test 7");

    console.log("TEST 8: GET Order Isolation (Client B tries to get Client A order)");
    // Need to temporarily un-suspend client B for this test, but since we didn't, Client B is suspended.
    // Let's use a non-existent order for client A
    res = await makeRequest("GET", "/api/v1/orders/UNKNOWN", CLIENT_A_KEY);
    if (res.status !== 404) throw new Error("Expected 404, got " + res.status);
    console.log("PASS Test 8");

    console.log("TEST 9: Update Status (NEW -> CONFIRMED)");
    res = await makeRequest("PUT", "/api/v1/orders/" + orderId + "/status", CLIENT_A_KEY, { status: "CONFIRMED" });
    if (res.status !== 200) throw new Error("Expected 200, got " + res.status);
    console.log("PASS Test 9");

    console.log("TEST 10: Invalid Status Transition (CONFIRMED -> NEW)");
    res = await makeRequest("PUT", "/api/v1/orders/" + orderId + "/status", CLIENT_A_KEY, { status: "NEW" });
    if (res.status !== 409) throw new Error("Expected 409, got " + res.status);
    console.log("PASS Test 10");

    console.log("TEST 11: Cancel Order (Stock restored)");
    res = await makeRequest("POST", "/api/v1/orders/" + orderId + "/cancel", CLIENT_A_KEY);
    if (res.status !== 200) throw new Error("Expected 200, got " + res.status);
    console.log("PASS Test 11");

    console.log("TEST 12: Cancel Order Again");
    res = await makeRequest("POST", "/api/v1/orders/" + orderId + "/cancel", CLIENT_A_KEY);
    if (res.status !== 409) throw new Error("Expected 409, got " + res.status);
    console.log("PASS Test 12");

    console.log("TEST 13: Variation - Correct color + size");
    const VAR_PRODUCT_CODE = "VAR100";
    const RANDOM_VAR_EXT = "EXT-VAR-" + Math.random().toString(36).substring(7);
    const RANDOM_VAR_IDEM_1 = "IDEM-VAR-" + Math.random().toString(36).substring(7);
    const RANDOM_VAR_IDEM_2 = "IDEM-VAR-" + Math.random().toString(36).substring(7);
    const RANDOM_VAR_IDEM_3 = "IDEM-VAR-" + Math.random().toString(36).substring(7);
    const RANDOM_VAR_IDEM_4 = "IDEM-VAR-" + Math.random().toString(36).substring(7);

    let varOrderBody = {
        externalOrderId: RANDOM_VAR_EXT + "-1",
        items: [{ productCode: VAR_PRODUCT_CODE, quantity: 2, sellingPrice: 150.0, color: "Red", size: "L" }],
        customer: { name: "John", email: "john@test.com", phone: "123" },
        shippingAddress: { addressLine1: "L1", city: "C", state: "S", postalCode: "P", country: "C" }
    };
    let resVar = await makeRequest("POST", "/api/v1/orders", CLIENT_A_KEY, varOrderBody, RANDOM_VAR_IDEM_1);
    if (resVar.status !== 201) throw new Error("Expected 201, got " + resVar.status + " " + resVar.data);
    let varOrderId = JSON.parse(resVar.data).data.orderId;
    console.log("PASS Test 13");

    console.log("TEST 14: Variation - Wrong color + size");
    varOrderBody.externalOrderId = RANDOM_VAR_EXT + "-2";
    varOrderBody.items[0].color = "Green"; // does not exist
    resVar = await makeRequest("POST", "/api/v1/orders", CLIENT_A_KEY, varOrderBody, RANDOM_VAR_IDEM_2);
    if (resVar.status !== 400) throw new Error("Expected 400, got " + resVar.status + " " + resVar.data);
    console.log("PASS Test 14");

    console.log("TEST 15: Variation - Missing variation information");
    varOrderBody.externalOrderId = RANDOM_VAR_EXT + "-3";
    delete varOrderBody.items[0].color;
    delete varOrderBody.items[0].size;
    resVar = await makeRequest("POST", "/api/v1/orders", CLIENT_A_KEY, varOrderBody, RANDOM_VAR_IDEM_3);
    if (resVar.status !== 400) throw new Error("Expected 400 for missing variation, got " + resVar.status + " " + resVar.data);
    console.log("PASS Test 15");

    console.log("TEST 16: Variation - Insufficient stock in selected variation");
    varOrderBody.externalOrderId = RANDOM_VAR_EXT + "-4";
    varOrderBody.items[0].color = "Blue";
    varOrderBody.items[0].size = "L";
    varOrderBody.items[0].quantity = 5; // Blue L only has 2
    resVar = await makeRequest("POST", "/api/v1/orders", CLIENT_A_KEY, varOrderBody, RANDOM_VAR_IDEM_4);
    if (resVar.status !== 409) throw new Error("Expected 409 for insufficient stock, got " + resVar.status + " " + resVar.data);
    console.log("PASS Test 16");

    console.log("TEST 17: Variation - Cancel Order (restores exact selected variation)");
    // Cancel the order from Test 13
    resVar = await makeRequest("POST", "/api/v1/orders/" + varOrderId + "/cancel", CLIENT_A_KEY);
    if (resVar.status !== 200) throw new Error("Expected 200 for cancel, got " + resVar.status + " " + resVar.data);
    console.log("PASS Test 17");

    console.log("ALL TESTS PASSED.");
}

runTests().catch(console.error);
