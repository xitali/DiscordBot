#!/bin/bash

# Skrypt instalacji Discord Bota jako usługi systemd
# Użycie: ./install-service.sh

set -e

echo "🤖 Instalacja Discord Bota jako usługi systemd..."

# Sprawdź czy skrypt jest uruchamiany jako zwykły użytkownik
if [ "$EUID" -eq 0 ]; then
    echo "❌ Nie uruchamiaj tego skryptu jako root!"
    echo "   Użyj: ./install-service.sh"
    exit 1
fi

# Pobierz nazwę użytkownika i katalog
USERNAME=$(whoami)
BOT_DIR=$(pwd)

echo "👤 Użytkownik: $USERNAME"
echo "📁 Katalog bota: $BOT_DIR"

# Przejdź do katalogu bota
if [ ! -d "$BOT_DIR" ]; then
    echo "❌ Katalog bota nie istnieje: $BOT_DIR"
    exit 1
fi

cd "$BOT_DIR"

# Sprawdź czy jesteśmy w katalogu z botem
if [ ! -f "index.js" ] || [ ! -f "package.json" ]; then
    echo "❌ Nie znaleziono plików bota (index.js, package.json)"
    echo "   Upewnij się, że jesteś w katalogu DiscordBot"
    exit 1
fi

# Sprawdź czy plik .env istnieje
if [ ! -f ".env" ]; then
    echo "⚠️  Plik .env nie istnieje!"
    echo "   Skopiuj .env.example do .env i skonfiguruj go:"
    echo "   cp .env.example .env"
    echo "   nano .env"
    exit 1
fi

# Sprawdź czy Node.js jest zainstalowany
if ! command -v node &> /dev/null; then
    echo "❌ Node.js nie jest zainstalowany!"
    echo "   Zainstaluj Node.js przed kontynuowaniem"
    exit 1
fi

echo "✅ Node.js $(node --version) znaleziony"

# Sprawdź czy npm install został wykonany
if [ ! -d "node_modules" ]; then
    echo "📦 Instalowanie zależności..."
    npm install
fi

# Utwórz plik usługi systemd z odpowiednimi ścieżkami
echo "📝 Tworzenie pliku usługi systemd..."
SERVICE_FILE="/tmp/discord-bot-$USERNAME.service"

cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Discord Bot - Automatyczne zarządzanie kanałami głosowymi
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
Restart=always
RestartSec=5
User=$USERNAME
WorkingDirectory=$BOT_DIR
ExecStart=$(which node) index.js
Environment=NODE_ENV=production

# Przekierowanie logów do systemd journal
StandardOutput=journal
StandardError=journal
SyslogIdentifier=discord-bot

# Ograniczenia zasobów (opcjonalne)
MemoryMax=512M
CPUQuota=50%

# Bezpieczeństwo
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=$BOT_DIR

[Install]
WantedBy=multi-user.target
EOF

# Skopiuj plik usługi do systemd (wymaga sudo)
echo "🔐 Kopiowanie pliku usługi (wymagane hasło sudo)..."
sudo cp "$SERVICE_FILE" /etc/systemd/system/discord-bot.service
sudo chmod 644 /etc/systemd/system/discord-bot.service

# Usuń tymczasowy plik
rm "$SERVICE_FILE"

# Przeładuj systemd
echo "🔄 Przeładowywanie konfiguracji systemd..."
sudo systemctl daemon-reload

# Włącz usługę
echo "🚀 Włączanie auto-startu..."
sudo systemctl enable discord-bot

# Uruchom usługę
echo "▶️  Uruchamianie bota..."
sudo systemctl start discord-bot

# Sprawdź status
echo ""
echo "📊 Status usługi:"
sudo systemctl status discord-bot --no-pager -l

echo ""
echo "✅ Instalacja zakończona!"
echo ""
echo "🎮 Przydatne komendy:"
echo "   sudo systemctl status discord-bot    # Sprawdź status"
echo "   sudo systemctl restart discord-bot   # Restart bota"
echo "   sudo systemctl stop discord-bot      # Zatrzymaj bota"
echo "   sudo journalctl -u discord-bot -f    # Zobacz logi na żywo"
echo ""
echo "🔄 Bot będzie automatycznie uruchamiał się po restarcie serwera!"
