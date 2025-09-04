# Discord Voice Channel Bot

Bot Discord do automatycznego tworzenia kanałów głosowych dla użytkowników. Gdy użytkownik dołączy do określonego kanału "trigger", automatycznie zostanie utworzony dla niego prywatny kanał głosowy.

## 🚀 Funkcjonalności

### Kanały głosowe
- **Automatyczne tworzenie kanałów**: Gdy użytkownik dołączy do kanału trigger, tworzy się nowy kanał głosowy
- **Personalizowane nazwy**: Kanały mają format `[BF6] {displayname}` gdzie displayname to nazwa użytkownika na serwerze
- **Uprawnienia właściciela**: Twórca kanału może zmieniać jego nazwę i ustawiać limit osób (2-5, domyślnie 5)
- **Automatyczne usuwanie**: Puste kanały są automatycznie usuwane po 5 sekundach
- **Komendy administratora**: Administratorzy mogą zmieniać nazwy kanałów i prefix przez komendy slash
- **Konfigurowalny prefix**: Możliwość zmiany prefiksu kanałów z domyślnego `[BF6]`

### Reaction Roles
- **Automatyczne przydzielanie ról**: Użytkownicy otrzymują role po dodaniu reakcji do określonych wiadomości
- **Usuwanie ról**: Role są automatycznie usuwane po usunięciu reakcji
- **Konfiguracja przez administratorów**: Administratorzy mogą konfigurować reaction roles przez komendę `/auth`
- **Wsparcie dla emoji**: Obsługa zarówno standardowych emoji jak i niestandardowych emoji serwera

### Newsy Battlefield 6
- **Automatyczne pobieranie**: System automatycznie sprawdza newsy z gry Battlefield 6 co 30 minut
- **Filtrowanie treści**: Inteligentne filtrowanie artykułów związanych z Battlefield z różnych źródeł
- **Dedykowany kanał**: Newsy są wysyłane na określony kanał tekstowy
- **Bogate embedy**: Newsy są prezentowane w czytelnych embedach z informacjami o źródle i dacie
- **Unikanie duplikatów**: System pamięta ostatnie 100 newsów aby uniknąć powtórzeń

## 📋 Wymagania

- Node.js 16.9.0 lub nowszy
- Konto Discord Developer z utworzoną aplikacją bot
- Serwer Discord z uprawnieniami administratora

## 🛠️ Instalacja

### 1. Klonowanie projektu
```bash
git clone <repository-url>
cd DiscordBot
```

### 2. Instalacja zależności
```bash
npm install
```

### 3. Konfiguracja bota Discord

