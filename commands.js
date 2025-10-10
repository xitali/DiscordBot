const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { commands: moderationCommands } = require('./moderation');
const { commands: pollCommands } = require('./polls');
const { loadConfig, saveConfig } = require('./auto-moderation');

// Funkcja bezpiecznej odpowiedzi na interakcje
async function safeReply(interaction, options) {
    try {
        if (interaction.replied || interaction.deferred) {
            return await interaction.followUp(options);
        } else {
            return await interaction.reply(options);
        }
    } catch (error) {
        if (error.code === 10062) {
            console.log('⚠️ Interakcja wygasła (Unknown interaction)');
        } else if (error.code === 40060) {
            // Pomijamy log dla już obsłużonych interakcji
        } else {
            console.error('❌ Błąd podczas odpowiedzi na interakcję:', error);
        }
        return null;
    }
}

// Komenda /config została przeniesiona do /admin config name

// Obsługa zmiany nazwy kanału
async function handleNameChange(interaction, client) {
    const oldName = interaction.options.getString('old_name');
    const newName = interaction.options.getString('new_name');
    
    try {
        // Znajdź kanał z podaną nazwą
        const channels = interaction.guild.channels.cache.filter(channel => 
            channel.type === 2 && // GuildVoice
            channel.name.includes(oldName)
        );
        
        if (channels.size === 0) {
            return await interaction.reply({
                content: `❌ Nie znaleziono kanału głosowego zawierającego nazwę: "${oldName}"`,
                flags: 64 // MessageFlags.Ephemeral
            });
        }
        
        if (channels.size > 1) {
            const channelList = channels.map(ch => `• ${ch.name}`).join('\n');
            return await interaction.reply({
                content: `❌ Znaleziono więcej niż jeden kanał:\n${channelList}\n\nPodaj bardziej precyzyjną nazwę.`,
                flags: 64 // MessageFlags.Ephemeral
            });
        }
        
        const channel = channels.first();
        const oldChannelName = channel.name;
        const currentPrefix = getChannelPrefix(channel.name);
        const newChannelName = `${currentPrefix} ${newName}`;
        
        await channel.setName(newChannelName);
        
        await interaction.reply({
            content: `✅ Zmieniono nazwę kanału z "${oldChannelName}" na "${newChannelName}"`,
            flags: 64 // MessageFlags.Ephemeral
        });
        
        console.log(`🔧 Admin ${interaction.user.tag} zmienił nazwę kanału: ${oldChannelName} -> ${newChannelName}`);
        
    } catch (error) {
        console.error('❌ Błąd podczas zmiany nazwy kanału:', error);
        await interaction.reply({
            content: '❌ Wystąpił błąd podczas zmiany nazwy kanału.',
            flags: 64 // MessageFlags.Ephemeral
        });
    }
}



