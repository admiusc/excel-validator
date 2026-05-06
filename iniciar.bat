@echo off
echo Iniciando Excel Validator...

cd /d "%~dp0"

if not exist "server\node_modules" (
  echo Instalando dependencias del servidor...
  cd server && npm install && cd ..
)

if not exist "client\node_modules" (
  echo Instalando dependencias del cliente...
  cd client && npm install && cd ..
)

echo.
echo Abriendo en http://localhost:5173
echo Presiona Ctrl+C para detener
echo.

start "Backend" cmd /k "cd /d %~dp0server && node server.js"
timeout /t 2 /nobreak >nul
start "Frontend" cmd /k "cd /d %~dp0client && npm run dev"
timeout /t 3 /nobreak >nul
start http://localhost:5173
