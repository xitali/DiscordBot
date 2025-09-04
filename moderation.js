const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { addModerationEntry, loadModerationHistory } = require('./auto-moderation');

// ID kanału do logowania moderacji
const LOG_CHANNEL_ID = '1412925469338107945';

// Funkcja do wysyłania logów do kanału
async function sendLogToChannel(client, embed) {
    try {
        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
        if (logChannel) {
            await logChannel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Błąd podczas wysyłania loga do kanału:', error);
    }
}

// Komenda /warn - ostrzeżenie użytkownika
const warnCommand = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Ostrzeż użytkownika')
        .addUserOption(option =>
            option.setName('użytkownik')
                .setDescription('Użytkownik do ostrzeżenia')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('powód')
                .setDescription('Powód ostrzeżenia')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    async execute(interaction) {
        const targetUser = interaction.options.getUser('użytkownik');
        const reason = interaction.options.getString('powód');
        const moderator = interaction.user;
        
        // Sprawdzenie czy interakcja już została obsłużona
        let replied = false;
        
        try {
            // Sprawdzenie czy użytkownik jest na serwerze
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (!targetMember) {
                await interaction.reply({
                    content: '❌ Nie znaleziono użytkownika na tym serwerze.',
                    ephemeral: true
                });
                return;
            }
            
            // Sprawdzenie hierarchii ról
            if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
                await interaction.reply({
                    content: '❌ Nie możesz ostrzec użytkownika z wyższą lub równą rolą.',
                    ephemeral: true
                });
                return;
            }
            
            // Dodanie wpisu do historii moderacji
            addModerationEntry(targetUser.id, 'warn', reason, moderator.tag);
            
            // Utworzenie embeda z ostrzeżeniem
            const warnEmbed = new EmbedBuilder()
                .setColor(0xFFFF00)
                .setTitle('⚠️ Ostrzeżenie')
                .setDescription(`${targetUser} otrzymał ostrzeżenie od ${moderator}`)
                .addFields(
                    { name: 'Powód', value: reason, inline: false },
                    { name: 'Moderator', value: moderator.tag, inline: true },
                    { name: 'Data', value: new Date().toLocaleString('pl-PL'), inline: true }
                )
                .setTimestamp();
            
            // Wysłanie ostrzeżenia na kanał
            await interaction.reply({ embeds: [warnEmbed] });
            replied = true;
            
            // Wysłanie loga do kanału moderacji
            await sendLogToChannel(interaction.client, warnEmbed);
            
            // Próba wysłania DM do użytkownika
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(0xFFFF00)
                    .setTitle('⚠️ Otrzymałeś ostrzeżenie')
                    .setDescription(`Zostałeś ostrzeżony na serwerze **${interaction.guild.name}**`)
                    .addFields(
                        { name: 'Powód', value: reason, inline: false },
                        { name: 'Moderator', value: moderator.tag, inline: true }
                    )
                    .setTimestamp();
                
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.log(`Nie udało się wysłać DM do ${targetUser.tag}:`, dmError.message);
            }
            
            console.log(`⚠️ ${moderator.tag} ostrzegł ${targetUser.tag}: ${reason}`);
            
        } catch (error) {
            console.error('Błąd podczas ostrzegania:', error);
            if (!replied && !interaction.replied) {
                try {
                    await interaction.reply({
                        content: '❌ Wystąpił błąd podczas ostrzegania użytkownika.',
                        ephemeral: true
                    });
                } catch (replyError) {
                    console.error('Nie udało się wysłać odpowiedzi o błędzie:', replyError);
                }
            }
        }
    }
};

