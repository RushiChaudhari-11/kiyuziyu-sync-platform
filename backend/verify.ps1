$AdminToken = "my_super_secret_admin_token"
$KeyA = "kyz_live_NnztWeWoGlkmEql1AzScBOGq1MvPjUkhDuU9AyQ5YeU"
$KeyB = "kyz_live_ZtwqnTfXo8_d8cad1L-40WLECAJg18W9kxz3LOt-TLg"

Write-Host "2. Test Client B (Expect 200 and Premium Chain)"
Invoke-RestMethod -Method Get -Uri "http://localhost:8080/api/v1/products/715" -Headers @{"X-API-Key"=$KeyB} | ConvertTo-Json -Depth 10

Write-Host "3. Test Client A (Expect 200 and Gold Chain)"
Invoke-RestMethod -Method Get -Uri "http://localhost:8080/api/v1/products/715" -Headers @{"X-API-Key"=$KeyA} | ConvertTo-Json -Depth 10

Write-Host "8. Admin endpoint unauthorized access (Missing Token) Expect 403"
try {
    Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/v1/internal/admin/clients" -ContentType "application/json" -Body '{"clientName":"Test", "domain":"test.com"}'
} catch {
    Write-Host $_.Exception.Response.StatusCode.value__
}

Write-Host "8b. Admin endpoint with invalid Token (Expect 403)"
try {
    Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/v1/internal/admin/clients" -Headers @{"X-Admin-Token"="wrong"} -ContentType "application/json" -Body '{"clientName":"Test", "domain":"test.com"}'
} catch {
    Write-Host $_.Exception.Response.StatusCode.value__
}
