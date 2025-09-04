const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { commands: moderationCommands } = require('./moderation');

// Komenda /config do zmiany nazw kanałów przez administratorów
const configCommand = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Konfiguracja nazw kanałów głosowych')
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
                .setName('prefix')
                .setDescription('Zmień prefix kanałów głosowych')
                .addStringOption(option =>
                    option.setName('new_prefix')
                        .setDescription('Nowy prefix (domyślnie [BF6])')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    
    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'name') {
            await handleNameChange(interaction, client);
        } else if (subcommand === 'prefix') {
            await handlePrefixChange(interaction, client);
        }
    }
};

// Obsługa zmiany nazwy kanału
async function handleNameChange(interaction, client) {
    const oldName = interaction.options.getString('old_name');
    const newName = interaction.options.getString('new_name');
    
    try {
        // Znajdź kanał z podaną nazwą
        const channels = interaction.guild.channels.cache.filter(channel => 
            channel.type === 2 && // GuildVoice
            channel.name.includes(oldName) &&
            client.channelOwners.has(channel.id)
        );
        
        if (channels.size === 0) {
            return await interaction.reply({
                content: `❌ Nie znaleziono kanału głosowego zawierającego nazwę: "${oldName}"`,
                ephemeral: true
            });
        }
        
        if (channels.size > 1) {
            const channelList = channels.map(ch => `• ${ch.name}`).join('\n');
            return await interaction.reply({
                content: `❌ Znaleziono więcej niż jeden kanał:\n${channelList}\n\nPodaj bardziej precyzyjną nazwę.`,
                ephemeral: true
            });
        }
        
        const channel = channels.first();
        const currentPrefix = getChannelPrefix(channel.name);
        const newChannelName = `${currentPrefix} ${newName}`;
        
        await channel.setName(newChannelName);
        
        await interaction.reply({
            content: `✅ Zmieniono nazwę kanału z "${channel.name}" na "${newChannelName}"`,
            ephemeral: true
        });
        
        console.log(`🔧 Admin ${interaction.user.tag} zmienił nazwę kanału: ${channel.name} -> ${newChannelName}`);
        
    } catch (error) {
        console.error('❌ Błąd podczas zmiany nazwy kanału:', error);
        await interaction.reply({
            content: '❌ Wystąpił błąd podczas zmiany nazwy kanału.',
            ephemeral: true
        });
    }
}

// Obsługa zmiany prefiksu
async function handlePrefixChange(interaction, client) {
    const newPrefix = interaction.options.getString('new_prefix');
    
    try {
        // Zapisz nowy prefix w zmiennej środowiskowej (tymczasowo w pamięci)
        process.env.CHANNEL_PREFIX = newPrefix;
        
        await interaction.reply({
            content: `✅ Zmieniono prefix kanałów na: "${newPrefix}"\n⚠️ Zmiana dotyczy tylko nowo tworzonych kanałów.`,
            ephemeral: true
        });
        
        console.log(`🔧 Admin ${interaction.user.tag} zmienił prefix kanałów na: ${newPrefix}`);
        
    } catch (error) {
        console.error('❌ Błąd podczas zmiany prefiksu:', error);
        await interaction.reply({
            content: '❌ Wystąpił błąd podczas zmiany prefiksu.',
            ephemeral: true
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
            return await interaction.reply({
                content: '❌ Nie masz utworzonego kanału głosowego. Dołącz do kanału trigger, aby go utworzyć.',
                ephemeral: true
            });
        }
        
        const channel = interaction.guild.channels.cache.get(userChannelId);
        if (!channel) {
            return await interaction.reply({
                content: '❌ Twój kanał głosowy nie został znaleziony.',
                ephemeral: true
            });
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
        return await interaction.reply({
            content: '❌ Limit może być tylko w zakresie 2-5 osób.',
            ephemeral: true
        });
    }
    
    try {
        await channel.setUserLimit(limit);
        
        await interaction.reply({
            content: `✅ Ustawiono limit kanału na: ${limit} osób`,
            ephemeral: true
        });
        
        console.log(`🔧 ${interaction.user.tag} ustawił limit kanału ${channel.name} na: ${limit}`);
        
    } catch (error) {
        console.error('❌ Błąd podczas zmiany limitu kanału:', error);
        await interaction.reply({
            content: '❌ Wystąpił błąd podczas zmiany limitu kanału.',
            ephemeral: true
        });
    }
}

// Obsługa zmiany nazwy kanału przez właściciela
async function handleChannelRename(interaction, channel) {
    const newName = interaction.options.getString('nazwa');
    
    try {
        const currentPrefix = getChannelPrefix(channel.name);
        const newChannelName = `${currentPrefix} ${newName}`;
        
        await channel.setName(newChannelName);
        
        await interaction.reply({
            content: `✅ Zmieniono nazwę kanału na: "${newChannelName}"`,
            ephemeral: true
        });
        
        console.log(`🔧 ${interaction.user.tag} zmienił nazwę swojego kanału na: ${newChannelName}`);
        
    } catch (error) {
        console.error('❌ Błąd podczas zmiany nazwy kanału:', error);
        await interaction.reply({
            content: '❌ Wystąpił błąd podczas zmiany nazwy kanału.',
            ephemeral: true
        });
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
                ephemeral: true
            });
        }

        // Sprawdź czy wiadomość istnieje
        let message;
        try {
            message = await channel.messages.fetch(messageId);
        } catch (error) {
            return await interaction.reply({
                content: `❌ Nie znaleziono wiadomości o ID: ${messageId} w kanale ${channelName}`,
                ephemeral: true
            });
        }

        // Znajdź rolę po nazwie
        const role = interaction.guild.roles.cache.find(r => r.name === roleName);
        if (!role) {
            return await interaction.reply({
                content: `❌ Nie znaleziono roli o nazwie: ${roleName}`,
                ephemeral: true
            });
        }

        // Sprawdź uprawnienia bota
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return await interaction.reply({
                content: '❌ Bot nie ma uprawnień do zarządzania rolami.',
                ephemeral: true
            });
        }

        // Sprawdź czy bot może przydzielić tę rolę
        if (role.position >= interaction.guild.members.me.roles.highest.position) {
            return await interaction.reply({
                content: `❌ Nie mogę przydzielić roli ${roleName} - jest wyżej w hierarchii niż moje role.`,
                ephemeral: true
            });
        }

        // Dodaj reakcję do wiadomości
        try {
            await message.react(emoji);
        } catch (error) {
            return await interaction.reply({
                content: `❌ Nie mogę dodać reakcji ${emoji}. Sprawdź czy emoji jest poprawne.`,
                ephemeral: true
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
            ephemeral: true
        });

        console.log(`🔧 ${interaction.user.tag} skonfigurował reaction role: ${emoji} -> ${roleName} w ${channel.name}`);

    } catch (error) {
        console.error('❌ Błąd podczas konfiguracji reaction role:', error);
        await interaction.reply({
            content: '❌ Wystąpił błąd podczas konfiguracji reaction role.',
            ephemeral: true
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
            await interaction.deferReply({ ephemeral: true });
            
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

// Funkcja pomocnicza do wyciągnięcia prefiksu z nazwy kanału
function getChannelPrefix(channelName) {
    const match = channelName.match(/^(\[.*?\])/); // Znajdź tekst w nawiasach kwadratowych na początku
    return match ? match[1] : (process.env.CHANNEL_PREFIX || '[BF6]');
}

module.exports = {
    commands: [configCommand, channelCommand, authCommand, clearCommand, ...moderationCommands],
    getChannelPrefix
};