// Komenda /channel do zarządzania własnym kanałem
const channelCommand = {
    data: new SlashCommandBuilder()
        .setName('channel')
        .setDescription('Zarządzaj swoim kanałem głosowym')
        .addSubcommand(subcommand =>
            subcommand
                .setName('limit')
                .setDescription('Ustaw limit osób w kanale (2-5)')
                .addIntegerOption(option =>
                    option.setName('liczba')
                        .setDescription('Liczba osób (2-5)')
                        .setRequired(true)
                        .setMinValue(2)
                        .setMaxValue(5)
                        .addChoices(
                            { name: '2 osoby', value: 2 },
                            { name: '3 osoby', value: 3 },
                            { name: '4 osoby', value: 4 },
                            { name: '5 osób', value: 5 }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('rename')
                .setDescription('Zmień nazwę swojego kanału')
                .addStringOption(option =>
                    option.setName('nazwa')
                        .setDescription('Nowa nazwa kanału (bez prefiksu)')
                        .setRequired(true)
                        .setMaxLength(50))),
    
    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        
        // Sprawdź czy użytkownik ma swój kanał
        const userChannelId = client.createdChannels.get(interaction.user.id);
        if (!userChannelId) {
            return;
        }
        
        const channel = interaction.guild.channels.cache.get(userChannelId);
        if (!channel) {
            return;
        }
        
        if (subcommand === 'limit') {
            await handleChannelLimit(interaction, channel);
        } else if (subcommand === 'rename') {
            await handleChannelRename(interaction, channel);
        }
    }
};

// Obsługa zmiany limitu kanału
async function handleChannelLimit(interaction, channel) {
    const limit = interaction.options.getInteger('liczba');
    
    // Walidacja - tylko wartości 2-5 są dozwolone
    if (limit < 2 || limit > 5) {
        return;
    }
    
    try {
        await channel.setUserLimit(limit);
        await interaction.deferReply();
        await interaction.deleteReply();
        
        console.log(`🔧 ${interaction.user.tag} ustawił limit kanału ${channel.name} na: ${limit}`);
        
    } catch (error) {
        console.error('❌ Błąd podczas zmiany limitu kanału:', error);
    }
}

// Obsługa zmiany nazwy kanału przez właściciela
async function handleChannelRename(interaction, channel) {
    const newName = interaction.options.getString('nazwa');
    
    try {
        const currentPrefix = getChannelPrefix(channel.name);
        const newChannelName = `${currentPrefix} ${newName}`;
        
        await channel.setName(newChannelName);
        await interaction.deferReply();
        await interaction.deleteReply();
        
        console.log(`🔧 ${interaction.user.tag} zmienił nazwę swojego kanału na: ${newChannelName}`);
        
    } catch (error) {
        console.error('❌ Błąd podczas zmiany nazwy kanału:', error);
    }
}

// Komenda /auth do konfiguracji reaction roles
const authCommand = {
    data: new SlashCommandBuilder()
        .setName('auth')
        .setDescription('Konfiguruj reaction roles - przydzielanie ról za reakcje')
        .addStringOption(option =>
            option.setName('kanal')
                .setDescription('Nazwa kanału tekstowego')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('wiadomosc')
                .setDescription('ID wiadomości (message:id)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('emoji')
                .setDescription('Emoji do reakcji (np. 👍 lub :custom_emoji:)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('rola')
                .setDescription('Nazwa roli do przydzielenia')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction, client) {
        const channelName = interaction.options.getString('kanal');
        const messageId = interaction.options.getString('wiadomosc');
        const emoji = interaction.options.getString('emoji');
        const roleName = interaction.options.getString('rola');

        return await handleAuthSetup(interaction, client, channelName, messageId, emoji, roleName);
    }
};

async function handleAuthSetup(interaction, client, channelName, messageId, emoji, roleName) {
    try {
        // Znajdź kanał po nazwie
        const channel = interaction.guild.channels.cache.find(ch => 
            ch.name === channelName && ch.type === 0 // GuildText
        );
        
        if (!channel) {
            return await interaction.reply({
                content: `❌ Nie znaleziono kanału tekstowego o nazwie: ${channelName}`,
                flags: 64 // MessageFlags.Ephemeral
            });
        }

        // Sprawdź czy wiadomość istnieje
        let message;
        try {
            message = await channel.messages.fetch(messageId);
        } catch (error) {
            return await interaction.reply({
                content: `❌ Nie znaleziono wiadomości o ID: ${messageId} w kanale ${channelName}`,
                flags: 64 // MessageFlags.Ephemeral
            });
        }

        // Znajdź rolę po nazwie
        const role = interaction.guild.roles.cache.find(r => r.name === roleName);
        if (!role) {
            return await interaction.reply({
                content: `❌ Nie znaleziono roli o nazwie: ${roleName}`,
                flags: 64 // MessageFlags.Ephemeral
            });
        }

        // Sprawdź uprawnienia bota
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return await interaction.reply({
                content: '❌ Bot nie ma uprawnień do zarządzania rolami.',
                flags: 64 // MessageFlags.Ephemeral
            });
        }

        // Sprawdź czy bot może przydzielić tę rolę
        if (role.position >= interaction.guild.members.me.roles.highest.position) {
            return await interaction.reply({
                content: `❌ Nie mogę przydzielić roli ${roleName} - jest wyżej w hierarchii niż moje role.`,
                flags: 64 // MessageFlags.Ephemeral
            });
        }

        // Dodaj reakcję do wiadomości
        try {
            await message.react(emoji);
        } catch (error) {
            return await interaction.reply({
                content: `❌ Nie mogę dodać reakcji ${emoji}. Sprawdź czy emoji jest poprawne.`,
                flags: 64 // MessageFlags.Ephemeral
            });
        }

        // Zapisz konfigurację reaction role
        client.reactionRoles.set(messageId, {
            channelId: channel.id,
            emoji: emoji,
            roleId: role.id,
            roleName: roleName
        });

        await interaction.reply({
            content: `✅ Skonfigurowano reaction role:\n` +
                    `📍 Kanał: ${channel.name}\n` +
                    `📝 Wiadomość: ${messageId}\n` +
                    `😀 Emoji: ${emoji}\n` +
                    `🎭 Rola: ${roleName}`,
            flags: 64 // MessageFlags.Ephemeral
        });

        console.log(`🔧 ${interaction.user.tag} skonfigurował reaction role: ${emoji} -> ${roleName} w ${channel.name}`);

    } catch (error) {
        console.error('❌ Błąd podczas konfiguracji reaction role:', error);
        await interaction.reply({
            content: '❌ Wystąpił błąd podczas konfiguracji reaction role.',
            flags: 64 // MessageFlags.Ephemeral
        });
    }
}

// Komenda /clear do masowego usuwania wiadomości
const clearCommand = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Usuń określoną liczbę wiadomości z kanału')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Liczba wiadomości do usunięcia (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Usuń wiadomości tylko od tego użytkownika')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    
    async execute(interaction, client) {
        const amount = interaction.options.getInteger('amount');
        const targetUser = interaction.options.getUser('user');
        
        try {
            await interaction.deferReply({ flags: 64 }); // MessageFlags.Ephemeral
            
            // Pobierz wiadomości z kanału
            const messages = await interaction.channel.messages.fetch({ limit: 100 });
            
            let messagesToDelete;
            if (targetUser) {
                // Filtruj wiadomości od określonego użytkownika
                messagesToDelete = messages.filter(msg => msg.author.id === targetUser.id).first(amount);
            } else {
                // Pobierz określoną liczbę najnowszych wiadomości
                messagesToDelete = messages.first(amount);
            }
            
            if (messagesToDelete.length === 0) {
                return await interaction.editReply({
                    content: '❌ Nie znaleziono wiadomości do usunięcia.'
                });
            }
            
            // Usuń wiadomości
            const deleted = await interaction.channel.bulkDelete(messagesToDelete, true);
            
            // Wyślij potwierdzenie
            const userText = targetUser ? ` od użytkownika ${targetUser.tag}` : '';
            await interaction.editReply({
                content: `✅ Usunięto ${deleted.size} wiadomości${userText}.`
            });
            
            console.log(`🔧 Admin ${interaction.user.tag} usunął ${deleted.size} wiadomości${targetUser ? ` od użytkownika ${targetUser.tag}` : ''} w kanale ${interaction.channel.name}`);
            
            // Wyślij log do kanału moderacji
            await sendLogToModerationChannel(client, {
                title: '🗑️ Masowe usuwanie wiadomości',
                description: `**Moderator:** ${interaction.user.tag}\n**Kanał:** ${interaction.channel}\n**Liczba usuniętych:** ${deleted.size}${targetUser ? `\n**Cel:** ${targetUser.tag}` : ''}`,
                color: 0xFF6B6B,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('❌ Błąd podczas usuwania wiadomości:', error);
            
            let errorMessage = '❌ Wystąpił błąd podczas usuwania wiadomości.';
            if (error.code === 50034) {
                errorMessage = '❌ Nie można usunąć wiadomości starszych niż 14 dni.';
            } else if (error.code === 50013) {
                errorMessage = '❌ Brak uprawnień do usuwania wiadomości.';
            }
            
            await interaction.editReply({ content: errorMessage });
        }
    }
};

// Komenda /admin do kompleksowego zarządzania botem
const adminCommand = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Panel administracyjny bota')
        .addSubcommandGroup(group =>
            group
                .setName('config')
                .setDescription('Konfiguracja ustawień bota')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('view')
                        .setDescription('Wyświetl wszystkie ustawienia bota'))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('name')
                        .setDescription('Zmień nazwę kanału głosowego')
                        .addStringOption(option =>
                            option.setName('old_name')
                                .setDescription('Stara nazwa kanału (bez [BF6])')
                                .setRequired(true))
                        .addStringOption(option =>
                            option.setName('new_name')
                                .setDescription('Nowa nazwa kanału (bez [BF6])')
                                .setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('profanity')
                        .setDescription('Konfiguruj filtr wulgaryzmów')
                        .addBooleanOption(option =>
                            option.setName('enabled')
                                .setDescription('Włącz/wyłącz filtr wulgaryzmów')
                                .setRequired(true))
                        .addStringOption(option =>
                            option.setName('action')
                                .setDescription('Akcja za wulgaryzmy')
                                .setRequired(false)
                                .addChoices(
                                    { name: 'Ostrzeżenie', value: 'warn' },
                                    { name: 'Timeout', value: 'timeout' },
                                    { name: 'Kick', value: 'kick' },
                                    { name: 'Ban', value: 'ban' }
                                ))
                        .addIntegerOption(option =>
                            option.setName('timeout_duration')
                                .setDescription('Czas timeout w sekundach (60-3600)')
                                .setRequired(false)
                                .setMinValue(60)
                                .setMaxValue(3600)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('spam')
                        .setDescription('Konfiguruj ochronę przed spamem')
                        .addBooleanOption(option =>
                            option.setName('enabled')
                                .setDescription('Włącz/wyłącz ochronę przed spamem')
                                .setRequired(true))
                        .addIntegerOption(option =>
                            option.setName('max_messages')
                                .setDescription('Maksymalna liczba wiadomości (3-10)')
                                .setRequired(false)
                                .setMinValue(3)
                                .setMaxValue(10))
                        .addIntegerOption(option =>
                            option.setName('time_window')
                                .setDescription('Okno czasowe w sekundach (5-30)')
                                .setRequired(false)
                                .setMinValue(5)
                                .setMaxValue(30))
                        .addIntegerOption(option =>
                            option.setName('timeout_duration')
                                .setDescription('Czas timeout za spam w sekundach (30-300)')
                                .setRequired(false)
                                .setMinValue(30)
                                .setMaxValue(300)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('prefix')
                        .setDescription('Zmień prefix kanałów głosowych')
                        .addStringOption(option =>
                            option.setName('new_prefix')
                                .setDescription('Nowy prefix (np. [BF6])')
                                .setRequired(true)
                                .setMaxLength(20)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('reset')
                        .setDescription('Przywróć domyślne ustawienia')
                        .addStringOption(option =>
                            option.setName('section')
                                .setDescription('Sekcja do zresetowania')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Filtr wulgaryzmów', value: 'profanity' },
                                    { name: 'Ochrona przed spamem', value: 'spam' },
                                    { name: 'Wszystko', value: 'all' }
                                ))))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction, client) {
        const subcommandGroup = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommandGroup === 'config') {
            if (subcommand === 'view') {
                await handleConfigView(interaction);
            } else if (subcommand === 'name') {
                await handleNameChange(interaction, client);
            } else if (subcommand === 'profanity') {
                await handleConfigProfanity(interaction);
            } else if (subcommand === 'spam') {
                await handleConfigSpam(interaction);
            } else if (subcommand === 'prefix') {
                await handleConfigPrefix(interaction);
            } else if (subcommand === 'reset') {
                await handleConfigReset(interaction);
            }
        }
    }
};

