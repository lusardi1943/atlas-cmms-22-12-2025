# Script para desplegar la aplicación localmente
# Este script construye las imágenes desde el código fuente y levanta los contenedores

Write-Host "Iniciando despliegue local de Atlas CMMS..." -ForegroundColor Cyan

# Detener contenedores previos si existen
# Write-Host "Deteniendo contenedores actuales..." -ForegroundColor Yellow
# docker compose down

Write-Host "Construyendo e iniciando contenedores..." -ForegroundColor Yellow
docker compose up --build -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error durante el despliegue local." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "¡Despliegue completado con éxito! La aplicación está corriendo en segundo plano." -ForegroundColor Green
Write-Host "API: http://localhost:8080" -ForegroundColor Gray
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Gray