// Komenda /kick - wyrzucenie użytkownika
const kickCommand = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Wyrzuć użytkownika z serwera')
        .addUserOption(option =>
            option.setName('użytkownik')
                .setDescription('Użytkownik do wyrzucenia')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('powód')
                .setDescription('Powód wyrzucenia')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    
    async execute(interaction) {
        const targetUser = interaction.options.getUser('użytkownik');
        const reason = interaction.options.getString('powód');
        const moderator = interaction.user;
        
        // Sprawdzenie czy interakcja już została obsłużona
        let replied = false;
        
        try {
            // Sprawdzenie czy użytkownik jest na serwerze
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (!targetMember) {
                await interaction.reply({
                    content: '❌ Nie znaleziono użytkownika na tym serwerze.',
                    ephemeral: true
                });
                return;
            }
            
            // Sprawdzenie czy użytkownik może być wyrzucony
            if (!targetMember.kickable) {
                await interaction.reply({
                    content: '❌ Nie mogę wyrzucić tego użytkownika (prawdopodobnie ma wyższą rolę niż bot).',
                    ephemeral: true
                });
                return;
            }
            
            // Sprawdzenie hierarchii ról
            if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
                await interaction.reply({
                    content: '❌ Nie możesz wyrzucić użytkownika z wyższą lub równą rolą.',
                    ephemeral: true
                });
                return;
            }
            
            // Próba wysłania DM przed wyrzuceniem
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(0xFF4500)
                    .setTitle('👢 Zostałeś wyrzucony')
                    .setDescription(`Zostałeś wyrzucony z serwera **${interaction.guild.name}**`)
                    .addFields(
                        { name: 'Powód', value: reason, inline: false },
                        { name: 'Moderator', value: moderator.tag, inline: true }
                    )
                    .setTimestamp();
                
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.log(`Nie udało się wysłać DM do ${targetUser.tag}:`, dmError.message);
            }
            
            // Wyrzucenie użytkownika
            await targetMember.kick(reason);
            
            // Dodanie wpisu do historii moderacji
            addModerationEntry(targetUser.id, 'kick', reason, moderator.tag);
            
            // Utworzenie embeda z informacją o wyrzuceniu
            const kickEmbed = new EmbedBuilder()
                .setColor(0xFF4500)
                .setTitle('👢 Wyrzucenie')
                .setDescription(`${targetUser.tag} został wyrzucony z serwera`)
                .addFields(
                    { name: 'Powód', value: reason, inline: false },
                    { name: 'Moderator', value: moderator.tag, inline: true },
                    { name: 'Data', value: new Date().toLocaleString('pl-PL'), inline: true }
                )
                .setTimestamp();
            
            await interaction.reply({ embeds: [kickEmbed] });
            replied = true;
            
            // Wysłanie loga do kanału moderacji
            await sendLogToChannel(interaction.client, kickEmbed);
            
            console.log(`👢 ${moderator.tag} wyrzucił ${targetUser.tag}: ${reason}`);
            
        } catch (error) {
            console.error('Błąd podczas wyrzucania:', error);
            if (!replied && !interaction.replied) {
                try {
                    await interaction.reply({
                        content: '❌ Wystąpił błąd podczas wyrzucania użytkownika.',
                        ephemeral: true
                    });
                } catch (replyError) {
                    console.error('Nie udało się wysłać odpowiedzi o błędzie:', replyError);
                }
            }
        }
    }
};

// Komenda /ban - zbanowanie użytkownika
const banCommand = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Zbanuj użytkownika')
        .addUserOption(option =>
            option.setName('użytkownik')
                .setDescription('Użytkownik do zbanowania')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('powód')
                .setDescription('Powód bana')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('dni_wiadomości')
                .setDescription('Ile dni wiadomości usunąć (0-7, domyślnie 1)')
                .setMinValue(0)
                .setMaxValue(7))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    
    async execute(interaction) {
        const targetUser = interaction.options.getUser('użytkownik');
        const reason = interaction.options.getString('powód');
        const deleteMessageDays = interaction.options.getInteger('dni_wiadomości') || 1;
        const moderator = interaction.user;
        
        // Sprawdzenie czy interakcja już została obsłużona
        let replied = false;
        
        try {
            // Sprawdzenie czy użytkownik jest na serwerze
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            
            if (targetMember) {
                // Sprawdzenie czy użytkownik może być zbanowany
                if (!targetMember.bannable) {
                    await interaction.reply({
                        content: '❌ Nie mogę zbanować tego użytkownika (prawdopodobnie ma wyższą rolę niż bot).',
                        ephemeral: true
                    });
                    return;
                }
                
                // Sprawdzenie hierarchii ról
                if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
                    await interaction.reply({
                        content: '❌ Nie możesz zbanować użytkownika z wyższą lub równą rolą.',
                        ephemeral: true
                    });
                    return;
                }
                
                // Próba wysłania DM przed banem
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('🔨 Zostałeś zbanowany')
                        .setDescription(`Zostałeś zbanowany na serwerze **${interaction.guild.name}**`)
                        .addFields(
                            { name: 'Powód', value: reason, inline: false },
                            { name: 'Moderator', value: moderator.tag, inline: true }
                        )
                        .setTimestamp();
                    
                    await targetUser.send({ embeds: [dmEmbed] });
                } catch (dmError) {
                    console.log(`Nie udało się wysłać DM do ${targetUser.tag}:`, dmError.message);
                }
            }
            
            // Zbanowanie użytkownika
            await interaction.guild.members.ban(targetUser, {
                reason: reason,
                deleteMessageDays: deleteMessageDays
            });
            
            // Dodanie wpisu do historii moderacji
            addModerationEntry(targetUser.id, 'ban', reason, moderator.tag);
            
            // Utworzenie embeda z informacją o banie
            const banEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🔨 Ban')
                .setDescription(`${targetUser.tag} został zbanowany`)
                .addFields(
                    { name: 'Powód', value: reason, inline: false },
                    { name: 'Moderator', value: moderator.tag, inline: true },
                    { name: 'Usunięte wiadomości', value: `${deleteMessageDays} dni`, inline: true },
                    { name: 'Data', value: new Date().toLocaleString('pl-PL'), inline: true }
                )
                .setTimestamp();
            
            await interaction.reply({ embeds: [banEmbed] });
            replied = true;
            
            // Wysłanie loga do kanału moderacji
            await sendLogToChannel(interaction.client, banEmbed);
            
            console.log(`🔨 ${moderator.tag} zbanował ${targetUser.tag}: ${reason}`);
            
        } catch (error) {
            console.error('Błąd podczas banowania:', error);
            if (!replied && !interaction.replied) {
                try {
                    await interaction.reply({
                        content: '❌ Wystąpił błąd podczas banowania użytkownika.',
                        ephemeral: true
                    });
                } catch (replyError) {
                    console.error('Nie udało się wysłać odpowiedzi o błędzie:', replyError);
                }
            }
        }
    }
};

