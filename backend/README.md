# Kiyuziyu API Backend

This is the Spring Boot REST API backend for the Kiyuziyu project.

## Requirements
- Java 17
- Maven

## Running the application locally

```bash
mvn spring-boot:run
```

The application will start on `http://localhost:8080`.

## Health Check

```bash
curl http://localhost:8080/api/v1/health
```

---

## Authentication

All public API endpoints require the `X-API-Key` header.
All admin endpoints require the `X-Admin-Token` header.

---

## Public Order API - /api/v1/orders

| Method | Path | Description |
|--------|------|-------------|
| POST   | /api/v1/orders | Create a new order |
| GET    | /api/v1/orders | List orders for the authenticated client |
| GET    | /api/v1/orders/{orderId} | Get a specific order |
| PUT    | /api/v1/orders/{orderId}/status | Update order status |
| POST   | /api/v1/orders/{orderId}/cancel | Cancel an order |

NOTE: Status update uses PUT, not PATCH.

### Create Order - POST /api/v1/orders

Headers:
- X-API-Key: <client-api-key> (required)
- Idempotency-Key: <unique-key> (optional, falls back to externalOrderId)

- color and size are REQUIRED for products with variations. Exact match only, no auto-selection.
- sellingPrice must match the client-authorized price exactly. Cannot be manipulated.

### Update Order Status - PUT /api/v1/orders/{orderId}/status

Body: { "status": "CONFIRMED" }

Valid transitions: NEW -> CONFIRMED -> SHIPPED -> DELIVERED
Cancel via the dedicated cancel endpoint.

---

## Public Product API - /api/v1/products

| Method | Path | Description |
|--------|------|-------------|
| GET    | /api/v1/products | List products (client-customized view) |
| GET    | /api/v1/products/{productCode} | Get a single product |

---

## Admin API - /api/v1/internal/admin

| Method | Path | Description |
|--------|------|-------------|
| POST   | /api/v1/internal/admin/clients | Create a new API client |
| POST   | /api/v1/internal/admin/clients/{clientId}/keys | Generate an API key |
| POST   | /api/v1/internal/admin/clients/{clientId}/suspend | Suspend a client |
| POST   | /api/v1/internal/admin/clients/{clientId}/restore | Restore a suspended client |
| POST   | /api/v1/internal/admin/clients/{clientId}/overrides | Set product override/pricing for a client |

---

## Security Rules
- NEVER hardcode Firebase service-account private keys in the code.
- NEVER commit a service-account JSON file to version control.
- NEVER expose Firebase Admin credentials to React/frontend.
- Use environment variables to supply sensitive data during runtime.