// Komenda /automod została usunięta - funkcje dostępne w /admin config

// Funkcje handleProfanityToggle i handleAutomodStatus zostały usunięte
// Ich funkcjonalność jest dostępna w /admin config

// Funkcja pomocnicza do wyciągnięcia prefiksu z nazwy kanału
function getChannelPrefix(channelName) {
    const match = channelName.match(/^(\[.*?\])/); // Znajdź tekst w nawiasach kwadratowych na początku
    return match ? match[1] : (process.env.CHANNEL_PREFIX || '[BF6]');
}

// Obsługa wyświetlania wszystkich ustawień
async function handleConfigView(interaction) {
    try {
        const config = loadConfig();
        const channelPrefix = process.env.CHANNEL_PREFIX || '[BF6]';
        
        const embed = {
            color: 0x0099FF,
            title: '⚙️ Konfiguracja Bota',
            fields: [
                {
                    name: '🤬 Filtr Wulgaryzmów',
                    value: `**Status:** ${config.profanityFilter.enabled ? '✅ Włączony' : '❌ Wyłączony'}\n` +
                           `**Akcja:** ${config.profanityFilter.action}\n` +
                           `**Timeout:** ${config.profanityFilter.timeoutDuration / 1000}s\n` +
                           `**Wyjątki ról:** ${(config.profanityFilter.exemptRoles && config.profanityFilter.exemptRoles.length > 0) ? config.profanityFilter.exemptRoles.join(', ') : 'Brak'}`,
                    inline: true
                },
                {
                    name: '📨 Ochrona przed Spamem',
                    value: `**Status:** ${config.spamProtection.enabled ? '✅ Włączona' : '❌ Wyłączona'}\n` +
                           `**Max wiadomości:** ${config.spamProtection.maxMessages}\n` +
                           `**Okno czasowe:** ${config.spamProtection.timeWindow / 1000}s\n` +
                           `**Timeout:** ${config.spamProtection.timeoutDuration / 1000}s\n` +
                           `**Wyjątki ról:** ${(config.spamProtection.exemptRoles && config.spamProtection.exemptRoles.length > 0) ? config.spamProtection.exemptRoles.join(', ') : 'Brak'}`,
                    inline: true
                },
                {
                    name: '🎤 Kanały Głosowe',
                    value: `**Prefix:** ${channelPrefix}`,
                    inline: true
                }
            ],
            timestamp: new Date().toISOString(),
            footer: { text: 'Panel Administracyjny' }
        };
        
        await safeReply(interaction, { embeds: [embed], flags: 64 });
        
    } catch (error) {
        console.error('❌ Błąd podczas wyświetlania konfiguracji:', error);
        await safeReply(interaction, {
            content: '❌ Wystąpił błąd podczas wyświetlania konfiguracji.',
            flags: 64
        });
    }
}