// Komenda /modlogs - wyświetlenie historii moderacji
const modlogsCommand = {
    data: new SlashCommandBuilder()
        .setName('modlogs')
        .setDescription('Wyświetl historię moderacji użytkownika')
        .addUserOption(option =>
            option.setName('użytkownik')
                .setDescription('Użytkownik do sprawdzenia (opcjonalnie)')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Liczba ostatnich wpisów (domyślnie 10)')
                .setMinValue(1)
                .setMaxValue(25))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    async execute(interaction) {
        const targetUser = interaction.options.getUser('użytkownik');
        const limit = interaction.options.getInteger('limit') || 10;
        
        try {
            const history = loadModerationHistory();
            let allEntries = [];
            
            // Konwersja nowego formatu (obiekt) do tablicy
            if (typeof history === 'object' && !Array.isArray(history)) {
                // Nowy format - obiekt z kluczami użytkowników
                for (const [userId, userEntries] of Object.entries(history)) {
                    if (Array.isArray(userEntries)) {
                        userEntries.forEach(entry => {
                            allEntries.push({
                                ...entry,
                                userId: userId,
                                action: entry.type || entry.action // Obsługa obu formatów
                            });
                        });
                    }
                }
            } else if (Array.isArray(history)) {
                // Stary format - tablica
                allEntries = history;
            }
            
            let filteredHistory = allEntries;
            if (targetUser) {
                filteredHistory = allEntries.filter(entry => entry.userId === targetUser.id);
            }
            
            // Sortowanie od najnowszych
            filteredHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // Ograniczenie do limitu
            const limitedHistory = filteredHistory.slice(0, limit);
            
            if (limitedHistory.length === 0) {
                const noLogsMessage = targetUser 
                    ? `Brak wpisów moderacyjnych dla użytkownika ${targetUser.tag}.`
                    : 'Brak wpisów moderacyjnych.';
                
                return await interaction.reply({
                    content: noLogsMessage,
                    ephemeral: true
                });
            }
            
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('📋 Historia Moderacji')
                .setDescription(targetUser ? `Historia dla użytkownika: ${targetUser.tag}` : 'Ostatnie akcje moderacyjne')
                .setTimestamp();
            
            // Dodanie wpisów do embeda
            limitedHistory.forEach((entry, index) => {
                const date = new Date(entry.timestamp).toLocaleString('pl-PL');
                const action = entry.action || entry.type || 'unknown';
                const actionEmoji = {
                    'warn': '⚠️',
                    'timeout': '🔇',
                    'kick': '👢',
                    'ban': '🔨'
                }[action] || '📝';
                
                embed.addFields({
                    name: `${actionEmoji} ${action.toUpperCase()} #${index + 1}`,
                    value: `**Użytkownik:** <@${entry.userId}>\n**Powód:** ${entry.reason}\n**Moderator:** ${entry.moderator}\n**Data:** ${date}`,
                    inline: false
                });
            });
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
            
        } catch (error) {
            console.error('Błąd podczas pobierania historii moderacji:', error);
            await interaction.reply({
                content: '❌ Wystąpił błąd podczas pobierania historii moderacji.',
                ephemeral: true
            });
        }
    }
};

module.exports = {
    commands: [warnCommand, kickCommand, banCommand, modlogsCommand]
};