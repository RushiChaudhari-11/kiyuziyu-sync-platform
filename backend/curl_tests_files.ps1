curl.exe -s -w "\nCODE:%{http_code}" -H "X-API-Key: kyz_live_ZtwqnTfXo8_d8cad1L-40WLECAJg18W9kxz3LOt-TLg" http://localhost:8080/api/v1/products/715 > b.txt
curl.exe -s -w "\nCODE:%{http_code}" -H "X-API-Key: kyz_live_NnztWeWoGlkmEql1AzScBOGq1MvPjUkhDuU9AyQ5YeU" http://localhost:8080/api/v1/products/715 > a.txt
curl.exe -s -w "\nCODE:%{http_code}" -X POST -H "Content-Type: application/json" -d "{\`"clientName\`":\`"Test\`"}" http://localhost:8080/api/v1/internal/admin/clients > amiss.txt
curl.exe -s -w "\nCODE:%{http_code}" -X POST -H "X-Admin-Token: wrong" -H "Content-Type: application/json" -d "{\`"clientName\`":\`"Test\`"}" http://localhost:8080/api/v1/internal/admin/clients > ainv.txt
curl.exe -s -w "\nCODE:%{http_code}" -X POST -H "X-Admin-Token: my_super_secret_admin_token" -H "Content-Type: application/json" -d "{\`"clientName\`":\`"Test\`", \`"domain\`":\`"test.com\`"}" http://localhost:8080/api/v1/internal/admin/clients > aval.txt
