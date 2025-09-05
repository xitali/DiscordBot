const fs = require('fs');
const path = require('path');

// Lista wulgaryzmów
const PROFANITY_LIST = [
    'kurwa',
    'chuj', 'chuja', 'chujek', 'chujnia', 'chujowy',
    'pierdol', 'pierdolić', 'pierdolenie',
    'jebać', 'jebany', 'jebane', 'jebaniec', 'jebanka',
    'suka', 'sukinsyn', 'sukinsynu',
    'cipa', 'cipka', 'cipsko',
    'pizda', 'pizdeczka',
    'dziwka', 'dziweczka', 'dziwisko',
    'skurwysyn', 'skurwiel', 'skurwysynu',
    'zajebać',
    'pojebany', 'pojebane', 'pojebaniec',
    'spierdalaj', 'spierdolić', 'spierdolenie'
];

// Domyślna konfiguracja
const DEFAULT_CONFIG = {
    profanityFilter: {
        enabled: false, // Domyślnie wyłączone
        action: 'warn', // delete, warn, timeout, kick, ban
        timeoutDuration: 300000, // 5 minut w milisekundach
        exemptRoles: ['Admin'],
        exemptChannels: []
    },
    spamProtection: {
        enabled: true,
        maxMessages: 5,
        timeWindow: 10000, // 10 sekund
        action: 'timeout',
        timeoutDuration: 60000, // 60 sekund
        exemptRoles: ['Admin'],
        exemptChannels: []
    }
};

// Ścieżki do plików
const CONFIG_FILE = path.join(__dirname, 'automod_config.json');
const HISTORY_FILE = path.join(__dirname, 'moderation_history.json');
const SPAM_TRACKER_FILE = path.join(__dirname, 'spam_tracker.json');
const PROFANITY_WARNINGS_FILE = path.join(__dirname, 'profanity_warnings.json');
const SPAM_PENALTIES_FILE = path.join(__dirname, 'spam_penalties.json');

// Ładowanie konfiguracji
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
        }
    } catch (error) {

    }
    return DEFAULT_CONFIG;
}

// Zapisywanie konfiguracji
function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    } catch (error) {

    }
}

// Ładowanie historii moderacji
function loadModerationHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {

    }
    return {}; // Zwracaj obiekt zamiast tablicy dla nowego formatu
}

// Zapisywanie historii moderacji
function saveModerationHistory(history) {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    } catch (error) {

    }
}

// Dodawanie wpisu do historii
function addModerationEntry(userId, action, reason, moderator = 'AutoMod') {
    const history = loadModerationHistory();
    const entry = {
        id: Date.now().toString(),
        type: action,
        reason,
        moderator: typeof moderator === 'object' ? moderator.id : moderator,
        timestamp: new Date().toISOString(),
        duration: null
    };
    
    // Jeśli history jest tablicą (stary format), konwertuj do nowego formatu
    if (Array.isArray(history)) {
        const newHistory = {};
        history.forEach(oldEntry => {
            if (!newHistory[oldEntry.userId]) {
                newHistory[oldEntry.userId] = [];
            }
            newHistory[oldEntry.userId].push({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                type: oldEntry.action,
                reason: oldEntry.reason,
                moderator: oldEntry.moderator,
                timestamp: oldEntry.timestamp,
                duration: null
            });
        });
        saveModerationHistory(newHistory);
        
        // Dodaj nowy wpis
        if (!newHistory[userId]) {
            newHistory[userId] = [];
        }
        newHistory[userId].push(entry);
        saveModerationHistory(newHistory);
        return entry;
    }
    
    // Nowy format - obiekt z kluczami użytkowników
    if (!history[userId]) {
        history[userId] = [];
    }
    history[userId].push(entry);
    saveModerationHistory(history);
    return entry;
}

// Sprawdzanie czy wiadomość zawiera wulgaryzmy
function containsProfanity(message) {
    const lowerMessage = message.toLowerCase();
    return PROFANITY_LIST.some(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        return regex.test(lowerMessage);
    });
}