// Obsługa konfiguracji filtra wulgaryzmów
async function handleConfigProfanity(interaction) {
    try {
        const config = loadConfig();
        const enabled = interaction.options.getBoolean('enabled');
        const action = interaction.options.getString('action');
        const timeoutDuration = interaction.options.getInteger('timeout_duration');
        
        config.profanityFilter.enabled = enabled;
        
        if (action) {
            config.profanityFilter.action = action;
        }
        
        if (timeoutDuration) {
            config.profanityFilter.timeoutDuration = timeoutDuration * 1000; // Konwersja na milisekundy
        }
        
        saveConfig(config);
        
        const embed = {
            color: enabled ? 0x00FF00 : 0xFF0000,
            title: '🤬 Konfiguracja Filtra Wulgaryzmów',
            description: `**Status:** ${enabled ? '✅ Włączony' : '❌ Wyłączony'}\n` +
                        `**Akcja:** ${config.profanityFilter.action}\n` +
                        `**Timeout:** ${config.profanityFilter.timeoutDuration / 1000}s`,
            timestamp: new Date().toISOString()
        };
        
        await safeReply(interaction, { embeds: [embed], flags: 64 });
        
        console.log(`🔧 Admin ${interaction.user.tag} zmienił konfigurację filtra wulgaryzmów: enabled=${enabled}, action=${action || 'bez zmian'}, timeout=${timeoutDuration || 'bez zmian'}s`);
        
    } catch (error) {
        console.error('❌ Błąd podczas konfiguracji filtra wulgaryzmów:', error);
        await safeReply(interaction, {
            content: '❌ Wystąpił błąd podczas konfiguracji filtra wulgaryzmów.',
            flags: 64
        });
    }
}

