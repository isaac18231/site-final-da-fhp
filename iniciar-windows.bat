@echo off
chcp 65001 >nul
title FHP Fibra - servidor
cd /d "%~dp0"
echo Pasta: %cd%
echo.
if not exist ".env" (
  echo Criando o arquivo .env com a conexao do TiDB...
  > ".env" echo DATABASE_URL=mysql://G6Gtbay9Est3mwR.root:IJDqC63E4bo8m18r@gateway01.sa-east-1.prod.aws.tidbcloud.com:4000/fhp_fibra
  >> ".env" echo JWT_SECRET=e8f36fcebbda197dfb69059a57a0c5c642cb78a0210cc166de7dd34a0bccf80d
  >> ".env" echo ADMIN_SENHA=Admin12345
  >> ".env" echo ATENDIMENTO_SENHA=Atende12345
  >> ".env" echo TECNICO_SENHA=Tecnico123
  >> ".env" echo MP_AMBIENTE=teste
  >> ".env" echo SITE_ORIGINS=https://isaac18231.github.io
  echo .env criado.
  echo.
)
where node >nul 2>nul || (
  echo [ERRO] Node.js nao encontrado. Instale em https://nodejs.org e rode de novo.
  pause
  exit /b 1
)
if not exist "node_modules\mysql2" (
  echo Instalando dependencias ^(so na primeira vez^)...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [ERRO] npm install falhou. Veja a mensagem acima.
    pause
    exit /b 1
  )
)
echo.
echo Abrindo o site em http://localhost:3000 ...
start "" http://localhost:3000
echo Deixe esta janela aberta. Para parar o servidor, feche-a.
echo.
node server.js
echo.
echo O servidor parou. Veja a mensagem acima.
pause
