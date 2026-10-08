$AdminToken = "kyz_internal_admin_secret_99"
$KeyA = "kyz_live_iweyeB0drCIzeMJLPhkNoCH6mDb6LZPBvNX7mDi5hXY"
$KeyB = "kyz_live_ZtwqnTfXo8_d8cad1L-40WLECAJg18W9kxz3LOt-TLg"
$ClientAId = "e1a3e2c1-4699-4239-9de6-550c32558388"
$ClientBId = "0527368a-a2fd-43cb-8088-09a311ed0fa2"

Write-Host "1. Revoke Client A Key"
$body = '{"apiKey":"' + $KeyA + '"}'
Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/v1/internal/admin/clients/keys/revoke" -Headers @{"X-Admin-Token"=$AdminToken} -ContentType "application/json" -Body $body

Write-Host "2. Test Client A (Expect 401)"
try {
    Invoke-RestMethod -Method Get -Uri "http://localhost:8080/api/v1/products/715" -Headers @{"X-API-Key"=$KeyA}
} catch {
    Write-Host $_.Exception.Response.StatusCode.value__
}

Write-Host "3. Suspend Client B"
Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/v1/internal/admin/clients/$ClientBId/suspend" -Headers @{"X-Admin-Token"=$AdminToken}

Write-Host "4. Test Client B (Expect 401)"
try {
    Invoke-RestMethod -Method Get -Uri "http://localhost:8080/api/v1/products/715" -Headers @{"X-API-Key"=$KeyB}
} catch {
    Write-Host $_.Exception.Response.StatusCode.value__
}

Write-Host "5. Test Admin Endpoint without Token (Expect 403)"
try {
    Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/v1/internal/admin/clients" -ContentType "application/json" -Body '{"clientName":"Test", "domain":"test.com"}'
} catch {
    Write-Host $_.Exception.Response.StatusCode.value__
}

Write-Host "6. Regenerate Client A Key"
Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/v1/internal/admin/clients/$ClientAId/keys" -Headers @{"X-Admin-Token"=$AdminToken} | ConvertTo-Json
