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
        enabled: true,
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
        timeoutDuration: 600000, // 10 minut
        exemptRoles: ['Admin'],
        exemptChannels: []
    }
};

// Ścieżki do plików
const CONFIG_FILE = path.join(__dirname, 'automod_config.json');
const HISTORY_FILE = path.join(__dirname, 'moderation_history.json');
const SPAM_TRACKER_FILE = path.join(__dirname, 'spam_tracker.json');
const PROFANITY_WARNINGS_FILE = path.join(__dirname, 'profanity_warnings.json');

// Ładowanie konfiguracji
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
        }
    } catch (error) {
        console.error('Błąd ładowania konfiguracji auto-moderacji:', error);
    }
    return DEFAULT_CONFIG;
}

// Zapisywanie konfiguracji
function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Błąd zapisywania konfiguracji auto-moderacji:', error);
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
        console.error('Błąd ładowania historii moderacji:', error);
    }
    return {}; // Zwracaj obiekt zamiast tablicy dla nowego formatu
}

// Zapisywanie historii moderacji
function saveModerationHistory(history) {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    } catch (error) {
        console.error('Błąd zapisywania historii moderacji:', error);
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
        console.error('Błąd ładowania ostrzeżeń za przekleństwa:', error);
    }
    return {};
}

function saveProfanityWarnings(warnings) {
    try {
        fs.writeFileSync(PROFANITY_WARNINGS_FILE, JSON.stringify(warnings, null, 2));
    } catch (error) {
        console.error('Błąd zapisywania ostrzeżeń za przekleństwa:', error);
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
                console.log(`🗑️ Usunięto wiadomość od ${member.user.tag}: ${reason}`);
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
                    console.log(`📨 Wysłano prywatne ostrzeżenie do ${member.user.tag}`);
                } catch (error) {
                    console.log(`❌ Nie można wysłać prywatnej wiadomości do ${member.user.tag}`);
                }
                
                // Sprawdź czy użytkownik przekroczył limit ostrzeżeń
                if (warningsCount >= 5) {
                    console.log(`🚨 ${member.user.tag} przekroczył limit ostrzeżeń (${warningsCount}/5) - automatyczny kick`);
                    
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
                        console.log(`❌ Nie można wysłać wiadomości o kicku do ${member.user.tag}`);
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
                        console.error('Błąd wysyłania logu do kanału moderacji:', error);
                    }
                    
                    await member.kick(`Automatyczny kick - przekroczenie limitu ostrzeżeń za przekleństwa w ciągu 24h (${warningsCount}/5)`);
                    addModerationEntry(member.user.id, 'auto-kick', `Przekroczenie limitu ostrzeżeń za przekleństwa w ciągu 24h (${warningsCount}/5)`);
                    console.log(`👢 Automatycznie wyrzucono ${member.user.tag} za przekroczenie limitu ostrzeżeń`);
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
                        console.error('Błąd wysyłania logu do kanału moderacji:', error);
                    }
                    
                    addModerationEntry(member.user.id, 'warn', reason);
                    console.log(`⚠️ Ostrzeżenie dla ${member.user.tag}: ${reason} (${warningsCount}/5)`);
                }
                break;
                
            case 'timeout':
                await message.delete();
                
                if (isProtected) {
                    console.log(`🛡️ Pominięto timeout dla chronionego użytkownika ${member.user.tag}`);
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
                    console.log(`🔇 Timeout dla ${member.user.tag}: ${reason}`);
                }
                break;
                
            case 'kick':
                await message.delete();
                
                if (isProtected) {
                    console.log(`🛡️ Pominięto kick dla chronionego użytkownika ${member.user.tag}`);
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
                    console.log(`👢 Wyrzucono ${member.user.tag}: ${reason}`);
                }
                break;
                
            case 'ban':
                await message.delete();
                
                if (isProtected) {
                    console.log(`🛡️ Pominięto ban dla chronionego użytkownika ${member.user.tag}`);
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
                    console.log(`🔨 Zbanowano ${member.user.tag}: ${reason}`);
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
        console.log('🧹 Wyczyszczono stare ostrzeżenia za przekleństwa');
    }
    
    const config = loadConfig();
    
    // Debug: logujemy informacje o użytkowniku
    console.log(`🔍 Auto-mod sprawdza wiadomość od: ${message.author.username}`);
    console.log(`📝 Treść: "${message.content}"`);
    console.log(`🎭 Role użytkownika: ${message.member?.roles.cache.map(r => r.name).join(', ')}`);
    
    // Sprawdzanie zwolnienia z auto-moderacji
    const isProfanityExempt = isExempt(message.member, config, 'profanityFilter');
    const isSpamExempt = isExempt(message.member, config, 'spamProtection');
    
    console.log(`🛡️ Użytkownik zwolniony z filtrowania: ${isProfanityExempt}`);
    console.log(`🛡️ Użytkownik zwolniony z ochrony przed spamem: ${isSpamExempt}`);
    
    if (isProfanityExempt && isSpamExempt) {
        console.log(`⏭️ Pomijanie auto-moderacji dla ${message.author.username}`);
        return;
    }
    
    // Sprawdzanie wulgaryzmów
    if (config.profanityFilter.enabled && !isProfanityExempt) {
        if (containsProfanity(message.content)) {
            console.log(`🚫 Wykryto wulgaryzm od ${message.author.username}`);
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
            console.log(`🚫 Wykryto spam od ${message.author.username}`);
            await executeAction(
                message, 
                config.spamProtection.action, 
                'Spam - zbyt wiele wiadomości w krótkim czasie', 
                config
            );
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