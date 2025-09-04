require('dotenv').config();
const { Client, GatewayIntentBits, Collection, PermissionFlagsBits, ChannelType, REST, Routes } = require('discord.js');
const { commands, getChannelPrefix } = require('./commands');
const Parser = require('rss-parser');
const cron = require('node-cron');

// Inicjalizacja klienta Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Kolekcja komend
client.commands = new Collection();
commands.forEach(command => {
    client.commands.set(command.data.name, command);
});

// Przechowywanie informacji o utworzonych kanałach
client.createdChannels = new Collection();
client.channelOwners = new Collection();

// Przechowywanie konfiguracji reaction roles
// Format: messageId -> { channelId, emoji, roleId }
client.reactionRoles = new Collection();

// Konfiguracja RSS parser dla newsów Battlefield 6
const fs = require('fs');
const crypto = require('crypto');
const parser = new Parser();
const BF6_NEWS_CHANNEL_ID = '1412920468540883026';
const RSS_FEEDS = [
    'https://gameranx.com/tag/battlefield/feed/',
];

// Plik do przechowywania już wysłanych newsów
const NEWS_STORAGE_FILE = './sent_news.json';

// Przechowywanie ostatnich newsów (aby uniknąć duplikatów)
client.lastNewsItems = new Set();

// Funkcja do ładowania już wysłanych newsów z pliku
function loadSentNews() {
    try {
        if (fs.existsSync(NEWS_STORAGE_FILE)) {
            const data = fs.readFileSync(NEWS_STORAGE_FILE, 'utf8');
            const sentNews = JSON.parse(data);
            client.lastNewsItems = new Set(sentNews);
            console.log(`📂 Załadowano ${sentNews.length} już wysłanych newsów`);
        }
    } catch (error) {
        console.error('❌ Błąd podczas ładowania wysłanych newsów:', error);
        client.lastNewsItems = new Set();
    }
}

// Funkcja do zapisywania już wysłanych newsów do pliku
function saveSentNews() {
    try {
        const sentNewsArray = Array.from(client.lastNewsItems);
        fs.writeFileSync(NEWS_STORAGE_FILE, JSON.stringify(sentNewsArray, null, 2));
    } catch (error) {
        console.error('❌ Błąd podczas zapisywania wysłanych newsów:', error);
    }
}

// Funkcja do generowania unikalnego hash dla newsa
function generateNewsHash(item) {
    const content = `${item.title}${item.link}${item.pubDate || ''}`;
    return crypto.createHash('md5').update(content).digest('hex');
}

// Event: Bot gotowy
client.once('ready', async () => {
    console.log(`✅ Bot zalogowany jako ${client.user.tag}`);
    console.log(`🔧 Aktywny na ${client.guilds.cache.size} serwerach`);
    
    // Ustawienie statusu bota
    client.user.setActivity('Tworzenie kanałów głosowych', { type: 'WATCHING' });
    
    // Ładowanie już wysłanych newsów
    loadSentNews();
    
    // Rejestracja komend slash
    await registerSlashCommands();
    
    // Uruchomienie systemu newsów Battlefield 6
    console.log('🎮 Uruchamianie systemu newsów Battlefield 6...');
    await checkBF6News(); // Pierwsze sprawdzenie
    startBF6NewsScheduler(); // Uruchomienie harmonogramu
});

// Event: Zmiana stanu kanału głosowego
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        await handleVoiceStateUpdate(oldState, newState);
    } catch (error) {
        console.error('❌ Błąd podczas obsługi zmiany stanu głosowego:', error);
    }
});

// Funkcja obsługująca zmiany stanu kanałów głosowych
async function handleVoiceStateUpdate(oldState, newState) {
    const triggerChannelId = process.env.TRIGGER_CHANNEL_ID;
    const voiceCategoryId = process.env.VOICE_CATEGORY_ID;
    
    // Użytkownik dołączył do kanału trigger
    if (newState.channelId === triggerChannelId && oldState.channelId !== triggerChannelId) {
        await createUserVoiceChannel(newState.member, newState.guild, voiceCategoryId);
    }
    
    // Użytkownik opuścił kanał - sprawdź czy kanał jest pusty i czy należy go usunąć
    if (oldState.channel && oldState.channel.id !== triggerChannelId) {
        await checkAndDeleteEmptyChannel(oldState.channel);
    }
}

