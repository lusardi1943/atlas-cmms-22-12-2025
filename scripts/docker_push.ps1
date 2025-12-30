# Script para construir y subir imágenes a Docker Hub
# Usuario: lusardi1943
# Tag: V6.22.12.25

Write-Host "Iniciando construcción de imágenes..." -ForegroundColor Cyan
docker compose build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error durante la construcción de las imágenes." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Imágenes construidas con éxito. Iniciando subida a Docker Hub..." -ForegroundColor Cyan

Write-Host "Subiendo imagen del Backend..." -ForegroundColor Yellow
docker push lusardi1943/atlas-cmms-backend:V6.22.12.25

Write-Host "Subiendo imagen del Frontend..." -ForegroundColor Yellow
docker push lusardi1943/atlas-cmms-frontend:V6.22.12.25

Write-Host "¡Proceso completado con éxito!" -ForegroundColor Green