// Obsługa konfiguracji ochrony przed spamem
async function handleConfigSpam(interaction) {
    try {
        const config = loadConfig();
        const enabled = interaction.options.getBoolean('enabled');
        const maxMessages = interaction.options.getInteger('max_messages');
        const timeWindow = interaction.options.getInteger('time_window');
        const timeoutDuration = interaction.options.getInteger('timeout_duration');
        
        config.spamProtection.enabled = enabled;
        
        if (maxMessages) {
            config.spamProtection.maxMessages = maxMessages;
        }
        
        if (timeWindow) {
            config.spamProtection.timeWindow = timeWindow * 1000; // Konwersja na milisekundy
        }
        
        if (timeoutDuration) {
            config.spamProtection.timeoutDuration = timeoutDuration * 1000; // Konwersja na milisekundy
        }
        
        saveConfig(config);
        
        const embed = {
            color: enabled ? 0x00FF00 : 0xFF0000,
            title: '📨 Konfiguracja Ochrony przed Spamem',
            description: `**Status:** ${enabled ? '✅ Włączona' : '❌ Wyłączona'}\n` +
                        `**Max wiadomości:** ${config.spamProtection.maxMessages}\n` +
                        `**Okno czasowe:** ${config.spamProtection.timeWindow / 1000}s\n` +
                        `**Timeout:** ${config.spamProtection.timeoutDuration / 1000}s`,
            timestamp: new Date().toISOString()
        };
        
        await safeReply(interaction, { embeds: [embed], flags: 64 });
        
        console.log(`🔧 Admin ${interaction.user.tag} zmienił konfigurację ochrony przed spamem: enabled=${enabled}, maxMessages=${maxMessages || 'bez zmian'}, timeWindow=${timeWindow || 'bez zmian'}s, timeout=${timeoutDuration || 'bez zmian'}s`);
        
    } catch (error) {
        console.error('❌ Błąd podczas konfiguracji ochrony przed spamem:', error);
        await safeReply(interaction, {
            content: '❌ Wystąpił błąd podczas konfiguracji ochrony przed spamem.',
            flags: 64
        });
    }
}