// Funkcja tworząca nowy kanał głosowy dla użytkownika
async function createUserVoiceChannel(member, guild, categoryId) {
    try {
        const prefix = process.env.CHANNEL_PREFIX || '[BF6]';
        const channelName = `${prefix} ${member.displayName}`;
        
        // Sprawdź czy użytkownik już ma swój kanał
        const existingChannel = client.createdChannels.get(member.id);
        if (existingChannel && guild.channels.cache.has(existingChannel)) {
            // Przenieś użytkownika do istniejącego kanału
            await member.voice.setChannel(existingChannel);
            return;
        }
        
        // Utwórz nowy kanał głosowy
        const voiceChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildVoice,
            parent: categoryId || null,
            userLimit: 5, // Domyślny limit 5 użytkowników
            permissionOverwrites: [
                {
                    id: guild.id, // @everyone
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
                },
                {
                    id: member.id, // Właściciel kanału
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.Connect,
                        PermissionFlagsBits.ManageChannels, // Pozwala na zmianę nazwy i limitu
                        PermissionFlagsBits.MoveMembers
                    ],
                }
            ]
        });
        
        // Zapisz informacje o kanale
        client.createdChannels.set(member.id, voiceChannel.id);
        client.channelOwners.set(voiceChannel.id, member.id);
        
        // Przenieś użytkownika do nowego kanału
        await member.voice.setChannel(voiceChannel.id);
        
        console.log(`✅ Utworzono kanał głosowy: ${channelName} dla ${member.displayName}`);
        
    } catch (error) {
        console.error('❌ Błąd podczas tworzenia kanału głosowego:', error);
    }
}

// Funkcja sprawdzająca i usuwająca pusty kanał
async function checkAndDeleteEmptyChannel(channel) {
    try {
        // Sprawdź czy kanał jest utworzony przez bota
        const ownerId = client.channelOwners.get(channel.id);
        if (!ownerId) return;
        
        // Sprawdź czy kanał jest pusty
        if (channel.members.size === 0) {
            // Usuń kanał po 5 sekundach (daje czas na powrót)
            setTimeout(async () => {
                try {
                    const updatedChannel = channel.guild.channels.cache.get(channel.id);
                    if (updatedChannel && updatedChannel.members.size === 0) {
                        await updatedChannel.delete('Kanał pusty - automatyczne usunięcie');
                        
                        // Usuń z pamięci bota
                        client.createdChannels.delete(ownerId);
                        client.channelOwners.delete(channel.id);
                        
                        console.log(`🗑️ Usunięto pusty kanał: ${channel.name}`);
                    }
                } catch (error) {
                    console.error('❌ Błąd podczas usuwania kanału:', error);
                }
            }, 5000);
        }
    } catch (error) {
        console.error('❌ Błąd podczas sprawdzania pustego kanału:', error);
    }
}

// Event: Obsługa komend slash
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    
    try {
        await command.execute(interaction, client);
    } catch (error) {
        console.error('❌ Błąd podczas wykonywania komendy:', error);
        const reply = {
            content: '❌ Wystąpił błąd podczas wykonywania komendy.',
            ephemeral: true
        };
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
        } else {
            await interaction.reply(reply);
        }
    }
});

// Obsługa dodawania reakcji
client.on('messageReactionAdd', async (reaction, user) => {
    // Ignoruj reakcje bota
    if (user.bot) return;

    // Sprawdź czy reakcja jest częściowa (nie w cache)
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('❌ Błąd podczas pobierania reakcji:', error);
            return;
        }
    }

    await handleReactionRole(reaction, user, 'add');
});