1. Przejdź do [Discord Developer Portal](https://discord.com/developers/applications)
2. Utwórz nową aplikację lub wybierz istniejącą
3. W sekcji "Bot" skopiuj token bota
4. W sekcji "OAuth2 > URL Generator":
   - Zaznacz scope: `bot` i `applications.commands`
   - Zaznacz uprawnienia bota:
     - `Manage Channels`
     - `Connect`
     - `Move Members`
     - `View Channels`
     - `Use Slash Commands`

### 4. Konfiguracja środowiska

Skopiuj plik `.env` i uzupełnij wymagane wartości:

```env
# Token bota Discord
DISCORD_TOKEN=your_bot_token_here

# ID serwera Discord (opcjonalne, przyspiesza rejestrację komend)
GUILD_ID=your_guild_id_here

# ID kanału głosowego "trigger"
TRIGGER_CHANNEL_ID=your_trigger_channel_id_here

# ID kategorii dla nowych kanałów (opcjonalne)
VOICE_CATEGORY_ID=your_category_id_here

# Prefix kanałów (opcjonalne, domyślnie [BF6])
CHANNEL_PREFIX=[BF6]

# ID kanału dla newsów Battlefield 6 (wymagane dla funkcji newsów)
BF6_NEWS_CHANNEL_ID=1412920468540883026
```

### 5. Jak uzyskać ID kanałów i serwera

1. Włącz "Tryb dewelopera" w Discord (Ustawienia > Zaawansowane > Tryb dewelopera)
2. Kliknij prawym przyciskiem na serwer/kanał i wybierz "Kopiuj ID"

## 🚀 Uruchomienie

### Tryb produkcyjny
```bash
npm start
```

### Tryb deweloperski (z automatycznym restartowaniem)
```bash
npm run dev
```

## 📖 Komendy

### Dla użytkowników

#### `/channel limit <liczba>`
Ustawia limit osób w swoim kanale głosowym (tylko wartości: 2, 3, 4, 5)

**Przykład:**
```
/channel limit 4
```

#### `/channel rename <nazwa>`
Zmienia nazwę swojego kanału głosowego

**Przykład:**
```
/channel rename Moja Drużyna
```

### Dla administratorów

#### `/config name <stara_nazwa> <nowa_nazwa>`
Zmienia nazwę istniejącego kanału głosowego

**Przykład:**
```
/config name "Jan Kowalski" "Kapitan Jan"
```

#### `/auth <kanał> <message_id> <emoji> <rola>`
Konfiguruje reaction roles - użytkownicy otrzymają określoną rolę po dodaniu reakcji do wiadomości

**Parametry:**
- `kanał` - kanał tekstowy gdzie znajduje się wiadomość
- `message_id` - ID wiadomości do której mają reagować użytkownicy
- `emoji` - emoji które ma być używane (np. 👍 lub :custom_emoji:)
- `rola` - nazwa roli która ma być przydzielana

**Przykład:**
```
/auth #ogłoszenia 1234567890123456789 👍 "Zweryfikowany"
```

#### `/config prefix <nowy_prefix>`
Zmienia prefix dla nowo tworzonych kanałów

**Przykład:**
```
/config prefix [SQUAD]
```

### System newsów Battlefield 6

System newsów działa automatycznie i nie wymaga żadnych komend. Po uruchomieniu bota:

- **Automatyczne sprawdzanie**: Co 30 minut bot sprawdza najnowsze newsy z różnych źródeł
- **Źródła newsów**: GameSpot, IGN, Polygon i inne renomowane serwisy gamingowe
- **Filtrowanie**: Tylko artykuły zawierające słowa kluczowe związane z Battlefield
- **Kanał docelowy**: Newsy są wysyłane na kanał o ID `1412920468540883026`
- **Format wiadomości**: Bogate embedy z tytułem, opisem, źródłem i datą publikacji

**Uwaga**: Upewnij się, że bot ma uprawnienia do wysyłania wiadomości na kanale newsów.

## 🔧 Konfiguracja serwera

### 1. Utworzenie kanału trigger
1. Utwórz nowy kanał głosowy (np. "🎮 Dołącz aby utworzyć kanał")
2. Skopiuj jego ID i wklej do `.env` jako `TRIGGER_CHANNEL_ID`

### 2. Utworzenie kategorii (opcjonalne)
1. Utwórz kategorię dla kanałów głosowych (np. "Kanały Graczy")
2. Skopiuj jej ID i wklej do `.env` jako `VOICE_CATEGORY_ID`

### 3. Uprawnienia bota
Upewnij się, że bot ma następujące uprawnienia:
- Zarządzanie kanałami
- Łączenie z kanałami głosowymi
- Przenoszenie członków
- Przeglądanie kanałów
- Używanie komend slash
- Zarządzanie rolami (dla reaction roles)
- Czytanie historii wiadomości (dla reaction roles)
- Dodawanie reakcji (dla reaction roles)
- Wysyłanie wiadomości (dla newsów BF6)
- Osadzanie linków (dla newsów BF6)

## 🐛 Rozwiązywanie problemów

### Bot nie odpowiada na komendy
- Sprawdź czy bot ma uprawnienia `Use Slash Commands`
- Upewnij się, że `GUILD_ID` jest poprawne (jeśli używane)
- Poczekaj do godziny na rejestrację komend globalnych

### Kanały nie są tworzone
- Sprawdź czy `TRIGGER_CHANNEL_ID` jest poprawne
- Upewnij się, że bot ma uprawnienia `Manage Channels`
- Sprawdź czy kategoria (jeśli używana) istnieje

### Bot nie może usuwać kanałów
- Sprawdź uprawnienia bota w kategorii kanałów
- Upewnij się, że bot ma wyższe role niż użytkownicy

### Reaction roles nie działają
- Sprawdź czy bot ma uprawnienie `Manage Roles`
- Upewnij się, że rola bota jest wyżej niż role które ma przydzielać
- Sprawdź czy ID wiadomości jest poprawne
- Upewnij się, że bot ma dostęp do kanału z wiadomością
- Sprawdź czy emoji jest poprawne (dla niestandardowych emoji użyj formatu `<:nazwa:id>`)

### Newsy Battlefield 6 nie działają
- Sprawdź czy kanał o ID `1412920468540883026` istnieje
- Upewnij się, że bot ma uprawnienia do wysyłania wiadomości na tym kanale
- Sprawdź połączenie internetowe serwera
- Sprawdź logi - mogą wystąpić tymczasowe problemy z RSS feeds
- Upewnij się, że zależności `rss-parser` i `node-cron` są zainstalowane

### Logi błędów
Bot wyświetla szczegółowe logi w konsoli. Sprawdź je w przypadku problemów.

## 📝 Struktura projektu

```
DiscordBot/
├── index.js          # Główny plik bota
├── commands.js       # Definicje komend slash
├── package.json      # Zależności i skrypty
├── .env             # Konfiguracja środowiska
├── .gitignore       # Pliki ignorowane przez git
└── README.md        # Dokumentacja
```

## 🔒 Bezpieczeństwo

- **Nigdy nie udostępniaj** pliku `.env` ani tokenu bota
- Regularnie sprawdzaj uprawnienia bota
- Używaj najniższych możliwych uprawnień
- Monitoruj logi pod kątem podejrzanej aktywności

## 📄 Licencja

MIT License - możesz swobodnie używać, modyfikować i dystrybuować ten kod.

## 🤝 Wsparcie

Jeśli napotkasz problemy:
1. Sprawdź sekcję "Rozwiązywanie problemów"
2. Przejrzyj logi w konsoli
3. Upewnij się, że wszystkie ID są poprawne
4. Sprawdź uprawnienia bota na serwerze

---

**Autor:** Discord Voice Channel Bot  
**Wersja:** 1.0.0  
**Ostatnia aktualizacja:** 2024