// Obsługa konfiguracji prefiksu kanałów
async function handleConfigPrefix(interaction) {
    try {
        const newPrefix = interaction.options.getString('new_prefix');
        
        // Zapisz nowy prefix do zmiennej środowiskowej (w rzeczywistej aplikacji należałoby to zapisać do pliku .env)
        process.env.CHANNEL_PREFIX = newPrefix;
        
        const embed = {
            color: 0x00FF00,
            title: '🎤 Konfiguracja Prefiksu Kanałów',
            description: `**Nowy prefix:** ${newPrefix}\n\n⚠️ **Uwaga:** Zmiana dotyczy tylko nowo tworzonych kanałów. Istniejące kanały zachowają swoje nazwy.`,
            timestamp: new Date().toISOString()
        };
        
        await interaction.reply({ embeds: [embed], flags: 64 }); // MessageFlags.Ephemeral
        
        console.log(`🔧 Admin ${interaction.user.tag} zmienił prefix kanałów na: ${newPrefix}`);
        
    } catch (error) {
        console.error('❌ Błąd podczas konfiguracji prefiksu:', error);
        await safeReply(interaction, {
            content: '❌ Wystąpił błąd podczas konfiguracji prefiksu.',
            flags: 64
        });
    }
}

// Obsługa resetowania konfiguracji
async function handleConfigReset(interaction) {
    try {
        const { DEFAULT_CONFIG } = require('./auto-moderation');
        const section = interaction.options.getString('section');
        const config = loadConfig();
        
        if (section === 'profanity') {
            config.profanityFilter = { ...DEFAULT_CONFIG.profanityFilter };
        } else if (section === 'spam') {
            config.spamProtection = { ...DEFAULT_CONFIG.spamProtection };
        } else if (section === 'all') {
            Object.assign(config, DEFAULT_CONFIG);
        }
        
        saveConfig(config);
        
        const embed = {
            color: 0xFFA500,
            title: '🔄 Reset Konfiguracji',
            description: `**Zresetowano:** ${section === 'profanity' ? 'Filtr wulgaryzmów' : section === 'spam' ? 'Ochrona przed spamem' : 'Wszystkie ustawienia'}\n\n✅ Przywrócono domyślne wartości.`,
            timestamp: new Date().toISOString()
        };
        
        await safeReply(interaction, { embeds: [embed], flags: 64 });
        
        console.log(`🔧 Admin ${interaction.user.tag} zresetował konfigurację: ${section}`);
        
    } catch (error) {
        console.error('❌ Błąd podczas resetowania konfiguracji:', error);
        await safeReply(interaction, {
            content: '❌ Wystąpił błąd podczas resetowania konfiguracji.',
            flags: 64
        });
    }
}