// Obsługa usuwania reakcji
client.on('messageReactionRemove', async (reaction, user) => {
    // Ignoruj reakcje bota
    if (user.bot) return;

    // Sprawdź czy reakcja jest częściowa (nie w cache)
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('❌ Błąd podczas pobierania reakcji:', error);
            return;
        }
    }

    await handleReactionRole(reaction, user, 'remove');
});

// Funkcja obsługująca reaction roles
async function handleReactionRole(reaction, user, action) {
    try {
        const messageId = reaction.message.id;
        const reactionConfig = client.reactionRoles.get(messageId);
        
        if (!reactionConfig) return; // Brak konfiguracji dla tej wiadomości

        // Sprawdź czy emoji się zgadza
        const reactionEmoji = reaction.emoji.name || reaction.emoji.toString();
        if (reactionEmoji !== reactionConfig.emoji && reaction.emoji.toString() !== reactionConfig.emoji) {
            return; // Niepoprawne emoji
        }

        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id);
        const role = guild.roles.cache.get(reactionConfig.roleId);

        if (!role) {
            console.error(`❌ Nie znaleziono roli o ID: ${reactionConfig.roleId}`);
            return;
        }

        if (action === 'add') {
            // Dodaj rolę
            if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role);
                console.log(`✅ Dodano rolę ${role.name} użytkownikowi ${user.tag}`);
            }
        } else if (action === 'remove') {
            // Usuń rolę
            if (member.roles.cache.has(role.id)) {
                await member.roles.remove(role);
                console.log(`➖ Usunięto rolę ${role.name} użytkownikowi ${user.tag}`);
            }
        }

    } catch (error) {
        console.error('❌ Błąd podczas obsługi reaction role:', error);
    }
}

// Funkcje obsługi newsów Battlefield 6
async function checkBF6News() {
    try {
        const channel = client.channels.cache.get(BF6_NEWS_CHANNEL_ID);
        if (!channel) {
            console.error(`❌ Nie znaleziono kanału newsów BF6 o ID: ${BF6_NEWS_CHANNEL_ID}`);
            console.log(`📋 Dostępne kanały: ${client.channels.cache.map(ch => `${ch.name} (${ch.id})`).join(', ')}`);
            return;
        }

        console.log(`🔍 Sprawdzanie newsów Battlefield 6... Kanał: ${channel.name}`);
        
        // Przeładuj wysłane newsy z pliku przed każdym sprawdzeniem
        loadSentNews();
        
        for (const feedUrl of RSS_FEEDS) {
            try {
                const feed = await parser.parseURL(feedUrl);
                
                // Filtrowanie artykułów związanych TYLKO z Battlefield 6
                const battlefieldItems = feed.items.filter(item => {
                    const title = item.title.toLowerCase();
                    const content = (item.contentSnippet || item.content || '').toLowerCase();
                    const fullText = `${title} ${content}`;
                    
                    // Sprawdzanie czy artykuł dotyczy Battlefield 6
                    const bf6Keywords = [
                        'battlefield 6', 'bf6', 'battlefield vi'
                    ];
                    
                    // Wykluczanie starszych części Battlefield
                    const excludeKeywords = [
                        'battlefield 1', 'battlefield v', 'battlefield 4',
                        'battlefield 3', 'battlefield bad company',
                        'battlefield hardline', 'battlefield portal',
                        'battlefield 2042'
                    ];
                    
                    // Sprawdź czy zawiera słowa kluczowe BF6
                    const hasBF6Keywords = bf6Keywords.some(keyword => fullText.includes(keyword));
                    
                    // Sprawdź czy nie zawiera wykluczonych słów
                    const hasExcludedKeywords = excludeKeywords.some(keyword => fullText.includes(keyword));
                    
                    return hasBF6Keywords && !hasExcludedKeywords;
                });

                // Wysyłanie najnowszego artykułu (tylko 1)
                if (battlefieldItems.length > 0) {
                    const latestItem = battlefieldItems[0]; // Tylko najnowszy
                    const newsHash = generateNewsHash(latestItem);
                    
                    if (!client.lastNewsItems.has(newsHash)) {
                        await sendBF6NewsToChannel(channel, latestItem, feedUrl);
                        client.lastNewsItems.add(newsHash);
                        
                        // Zapisanie do pliku po każdym nowym newsie
                        saveSentNews();
                        
                        // Ograniczenie rozmiaru Set (ostatnie 200 newsów)
                        if (client.lastNewsItems.size > 200) {
                            const itemsArray = Array.from(client.lastNewsItems);
                            client.lastNewsItems = new Set(itemsArray.slice(-200));
                            saveSentNews(); // Zapisz po oczyszczeniu
                        }
                        
                        console.log(`✅ Wysłano najnowszy news BF6: ${latestItem.title}`);
                    } else {
                        console.log(`⏭️ Najnowszy news już istnieje: ${latestItem.title}`);
                    }
                }
                
            } catch (feedError) {
                console.error(`❌ Błąd podczas parsowania feed ${feedUrl}:`, feedError.message);
            }
        }
        
    } catch (error) {
        console.error('❌ Błąd podczas sprawdzania newsów BF6:', error);
    }
}

