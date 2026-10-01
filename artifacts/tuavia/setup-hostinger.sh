#!/bin/bash
# setup-hostinger.sh - Configuração automática PM2 no Hostinger
# Execute: chmod +x setup-hostinger.sh && ./setup-hostinger.sh

set -e

APP_DIR="/home/u642036020/domains/tuavia.com.br/nodejs"
LOG_DIR="/home/u642036020/domains/tuavia.com.br/logs"
DATA_DIR="/home/u642036020/domains/tuavia.com.br/data"

echo "🔧 Configurando PM2 para TuaVia no Hostinger..."

# 1. Cria diretórios necessários
mkdir -p "$LOG_DIR" "$DATA_DIR"

# 2. Inicializa arquivo de jobs se não existir
JOBS_FILE="$DATA_DIR/llm_jobs.json"
if [ ! -f "$JOBS_FILE" ]; then
  echo "[]" > "$JOBS_FILE"
  echo "✅ Criado $JOBS_FILE"
fi

# 3. Verifica PM2
if ! command -v pm2 &> /dev/null; then
  echo "📦 Instalando PM2..."
  npm install -g pm2
fi

# 4. Para processos existentes (limpeza)
pm2 delete tua-via-worker 2>/dev/null || true
pm2 delete tua-via-app 2>/dev/null || true

# 5. Inicia apps via ecosystem.config.js
cd "$APP_DIR"
pm2 start ecosystem.config.js

# 6. Salva configuração PM2
pm2 save

# 7. Configura startup automático no boot
echo "🔄 Configurando auto-start no boot..."
pm2 startup systemd -u u642036020 --hp /home/u642036020

# 8. Mostra status
pm2 list
pm2 logs --lines 20

echo ""
echo "✅ Setup completo!"
echo ""
echo "📋 Comandos úteis:"
echo "  pm2 list                    - Lista processos"
echo "  pm2 logs tua-via-worker     - Logs do worker IA"
echo "  pm2 logs tua-via-app        - Logs da aplicação"
echo "  pm2 restart tua-via-worker  - Reinicia worker"
echo "  pm2 monit                   - Monitor interativo"