// Disboard bump channel (env or fallback)
// const BUMP_CHANNEL_ID = process.env.DISBOARD_BUMP_CHANNEL_ID || '1426170199123427399';

// Komenda /bump do bumpowania serwera na Disboard (tylko w wyznaczonym kanale)
const bumpCommand = {
    data: new SlashCommandBuilder()
        .setName('bump')
        .setDescription('Wyślij komendę /bump (Disboard) w wyznaczonym kanale'),
    async execute(interaction, client) {
        try {
            if (interaction.channelId !== BUMP_CHANNEL_ID) {
                await safeReply(interaction, { content: `❌ Tę komendę możesz użyć tylko w <#${BUMP_CHANNEL_ID}>.`, flags: 64 });
                return;
            }

            const guild = interaction.guild;
            const channel = guild.channels.cache.get(BUMP_CHANNEL_ID) || await guild.channels.fetch(BUMP_CHANNEL_ID).catch(() => null);
            if (!channel) {
                await safeReply(interaction, { content: '❌ Nie znaleziono kanału bump.', flags: 64 });
                return;
            }

            await channel.send('/bump');
            await safeReply(interaction, { content: '✅ Wysłano komendę /bump (Disboard).', flags: 64 });
            console.log(`🚀 Komenda /bump (Disboard) wysłana przez ${interaction.user.tag} w kanale ${channel.name}`);
        } catch (error) {
            console.error('❌ Błąd podczas wysyłania komendy /bump (Disboard):', error);
            await safeReply(interaction, { content: '❌ Wystąpił błąd podczas wysyłania.', flags: 64 });
        }
    }
};

module.exports = {
    commands: [channelCommand, authCommand, clearCommand, adminCommand, ...moderationCommands, ...pollCommands],
    getChannelPrefix
};