async function sendBF6NewsToChannel(channel, item, source) {
    try {
        const embed = {
            color: 0xFF6B35, // Pomarańczowy kolor Battlefield
            title: item.title,
            url: item.link,
            description: (item.contentSnippet || item.content || 'Brak opisu').substring(0, 300) + '...',
            fields: [
                {
                    name: '🔗 Źródło',
                    value: getSourceName(source),
                    inline: true
                },
                {
                    name: '📅 Data',
                    value: item.pubDate ? new Date(item.pubDate).toLocaleDateString('pl-PL') : 'Nieznana',
                    inline: true
                }
            ],
            footer: {
                text: '🎮 Battlefield 6 News Bot'
            },
            timestamp: new Date().toISOString()
        };

        await channel.send({ embeds: [embed] });
        console.log(`📰 Wysłano news BF6: ${item.title}`);
        
    } catch (error) {
        console.error('❌ Błąd podczas wysyłania newsa:', error);
    }
}

function getSourceName(feedUrl) {
    if (feedUrl.includes('gamespot')) return 'GameSpot';
    if (feedUrl.includes('ign')) return 'IGN';
    if (feedUrl.includes('polygon')) return 'Polygon';
    if (feedUrl.includes('gameranx')) return 'GameRanx';
    if (feedUrl.includes('insider-gaming')) return 'Insider Gaming';
    return 'Nieznane źródło';
}

function startBF6NewsScheduler() {
    // Sprawdzanie co 30 minut
    cron.schedule('*/30 * * * *', async () => {
        console.log('⏰ Automatyczne sprawdzanie newsów BF6...');
        await checkBF6News();
    });
    
    console.log('✅ Harmonogram newsów BF6 uruchomiony (co 30 minut)');
}

// Funkcja rejestrująca komendy slash
async function registerSlashCommands() {
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        
        const commandData = commands.map(command => command.data.toJSON());
        
        console.log('🔄 Rejestrowanie komend slash...');
        
        if (process.env.GUILD_ID) {
            // Rejestracja dla konkretnego serwera (szybsza)
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
                { body: commandData }
            );
            console.log('✅ Komendy slash zarejestrowane dla serwera');
        } else {
            // Rejestracja globalna (może potrwać do godziny)
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commandData }
            );
            console.log('✅ Komendy slash zarejestrowane globalnie');
        }
    } catch (error) {
        console.error('❌ Błąd podczas rejestrowania komend:', error);
    }
}

// Obsługa błędów
client.on('error', error => {
    console.error('❌ Błąd klienta Discord:', error);
});

process.on('unhandledRejection', error => {
    console.error('❌ Nieobsłużone odrzucenie:', error);
});

// Logowanie bota
client.login(process.env.DISCORD_TOKEN);

module.exports = client;