// Ładowanie trackera spamu
function loadSpamTracker() {
    try {
        if (fs.existsSync(SPAM_TRACKER_FILE)) {
            const data = fs.readFileSync(SPAM_TRACKER_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Błąd ładowania trackera spamu:', error);
    }
    return {};
}

// Zapisywanie trackera spamu
function saveSpamTracker(tracker) {
    try {
        fs.writeFileSync(SPAM_TRACKER_FILE, JSON.stringify(tracker, null, 2));
    } catch (error) {
        console.error('Błąd zapisywania spam tracker:', error);
    }
}

// Funkcje do zarządzania dziennymi ostrzeżeniami za przekleństwa
function loadProfanityWarnings() {
    try {
        if (fs.existsSync(PROFANITY_WARNINGS_FILE)) {
            const data = fs.readFileSync(PROFANITY_WARNINGS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {

    }
    return {};
}

function saveProfanityWarnings(warnings) {
    try {
        fs.writeFileSync(PROFANITY_WARNINGS_FILE, JSON.stringify(warnings, null, 2));
    } catch (error) {

    }
}

function addProfanityWarning(userId) {
    const warnings = loadProfanityWarnings();
    const now = new Date();
    
    if (!warnings[userId]) {
        warnings[userId] = [];
    }
    
    // Dodaj nowe ostrzeżenie z timestampem
    warnings[userId].push({
        timestamp: now.getTime(),
        date: now.toISOString()
    });
    
    // Usuń ostrzeżenia starsze niż 24 godziny
    const twentyFourHoursAgo = now.getTime() - (24 * 60 * 60 * 1000);
    warnings[userId] = warnings[userId].filter(warning => warning.timestamp > twentyFourHoursAgo);
    
    saveProfanityWarnings(warnings);
    
    return warnings[userId].length;
}

function getProfanityWarningsToday(userId) {
    const warnings = loadProfanityWarnings();
    const now = new Date();
    const twentyFourHoursAgo = now.getTime() - (24 * 60 * 60 * 1000);
    
    if (!warnings[userId]) {
        return 0;
    }
    
    // Filtruj ostrzeżenia z ostatnich 24 godzin
    const recentWarnings = warnings[userId].filter(warning => {
        // Obsługa starych formatów (string) i nowych (obiekt z timestampem)
        if (typeof warning === 'string') {
            const warningDate = new Date(warning);
            return warningDate.getTime() > twentyFourHoursAgo;
        } else if (warning.timestamp) {
            return warning.timestamp > twentyFourHoursAgo;
        }
        return false;
    });
    
    return recentWarnings.length;
}

function cleanOldWarnings() {
    const warnings = loadProfanityWarnings();
    const now = new Date();
    const twentyFourHoursAgo = now.getTime() - (24 * 60 * 60 * 1000);
    
    for (const userId in warnings) {
        if (Array.isArray(warnings[userId])) {
            // Nowy format - tablica z timestampami
            warnings[userId] = warnings[userId].filter(warning => {
                if (warning.timestamp) {
                    return warning.timestamp > twentyFourHoursAgo;
                }
                return false;
            });
        } else {
            // Stary format - obiekt z datami jako kluczami - konwertuj do nowego formatu
            const newWarnings = [];
            for (const date in warnings[userId]) {
                const warningDate = new Date(date);
                if (warningDate.getTime() > twentyFourHoursAgo) {
                    // Dodaj każde ostrzeżenie z tego dnia jako osobny wpis
                    const count = warnings[userId][date];
                    for (let i = 0; i < count; i++) {
                        newWarnings.push({
                            timestamp: warningDate.getTime(),
                            date: warningDate.toISOString()
                        });
                    }
                }
            }
            warnings[userId] = newWarnings;
        }
        
        // Usuń użytkowników bez ostrzeżeń
        if (warnings[userId].length === 0) {
            delete warnings[userId];
        }
    }
    
    saveProfanityWarnings(warnings);
}

// Ładowanie kar za spam
function loadSpamPenalties() {
    try {
        if (fs.existsSync(SPAM_PENALTIES_FILE)) {
            const data = fs.readFileSync(SPAM_PENALTIES_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        
    }
    return {};
}

// Zapisywanie kar za spam
function saveSpamPenalties(penalties) {
    try {
        fs.writeFileSync(SPAM_PENALTIES_FILE, JSON.stringify(penalties, null, 2));
    } catch (error) {
        
    }
}

// Dodawanie kary za spam
function addSpamPenalty(userId) {
    const penalties = loadSpamPenalties();
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    if (!penalties[userId]) {
        penalties[userId] = [];
    }
    
    // Usuń stare kary (starsze niż godzina)
    penalties[userId] = penalties[userId].filter(penalty => penalty.timestamp > oneHourAgo);
    
    // Dodaj nową karę
    penalties[userId].push({
        timestamp: now,
        type: 'spam'
    });
    
    saveSpamPenalties(penalties);
    return penalties[userId].length;
}

// Sprawdzanie liczby kar za spam w ostatniej godzinie
function getSpamPenaltiesInHour(userId) {
    const penalties = loadSpamPenalties();
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    if (!penalties[userId]) {
        return 0;
    }
    
    const recentPenalties = penalties[userId].filter(penalty => penalty.timestamp > oneHourAgo);
    return recentPenalties.length;
}

// Sprawdzanie spamu
function checkSpam(userId, config) {
    const tracker = loadSpamTracker();
    const now = Date.now();
    
    if (!tracker[userId]) {
        tracker[userId] = [];
    }
    
    // Usuwanie starych wiadomości spoza okna czasowego
    tracker[userId] = tracker[userId].filter(timestamp => 
        now - timestamp < config.spamProtection.timeWindow
    );
    
    // Dodawanie nowej wiadomości
    tracker[userId].push(now);
    
    // Sprawdzanie czy przekroczono limit
    const isSpam = tracker[userId].length > config.spamProtection.maxMessages;
    
    saveSpamTracker(tracker);
    return isSpam;
}

// Sprawdzanie czy użytkownik jest zwolniony
function isExempt(member, config, type = 'profanityFilter') {
    if (!member || !member.roles) return false;
    
    const exemptRoles = config[type].exemptRoles || [];
    
    // Sprawdzanie ról użytkownika
    const hasExemptRole = member.roles.cache.some(role => 
        exemptRoles.includes(role.name)
    );
    
    return hasExemptRole;
}

// Sprawdzanie czy użytkownik ma chronione role
function hasProtectedRole(member) {
    if (!member || !member.roles) return false;
    
    const protectedRoles = ['Admin', 'Moderator'];
    return member.roles.cache.some(role => 
        protectedRoles.includes(role.name)
    );
}

// Wykonywanie akcji za spam
async function executeSpamAction(message, action, reason, config, penaltyCount) {
    const member = message.member;
    if (!member) return;
    
    // Sprawdź czy użytkownik ma chronioną rolę
    const isProtected = hasProtectedRole(member);
    
    try {
        if (action === 'timeout') {
            if (isProtected) {
                const protectedEmbed = {
                    color: 0xFFA500,
                    title: '🛡️ Akcja pominięta',
                    description: `${member.user} ma chronioną rolę - timeout za spam został pominięty. Wiadomości zostały usunięte.`,
                    timestamp: new Date().toISOString()
                };
                await message.channel.send({ embeds: [protectedEmbed] });
            } else {
                // Określ długość timeout na podstawie liczby kar
                const duration = penaltyCount >= 2 ? 300000 : (config.spamProtection.timeoutDuration || 60000); // 5 minut dla drugiej kary, 60s dla pierwszej
                await member.timeout(duration, reason);
                
                const timeoutEmbed = {
                    color: 0xFF8C00,
                    title: '🔇 Timeout za spam',
                    description: `${member.user} otrzymał timeout na ${Math.floor(duration/1000)} sekund za spam.\n**Kary w ciągu godziny:** ${penaltyCount}/2`,
                    timestamp: new Date().toISOString()
                };
                await message.channel.send({ embeds: [timeoutEmbed] });
                
                // Wyślij prywatną wiadomość
                try {
                    const dmEmbed = {
                        color: 0xFF8C00,
                        title: '🔇 Timeout za spam',
                        description: `Otrzymałeś timeout na ${Math.floor(duration/1000)} sekund na serwerze **${message.guild.name}** za spam.\n\n**Powód:** ${reason}\n**Kary w ciągu godziny:** ${penaltyCount}/2\n\n⚠️ **Uwaga:** Druga kara za spam w ciągu godziny skutkuje dłuższym timeout (5 minut)!`,
                        timestamp: new Date().toISOString(),
                        footer: { text: 'System Auto-Moderacji' }
                    };
                    await member.user.send({ embeds: [dmEmbed] });
                } catch (error) {
                    
                }
                
                addModerationEntry(member.user.id, 'timeout', reason);
                console.log(`🔇 KARA: Timeout dla ${member.user.tag} (ID: ${member.user.id}) - AutoMod - ${Math.floor(duration/1000)}s - ${reason}`);
            }
        } else if (action === 'kick') {
            if (isProtected) {
                const protectedEmbed = {
                    color: 0xFFA500,
                    title: '🛡️ Akcja pominięta',
                    description: `${member.user} ma chronioną rolę - wyrzucenie za spam zostało pominięte. Wiadomości zostały usunięte.`,
                    timestamp: new Date().toISOString()
                };
                await message.channel.send({ embeds: [protectedEmbed] });
            } else {
                // Wyślij prywatną wiadomość przed kickiem
                try {
                    const kickDmEmbed = {
                        color: 0xFF4500,
                        title: '👢 Zostałeś wyrzucony z serwera',
                        description: `Zostałeś automatycznie wyrzucony z serwera **${message.guild.name}** za spam.\n\n**Powód:** ${reason}\n\nMożesz wrócić na serwer, ale pamiętaj o przestrzeganiu zasad!`,
                        timestamp: new Date().toISOString(),
                        footer: { text: 'System Auto-Moderacji' }
                    };
                    await member.user.send({ embeds: [kickDmEmbed] });
                } catch (error) {
                    
                }
                
                const kickEmbed = {
                    color: 0xFF4500,
                    title: '👢 Automatyczne wyrzucenie za spam',
                    description: `${member.user.tag} został automatycznie wyrzucony za spam (${penaltyCount} kara w ciągu godziny).`,
                    timestamp: new Date().toISOString()
                };
                await message.channel.send({ embeds: [kickEmbed] });
                
                await member.kick(reason);
                addModerationEntry(member.user.id, 'auto-kick', reason);
                console.log(`👢 KARA: Kick dla ${member.user.tag} (ID: ${member.user.id}) - AutoMod - ${reason}`);
            }
        }
    } catch (error) {
        console.error(`Błąd wykonywania akcji za spam ${action}:`, error);
    }
}

// Wykonywanie akcji moderacyjnej
async function executeAction(message, action, reason, config) {
    const member = message.member;
    if (!member) return;
    
    // Sprawdź czy użytkownik ma chronioną rolę
    const isProtected = hasProtectedRole(member);
    
    try {
        switch (action) {
            case 'delete':
                await message.delete();

                break;
                
            case 'warn':
                await message.delete();
                
                // Dodaj ostrzeżenie za przekleństwo
                const warningsCount = addProfanityWarning(member.user.id);
                
                // Wyślij prywatną wiadomość z ostrzeżeniem
                try {
                    const dmEmbed = {
                        color: 0xFFFF00,
                        title: '⚠️ Ostrzeżenie za przekleństwa',
                        description: `Otrzymałeś ostrzeżenie za używanie niedozwolonych słów na serwerze **${message.guild.name}**.\n\n**Powód:** ${reason}\n**Ostrzeżenia w ciągu 24h:** ${warningsCount}/5\n\n⚠️ **Uwaga:** Po przekroczeniu 5 ostrzeżeń w ciągu 24 godzin zostaniesz automatycznie wyrzucony z serwera!`,
                        timestamp: new Date().toISOString(),
                        footer: {
                            text: 'System Auto-Moderacji'
                        }
                    };
                    await member.user.send({ embeds: [dmEmbed] });

                } catch (error) {

                }
                
                // Sprawdź czy użytkownik przekroczył limit ostrzeżeń
                if (warningsCount >= 5) {
                    
                    try {
                        // Wyślij informację o kicku
                        const kickDmEmbed = {
                            color: 0xFF4500,
                            title: '👢 Zostałeś wyrzucony z serwera',
                            description: `Zostałeś automatycznie wyrzucony z serwera **${message.guild.name}** za przekroczenie limitu ostrzeżeń za przekleństwa w ciągu 24 godzin.\n\n**Liczba ostrzeżeń w ciągu 24h:** ${warningsCount}/5\n\nMożesz wrócić na serwer, ale pamiętaj o przestrzeganiu zasad!`,
                            timestamp: new Date().toISOString(),
                            footer: {
                                text: 'System Auto-Moderacji'
                            }
                        };
                        await member.user.send({ embeds: [kickDmEmbed] });
                    } catch (error) {

                    }
                    
                    // Kick użytkownika
                    const kickEmbed = {
                        color: 0xFF4500,
                        title: '👢 Automatyczne wyrzucenie',
                        description: `${member.user.tag} został automatycznie wyrzucony za przekroczenie limitu ostrzeżeń za przekleństwa w ciągu 24 godzin (${warningsCount}/5).`,
                        timestamp: new Date().toISOString()
                    };
                    await message.channel.send({ embeds: [kickEmbed] });
                    
                    // Wyślij log do kanału moderacji
                    try {
                        const logChannel = message.guild.channels.cache.get('1412925469338107945');
                        if (logChannel) {
                            const logEmbed = {
                                color: 0xFF4500,
                                title: '👢 Automatyczne wyrzucenie za przekleństwa',
                                fields: [
                                    { name: 'Użytkownik', value: `${member.user.tag} (${member.user.id})`, inline: true },
                                    { name: 'Powód', value: `Przekroczenie limitu ostrzeżeń za przekleństwa (${warningsCount}/5)`, inline: true },
                                    { name: 'Kanał', value: `${message.channel}`, inline: true },
                                    { name: 'Ostatnia wiadomość', value: `"${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}"`, inline: false }
                                ],
                                timestamp: new Date().toISOString(),
                                footer: { text: 'System Auto-Moderacji' }
                            };
                            await logChannel.send({ embeds: [logEmbed] });
                        }
                    } catch (error) {

                    }
                    
                    await member.kick(`Automatyczny kick - przekroczenie limitu ostrzeżeń za przekleństwa w ciągu 24h (${warningsCount}/5)`);
                    addModerationEntry(member.user.id, 'auto-kick', `Przekroczenie limitu ostrzeżeń za przekleństwa w ciągu 24h (${warningsCount}/5)`);
                    console.log(`🚨 KARA: Kick dla ${member.user.tag} (ID: ${member.user.id}) - AutoMod - Przekroczenie limitu ostrzeżeń (${warningsCount}/5)`);

                } else {
                    // Zwykłe ostrzeżenie publiczne
                    const warnEmbed = {
                        color: 0xFFFF00,
                        title: '⚠️ Ostrzeżenie',
                        description: `${member.user} otrzymał ostrzeżenie za używanie niedozwolonych słów.\n**Ostrzeżenia w ciągu 24h:** ${warningsCount}/5`,
                        timestamp: new Date().toISOString()
                    };
                    await message.channel.send({ embeds: [warnEmbed] });
                    
                    // Wyślij log do kanału moderacji
                    try {
                        const logChannel = message.guild.channels.cache.get('1412925469338107945');
                        if (logChannel) {
                            const logEmbed = {
                                color: 0xFFFF00,
                                title: '⚠️ Ostrzeżenie za przekleństwa',
                                fields: [
                                    { name: 'Użytkownik', value: `${member.user.tag} (${member.user.id})`, inline: true },
                                    { name: 'Powód', value: reason, inline: true },
                                    { name: 'Kanał', value: `${message.channel}`, inline: true },
                                    { name: 'Ostrzeżenia w 24h', value: `${warningsCount}/5`, inline: true },
                                    { name: 'Wiadomość', value: `"${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}"`, inline: false }
                                ],
                                timestamp: new Date().toISOString(),
                                footer: { text: 'System Auto-Moderacji' }
                            };
                            await logChannel.send({ embeds: [logEmbed] });
                        }
                    } catch (error) {

                    }
                    
                    addModerationEntry(member.user.id, 'warn', reason);
                    console.log(`⚠️ KARA: Warn dla ${member.user.tag} (ID: ${member.user.id}) - AutoMod - ${reason} (${warningsCount}/5)`);

                }
                break;
                
            case 'timeout':
                await message.delete();
                
                if (isProtected) {
                    const protectedEmbed = {
                        color: 0xFFA500,
                        title: '🛡️ Akcja pominięta',
                        description: `${member.user} ma chronioną rolę - timeout został pominięty. Wiadomość została usunięta.`,
                        timestamp: new Date().toISOString()
                    };
                    await message.channel.send({ embeds: [protectedEmbed] });
                } else {
                    const duration = config.profanityFilter.timeoutDuration || 300000;
                    await member.timeout(duration, reason);
                    const timeoutEmbed = {
                        color: 0xFF8C00,
                        title: '🔇 Timeout',
                        description: `${member.user} otrzymał timeout na ${Math.floor(duration/60000)} minut. Powód: ${reason}`,
                        timestamp: new Date().toISOString()
                    };
                    await message.channel.send({ embeds: [timeoutEmbed] });
                    addModerationEntry(member.user.id, 'timeout', reason);
                    console.log(`🔇 KARA: Timeout dla ${member.user.tag} (ID: ${member.user.id}) - AutoMod - ${Math.floor(duration/60000)} minut - ${reason}`);
                }
                break;
                
            case 'kick':
                await message.delete();
                
                if (isProtected) {
                    const protectedEmbed = {
                        color: 0xFFA500,
                        title: '🛡️ Akcja pominięta',
                        description: `${member.user} ma chronioną rolę - wyrzucenie zostało pominięte. Wiadomość została usunięta.`,
                        timestamp: new Date().toISOString()
                    };
                    await message.channel.send({ embeds: [protectedEmbed] });
                } else {
                    const kickEmbed = {
                        color: 0xFF4500,
                        title: '👢 Wyrzucenie',
                        description: `${member.user.tag} został wyrzucony z serwera. Powód: ${reason}`,
                        timestamp: new Date().toISOString()
                    };
                    await message.channel.send({ embeds: [kickEmbed] });
                    await member.kick(reason);
                    addModerationEntry(member.user.id, 'kick', reason);
                    console.log(`👢 KARA: Kick dla ${member.user.tag} (ID: ${member.user.id}) - AutoMod - ${reason}`);
                }
                break;
                
            case 'ban':
                await message.delete();
                
                if (isProtected) {
                    const protectedEmbed = {
                        color: 0xFFA500,
                        title: '🛡️ Akcja pominięta',
                        description: `${member.user} ma chronioną rolę - zbanowanie zostało pominięte. Wiadomość została usunięta.`,
                        timestamp: new Date().toISOString()
                    };
                    await message.channel.send({ embeds: [protectedEmbed] });
                } else {
                    const banEmbed = {
                        color: 0xFF0000,
                        title: '🔨 Zbanowanie',
                        description: `${member.user.tag} został zbanowany na serwerze. Powód: ${reason}`,
                        timestamp: new Date().toISOString()
                    };
                    await message.channel.send({ embeds: [banEmbed] });
                    await member.ban({ reason });
                    addModerationEntry(member.user.id, 'ban', reason);
                    console.log(`🔨 KARA: Ban dla ${member.user.tag} (ID: ${member.user.id}) - AutoMod - ${reason}`);
                }
                break;
                
            default:
                await message.delete();
                console.log(`🗑️ Usunięto wiadomość od ${member.user.tag}: ${reason}`);
        }
    } catch (error) {
        console.error(`Błąd wykonywania akcji ${action}:`, error);
    }
}

// Główna funkcja przetwarzania wiadomości
async function processMessage(client, message) {
    // Ignorowanie botów i wiadomości prywatnych
    if (message.author.bot || !message.guild) return;
    
    // Czyść stare ostrzeżenia raz dziennie (losowo przy każdej wiadomości z 0.1% szansą)
    if (Math.random() < 0.001) {
        cleanOldWarnings();
    }
    
    const config = loadConfig();
    
    // Sprawdzanie zwolnienia z auto-moderacji
    const isProfanityExempt = isExempt(message.member, config, 'profanityFilter');
    const isSpamExempt = isExempt(message.member, config, 'spamProtection');
    
    if (isProfanityExempt && isSpamExempt) {
        return;
    }
    
    // Sprawdzanie wulgaryzmów
    if (config.profanityFilter.enabled && !isProfanityExempt) {
        if (containsProfanity(message.content)) {
            await executeAction(
                message, 
                config.profanityFilter.action, 
                'Użycie niedozwolonych słów', 
                config
            );
            return;
        }
    }
    
    // Sprawdzanie spamu
    if (config.spamProtection.enabled && !isSpamExempt) {
        if (checkSpam(message.author.id, config)) {
            // Sprawdź liczbę kar za spam w ostatniej godzinie
            const penaltiesInHour = getSpamPenaltiesInHour(message.author.id);
            
            // Usuń wiadomości użytkownika z ostatnich 10 sekund (od momentu spamowania)
            try {
                const messages = await message.channel.messages.fetch({ limit: 50 });
                const userMessages = messages.filter(msg => 
                    msg.author.id === message.author.id && 
                    Date.now() - msg.createdTimestamp < config.spamProtection.timeWindow
                );
                
                if (userMessages.size > 0) {
                    await message.channel.bulkDelete(userMessages, true);
                }
            } catch (error) {
                // Jeśli bulk delete nie działa, usuń pojedynczo
                try {
                    await message.delete();
                } catch (deleteError) {
                    
                }
            }
            
            // Dodaj karę za spam
            const totalPenalties = addSpamPenalty(message.author.id);
            
            // Określ akcję na podstawie liczby kar
            let action, reason;
            if (totalPenalties >= 2) {
                // Druga kara w godzinie = timeout 5 minut
                action = 'timeout';
                reason = `Spam - druga kara w ciągu godziny (${totalPenalties}/2)`;
            } else {
                // Pierwsza kara = timeout 60s
                action = 'timeout';
                reason = `Spam - zbyt wiele wiadomości w krótkim czasie (${totalPenalties}/2)`;
            }
            
            await executeSpamAction(message, action, reason, config, totalPenalties);
            return;
        }
    }
}

module.exports = {
    processMessage,
    loadConfig,
    saveConfig,
    loadModerationHistory,
    addModerationEntry,
    containsProfanity,
    isExempt,
    executeAction,
    loadProfanityWarnings,
    saveProfanityWarnings,
    addProfanityWarning,
    getProfanityWarningsToday,
    cleanOldWarnings,
    DEFAULT_CONFIG
};