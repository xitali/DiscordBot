# Instrukcja wdrożenia Discord Bota na serwerze Linux

## 1. Przygotowanie serwera Linux

### Instalacja Node.js i npm
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nodejs npm git

# CentOS/RHEL/Fedora
sudo dnf install -y nodejs npm git

# Sprawdź wersje
node --version  # powinno być >= 16.x
npm --version
```

### Instalacja Node.js przez NodeSource (zalecane dla najnowszych wersji)
```bash
# Ubuntu/Debian - Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL/Fedora - Node.js 20.x LTS
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
```

## 2. Klonowanie repozytorium

```bash
# Przejdź do katalogu domowego lub wybierz lokalizację
cd /home/$(whoami)

# Sklonuj repozytorium
git clone https://github.com/xitali/DiscordBot.git
cd DiscordBot

# Zainstaluj zależności
npm install
```

## 3. Konfiguracja środowiska

### Skopiuj i skonfiguruj plik .env
```bash
cp .env.example .env
nano .env  # lub vim .env
```

### Wypełnij wymagane zmienne w pliku .env:
```env
# Token bota Discord - uzyskaj go z https://discord.com/developers/applications
DISCORD_TOKEN=twoj_token_discord_bota

# ID serwera Discord
GUILD_ID=id_twojego_serwera

# ID kanału wyzwalającego tworzenie kanałów głosowych
TRIGGER_CHANNEL_ID=id_kanalu_wyzwalajacego

# ID kategorii dla kanałów głosowych (opcjonalne, zostanie utworzona automatycznie)
VOICE_CATEGORY_ID=id_kategorii_glosowej

# Konfiguracja AI (opcjonalne)
AI_PROMPT_URL=https://twoj-serwer-ai.com/api/prompt
AI_API_KEY=twoj_klucz_api_ai
```

## 4. Test uruchomienia
```bash
# Sprawdź czy bot działa poprawnie
node index.js

# Jeśli wszystko działa, zatrzymaj bot (Ctrl+C)
```

## 5. Konfiguracja auto-startu z systemd

### Utwórz plik usługi systemd
```bash
sudo nano /etc/systemd/system/discord-bot.service
```

### Zawartość pliku discord-bot.service:
```ini
[Unit]
Description=Discord Bot
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
Restart=always
RestartSec=5
User=twoja_nazwa_uzytkownika
WorkingDirectory=/home/twoja_nazwa_uzytkownika/DiscordBot
ExecStart=/usr/bin/node index.js
Environment=NODE_ENV=production

# Opcjonalne: przekierowanie logów
StandardOutput=journal
StandardError=journal
SyslogIdentifier=discord-bot

[Install]
WantedBy=multi-user.target
```

**WAŻNE:** Zamień `twoja_nazwa_uzytkownika` na rzeczywistą nazwę użytkownika!

### Aktywacja usługi
```bash
# Przeładuj konfigurację systemd
sudo systemctl daemon-reload

# Włącz usługę (uruchomi się automatycznie po restarcie)
sudo systemctl enable discord-bot

# Uruchom usługę teraz
sudo systemctl start discord-bot

# Sprawdź status
sudo systemctl status discord-bot
```

## 6. Zarządzanie usługą

### Podstawowe komendy
```bash
# Sprawdź status
sudo systemctl status discord-bot

# Uruchom
sudo systemctl start discord-bot

# Zatrzymaj
sudo systemctl stop discord-bot

# Restart
sudo systemctl restart discord-bot

# Wyłącz auto-start
sudo systemctl disable discord-bot

# Włącz auto-start
sudo systemctl enable discord-bot
```

### Sprawdzanie logów
```bash
# Ostatnie logi
sudo journalctl -u discord-bot -f

# Logi z ostatniej godziny
sudo journalctl -u discord-bot --since "1 hour ago"

# Wszystkie logi usługi
sudo journalctl -u discord-bot --no-pager
```

## 7. Aktualizacja bota

```bash
# Przejdź do katalogu bota
cd /home/$(whoami)/DiscordBot

# Zatrzymaj usługę
sudo systemctl stop discord-bot

# Pobierz najnowsze zmiany
git pull origin main

# Zainstaluj nowe zależności (jeśli są)
npm install

# Uruchom ponownie
sudo systemctl start discord-bot

# Sprawdź status
sudo systemctl status discord-bot
```

## 8. Rozwiązywanie problemów

### Bot nie uruchamia się
```bash
# Sprawdź logi błędów
sudo journalctl -u discord-bot -f

# Sprawdź czy plik .env istnieje i ma poprawne uprawnienia
ls -la .env

# Sprawdź czy Node.js jest zainstalowany
node --version
npm --version
```

### Problemy z uprawnieniami
```bash
# Upewnij się, że użytkownik ma dostęp do katalogu
sudo chown -R $(whoami):$(whoami) /home/$(whoami)/DiscordBot

# Sprawdź uprawnienia pliku .env
chmod 600 .env
```

### Bot rozłącza się często
- Sprawdź stabilność połączenia internetowego
- Zweryfikuj poprawność tokena Discord
- Sprawdź logi pod kątem błędów API

## 9. Bezpieczeństwo

### Firewall (opcjonalne)
```bash
# Ubuntu/Debian
sudo ufw enable
sudo ufw allow ssh

# CentOS/RHEL/Fedora
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --reload
```

### Backup konfiguracji
```bash
# Utwórz backup pliku .env
cp .env .env.backup

# Backup całego katalogu (bez node_modules)
tar -czf discord-bot-backup-$(date +%Y%m%d).tar.gz --exclude=node_modules DiscordBot/
```

## 10. Monitoring (opcjonalne)

### Prosty skrypt monitoringu
```bash
# Utwórz skrypt check-bot.sh
nano check-bot.sh
```

```bash
#!/bin/bash
if ! systemctl is-active --quiet discord-bot; then
    echo "$(date): Discord bot nie działa, restartowanie..." >> /var/log/discord-bot-monitor.log
    sudo systemctl restart discord-bot
fi
```

```bash
# Nadaj uprawnienia
chmod +x check-bot.sh

# Dodaj do crontab (sprawdzanie co 5 minut)
crontab -e
# Dodaj linię:
# */5 * * * * /home/twoja_nazwa_uzytkownika/DiscordBot/check-bot.sh
```

---

## Podsumowanie

Po wykonaniu tych kroków Twój Discord Bot będzie:
- ✅ Automatycznie uruchamiał się po restarcie serwera
- ✅ Automatycznie restartował się w przypadku awarii
- ✅ Logował wszystkie zdarzenia do systemd journal
- ✅ Był łatwy do zarządzania przez systemctl
- ✅ Bezpiecznie przechowywał konfigurację

**Ważne:** Pamiętaj o regularnych backupach pliku `.env` i aktualizacjach bota!