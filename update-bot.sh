#!/bin/bash

# Skrypt aktualizacji Discord Bota
# Użycie: ./update-bot.sh

set -e

echo "🔄 Aktualizacja Discord Bota..."

# Sprawdź czy jesteśmy w katalogu z botem
if [ ! -f "index.js" ] || [ ! -f "package.json" ]; then
    echo "❌ Nie znaleziono plików bota (index.js, package.json)"
    echo "   Upewnij się, że jesteś w katalogu DiscordBot"
    exit 1
fi

# Sprawdź czy usługa istnieje
if ! systemctl list-unit-files | grep -q "discord-bot.service"; then
    echo "❌ Usługa discord-bot nie jest zainstalowana!"
    echo "   Uruchom najpierw: ./install-service.sh"
    exit 1
fi

# Zatrzymaj usługę
echo "⏹️  Zatrzymywanie bota..."
sudo systemctl stop discord-bot

# Sprawdź status git
echo "📡 Sprawdzanie aktualizacji..."
git fetch origin

# Sprawdź czy są nowe commity
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo "✅ Bot jest już w najnowszej wersji!"
    echo "▶️  Uruchamianie bota..."
    sudo systemctl start discord-bot
    exit 0
fi

# Pokaż zmiany
echo "📋 Nowe zmiany:"
git log --oneline $LOCAL..$REMOTE

# Backup pliku .env
if [ -f ".env" ]; then
    echo "💾 Tworzenie backupu .env..."
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
fi

# Pobierz zmiany
echo "⬇️  Pobieranie zmian..."
git pull origin main

# Sprawdź czy package.json się zmienił
if git diff --name-only $LOCAL $REMOTE | grep -q "package.json"; then
    echo "📦 Aktualizowanie zależności..."
    npm install
fi

# Sprawdź czy .env.example się zmienił
if git diff --name-only $LOCAL $REMOTE | grep -q ".env.example"; then
    echo "⚠️  Plik .env.example został zaktualizowany!"
    echo "   Sprawdź czy potrzebujesz dodać nowe zmienne do .env:"
    echo "   diff .env .env.example"
fi

# Uruchom ponownie usługę
echo "▶️  Uruchamianie bota..."
sudo systemctl start discord-bot

# Sprawdź status
echo ""
echo "📊 Status po aktualizacji:"
sudo systemctl status discord-bot --no-pager -l

echo ""
echo "✅ Aktualizacja zakończona!"
echo ""
echo "📝 Sprawdź logi jeśli coś nie działa:"
echo "   sudo journalctl -u discord-bot -f"