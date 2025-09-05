const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Ścieżka do pliku z ankietami
const POLLS_FILE = path.join(__dirname, 'polls.json');

// Funkcja pomocnicza do bezpiecznej obsługi odpowiedzi na interakcje
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
        } else if (error.message.includes('already been acknowledged')) {
            // Pomijamy log dla już obsłużonych interakcji
        } else {
            console.error('❌ Błąd podczas odpowiedzi na interakcję:', error.message);
        }
        return null;
    }
}

// Funkcja do ładowania ankiet z pliku
function loadPolls() {
    try {
        if (fs.existsSync(POLLS_FILE)) {
            const data = fs.readFileSync(POLLS_FILE, 'utf8');
            return JSON.parse(data);
        }
        return {};
    } catch (error) {
        console.error('❌ Błąd podczas ładowania ankiet:', error);
        return {};
    }
}

// Funkcja do zapisywania ankiet do pliku
function savePolls(polls) {
    try {
        fs.writeFileSync(POLLS_FILE, JSON.stringify(polls, null, 2));
    } catch (error) {
        console.error('❌ Błąd podczas zapisywania ankiet:', error);
    }
}

// Funkcja sprawdzająca uprawnienia moderacyjne
function hasModeratorPermissions(member) {
    // Sprawdź uprawnienia Discord
    if (member.permissions.has([PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers])) {
        return true;
    }
    
    // Sprawdź rolę "Moderator"
    return member.roles.cache.some(role => role.name === 'Moderator');
}

// Komenda /poll create - tworzenie ankiety
const pollCreateCommand = {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Zarządzaj ankietami')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Utwórz nową ankietę')
                .addStringOption(option =>
                    option.setName('question')
                        .setDescription('Pytanie ankiety')
                        .setRequired(true)
                        .setMaxLength(200))
                .addStringOption(option =>
                    option.setName('option1')
                        .setDescription('Pierwsza opcja')
                        .setRequired(true)
                        .setMaxLength(100))
                .addStringOption(option =>
                    option.setName('option2')
                        .setDescription('Druga opcja')
                        .setRequired(true)
                        .setMaxLength(100))
                .addStringOption(option =>
                    option.setName('option3')
                        .setDescription('Trzecia opcja (opcjonalna)')
                        .setRequired(false)
                        .setMaxLength(100))
                .addStringOption(option =>
                    option.setName('option4')
                        .setDescription('Czwarta opcja (opcjonalna)')
                        .setRequired(false)
                        .setMaxLength(100))
                .addIntegerOption(option =>
                    option.setName('duration')
                        .setDescription('Czas trwania ankiety w minutach (5-1440)')
                        .setRequired(false)
                        .setMinValue(5)
                        .setMaxValue(1440)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('results')
                .setDescription('Wyświetl wyniki ankiety')
                .addStringOption(option =>
                    option.setName('poll_id')
                        .setDescription('ID ankiety')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('close')
                .setDescription('Zamknij ankietę')
                .addStringOption(option =>
                    option.setName('poll_id')
                        .setDescription('ID ankiety do zamknięcia')
                        .setRequired(true)
                        .setAutocomplete(true))),
    
    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'create') {
            await handlePollCreate(interaction, client);
        } else if (subcommand === 'results') {
            await handlePollResults(interaction);
        } else if (subcommand === 'close') {
            await handlePollClose(interaction, client);
        }
    },

    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        
        if (focusedOption.name === 'poll_id') {
            const polls = loadPolls();
            const activePolls = Object.values(polls).filter(poll => poll.active);
            
            const choices = activePolls.slice(0, 25).map(poll => {
                const shortQuestion = poll.question.length > 50 ? 
                    poll.question.substring(0, 47) + '...' : poll.question;
                return {
                    name: `${poll.id} - ${shortQuestion}`,
                    value: poll.id
                };
            });
            
            // Filtruj wybory na podstawie tego co użytkownik wpisał
            const filtered = choices.filter(choice => 
                choice.name.toLowerCase().includes(focusedOption.value.toLowerCase())
            );
            
            await interaction.respond(filtered.slice(0, 25));
        }
    }
};

// Obsługa tworzenia ankiety
async function handlePollCreate(interaction, client) {
    try {
        // Sprawdzenie uprawnień moderacyjnych
        if (!hasModeratorPermissions(interaction.member)) {
            await safeReply(interaction, {
                content: '❌ Nie masz uprawnień do tworzenia ankiet. Wymagana rola Moderator lub odpowiednie uprawnienia.',
                flags: 64
            });
            return;
        }
        
        const question = interaction.options.getString('question');
        const option1 = interaction.options.getString('option1');
        const option2 = interaction.options.getString('option2');
        const option3 = interaction.options.getString('option3');
        const option4 = interaction.options.getString('option4');
        const duration = interaction.options.getInteger('duration') || 60; // Domyślnie 60 minut
        
        // Przygotowanie opcji ankiety
        const options = [option1, option2];
        if (option3) options.push(option3);
        if (option4) options.push(option4);
        
        // Generowanie krótkiego ID ankiety
        const pollId = Math.random().toString(36).substr(2, 8).toUpperCase();
        
        // Tworzenie embeda ankiety w przyjaznym stylu z wynikami na żywo
        const pollEmbed = new EmbedBuilder()
            .setColor(0x5865F2) // Przyjazny niebieski kolor Discord
            .setTitle('📊 Ankieta (na żywo)')
            .setDescription(`**${question}**\n\n` + 
                `${options.map((opt, index) => {
                    const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
                    const bar = '░'.repeat(50); // Pusty pasek na początku
                    return `${numberEmojis[index]} **${opt}**\n\`${bar}\` 0 głosów (0%)`;
                }).join('\n\n')}`)
            .addFields(
                { name: '🆔 ID Ankiety', value: `\`${pollId}\``, inline: true },
                { name: '👤 Utworzona przez', value: `${interaction.member.displayName}`, inline: true },
                { name: '📊 Łączna liczba głosów', value: '0', inline: true }
            )
            .setTimestamp()
            .setFooter({ 
                text: 'Wyniki aktualizują się na żywo • Zagłosuj klikając przycisk', 
                iconURL: interaction.user.displayAvatarURL()
            });
        
        // Tworzenie przycisków do głosowania w przyjaznym stylu
        const buttons = [];
        const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
        
        for (let i = 0; i < options.length; i++) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`poll_vote_${pollId}_${i}`)
                    .setLabel(`${options[i]}`)
                    .setEmoji(numberEmojis[i])
                    .setStyle(ButtonStyle.Primary)
            );
        }
        
        const row = new ActionRowBuilder().addComponents(buttons);
        
        // Wysłanie ankiety
        const pollReply = await safeReply(interaction, {
            embeds: [pollEmbed],
            components: [row]
        });
        
        if (!pollReply) {
            console.error('❌ Nie udało się wysłać ankiety - interakcja wygasła');
            return;
        }
        
        const pollMessage = await interaction.fetchReply();
        
        // Zapisanie ankiety do pliku
        const polls = loadPolls();
        polls[pollId] = {
            id: pollId,
            question: question,
            options: options,
            votes: {},
            createdBy: interaction.user.id,
            createdAt: Date.now(),
            duration: duration * 60 * 1000, // Konwersja na milisekundy
            messageId: pollMessage.id,
            channelId: interaction.channel.id,
            guildId: interaction.guild.id,
            active: true
        };
        
        savePolls(polls);
        
        // Ustawienie timera do automatycznego zamknięcia ankiety
        setTimeout(async () => {
            await closePollAutomatically(client, pollId);
        }, duration * 60 * 1000);
        
        console.log(`📊 ${interaction.member.displayName} utworzył ankietę: ${question}`);
        
    } catch (error) {
        console.error('❌ Błąd podczas tworzenia ankiety:', error);
        await safeReply(interaction, {
            content: '❌ Wystąpił błąd podczas tworzenia ankiety.',
            flags: 64
        });
    }
}

// Obsługa wyświetlania wyników ankiety
async function handlePollResults(interaction) {
    try {
        const pollId = interaction.options.getString('poll_id');
        const polls = loadPolls();
        
        if (!polls[pollId]) {
            await safeReply(interaction, {
                content: '❌ Nie znaleziono ankiety o podanym ID.',
                flags: 64
            });
            return;
        }
        
        const poll = polls[pollId];
        const totalVotes = Object.keys(poll.votes).length;
        
        // Obliczanie wyników
        const results = {};
        poll.options.forEach((option, index) => {
            results[index] = 0;
        });
        
        Object.values(poll.votes).forEach(voteIndex => {
            results[voteIndex]++;
        });
        
        // Tworzenie embeda z wynikami
        const resultsEmbed = new EmbedBuilder()
            .setColor(poll.active ? 0x0099FF : 0x808080)
            .setTitle('📊 Wyniki Ankiety')
            .setDescription(`**${poll.question}**\n\n${poll.options.map((option, index) => {
                const votes = results[index] || 0;
                const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                const bar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
                return `${index + 1}️⃣ **${option}**\n${bar} ${votes} głosów (${percentage}%)`;
            }).join('\n\n')}`)
            .addFields(
                { name: 'Łączna liczba głosów', value: totalVotes.toString(), inline: true },
                { name: 'Status', value: poll.active ? '🟢 Aktywna' : '🔴 Zamknięta', inline: true },
                { name: 'ID Ankiety', value: pollId, inline: true }
            )
            .setTimestamp(poll.createdAt)
            .setFooter({ text: `Utworzona przez ${interaction.guild.members.cache.get(poll.createdBy)?.displayName || 'Nieznany użytkownik'}` });
        
        await safeReply(interaction, { embeds: [resultsEmbed], flags: 64 });
        
    } catch (error) {
        console.error('❌ Błąd podczas wyświetlania wyników ankiety:', error);
        await safeReply(interaction, {
            content: '❌ Wystąpił błąd podczas wyświetlania wyników ankiety.',
            flags: 64
        });
    }
}

// Obsługa zamykania ankiety
async function handlePollClose(interaction, client) {
    try {
        // Sprawdzenie uprawnień moderacyjnych
        if (!hasModeratorPermissions(interaction.member)) {
            await safeReply(interaction, {
                content: '❌ Nie masz uprawnień do zamykania ankiet. Wymagana rola Moderator lub odpowiednie uprawnienia.',
                flags: 64
            });
            return;
        }
        
        const pollId = interaction.options.getString('poll_id');
        const polls = loadPolls();
        
        if (!polls[pollId]) {
            await safeReply(interaction, {
                content: '❌ Nie znaleziono ankiety o podanym ID.',
                flags: 64
            });
            return;
        }
        
        const poll = polls[pollId];
        
        // Sprawdzenie czy użytkownik może zamknąć ankietę
        if (poll.createdBy !== interaction.user.id && !hasModeratorPermissions(interaction.member)) {
            await safeReply(interaction, {
                content: '❌ Możesz zamknąć tylko swoje ankiety lub musisz mieć uprawnienia moderatora.',
                flags: 64
            });
            return;
        }
        
        if (!poll.active) {
            await safeReply(interaction, {
                content: '❌ Ta ankieta jest już zamknięta.',
                flags: 64
            });
            return;
        }
        
        // Zamknięcie ankiety
        poll.active = false;
        poll.closedAt = Date.now();
        poll.closedBy = interaction.user.id;
        
        savePolls(polls);
        
        // Aktualizacja wiadomości ankiety
        try {
            const channel = client.channels.cache.get(poll.channelId);
            if (channel) {
                const message = await channel.messages.fetch(poll.messageId);
                if (message) {
                    const updatedEmbed = EmbedBuilder.from(message.embeds[0])
                        .setColor(0x808080)
                        .setTitle('📊 Ankieta [ZAMKNIĘTA]')
                        .addFields({ name: 'Zamknięta przez', value: interaction.member.displayName, inline: true });
                    
                    await message.edit({
                        embeds: [updatedEmbed],
                        components: [] // Usunięcie przycisków
                    });
                }
            }
        } catch (updateError) {
            console.error('❌ Błąd podczas aktualizacji wiadomości ankiety:', updateError);
        }
        
        // Wysłanie informacji o zamknięciu do kanału mod-log
        try {
            const { results, totalVotes } = generatePollResults(poll);
            const modLogChannel = client.channels.cache.get('1412925469338107945');
            if (modLogChannel) {
                const modLogEmbed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('📊 Ankieta zamknięta ręcznie')
                    .setDescription(`**Pytanie:** ${poll.question}\n\n` +
                        `**Wyniki:**\n` +
                        `${poll.options.map((option, index) => {
                            const votes = results[index] || 0;
                            const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                            const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
                            const winner = votes === Math.max(...Object.values(results)) && votes > 0 ? '🏆 ' : '';
                            return `${winner}${numberEmojis[index]} ${option}: **${votes}** głosów (${percentage}%)`;
                        }).join('\n')}`)
                    .addFields(
                        { name: '📊 Łączna liczba głosów', value: `${totalVotes}`, inline: true },
                        { name: '🆔 ID Ankiety', value: `\`${pollId}\``, inline: true },
                        { name: '📍 Kanał', value: `<#${poll.channelId}>`, inline: true },
                        { name: '👤 Zamknięta przez', value: `${interaction.member.displayName}`, inline: true }
                    )
                    .setTimestamp(poll.closedAt)
                    .setFooter({ text: 'Ankieta zamknięta ręcznie przez moderatora' });
                
                await modLogChannel.send({ embeds: [modLogEmbed] });
            }
        } catch (modLogError) {
            console.error('❌ Błąd podczas wysyłania do mod-log:', modLogError);
        }

        await safeReply(interaction, {
            content: `✅ Ankieta "${poll.question}" została zamknięta.`,
            flags: 64
        });
        
        console.log(`📊 ${interaction.member.displayName} zamknął ankietę: ${poll.question}`);
        
    } catch (error) {
        console.error('❌ Błąd podczas zamykania ankiety:', error);
        await safeReply(interaction, {
            content: '❌ Wystąpił błąd podczas zamykania ankiety.',
            flags: 64
        });
    }
}

// Automatyczne zamykanie ankiety po upływie czasu
// Funkcja do generowania wyników ankiety
function generatePollResults(poll) {
    const totalVotes = Object.keys(poll.votes).length;
    const results = {};
    
    // Inicjalizacja wyników
    poll.options.forEach((option, index) => {
        results[index] = 0;
    });
    
    // Liczenie głosów
    Object.values(poll.votes).forEach(voteIndex => {
        results[voteIndex]++;
    });
    
    return { results, totalVotes };
}

async function closePollAutomatically(client, pollId) {
    try {
        const polls = loadPolls();
        
        if (!polls[pollId] || !polls[pollId].active) {
            return; // Ankieta już zamknięta lub nie istnieje
        }
        
        const poll = polls[pollId];
        poll.active = false;
        poll.closedAt = Date.now();
        poll.closedBy = 'system';
        
        savePolls(polls);
        
        // Generowanie wyników
        const { results, totalVotes } = generatePollResults(poll);
        
        // Aktualizacja wiadomości ankiety z wynikami
        try {
            const channel = client.channels.cache.get(poll.channelId);
            if (channel) {
                const message = await channel.messages.fetch(poll.messageId);
                if (message) {
                    // Tworzenie embeda z wynikami w przyjaznym stylu
                    const resultsEmbed = new EmbedBuilder()
                        .setColor(0x00D166) // Zielony kolor dla zakończonej ankiety
                        .setTitle('✅ Ankieta zakończona - Wyniki')
                        .setDescription(`**${poll.question}**\n\n` +
                            `**📊 Wyniki głosowania:**\n\n` +
                            `${poll.options.map((option, index) => {
                                const votes = results[index] || 0;
                                const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                                const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
                                const barLength = Math.floor(percentage / 2); // 50 znaków max
                                const bar = '█'.repeat(barLength) + '░'.repeat(50 - barLength);
                                const winner = votes === Math.max(...Object.values(results)) && votes > 0 ? '🏆 ' : '';
                                return `${winner}${numberEmojis[index]} **${option}**\n\`${bar}\` ${votes} głosów (${percentage}%)`;
                            }).join('\n\n')}`)
                        .addFields(
                            { name: '📊 Łączna liczba głosów', value: `${totalVotes}`, inline: true },
                            { name: '📋 Status', value: 'Zakończona', inline: true },
                            { name: '🆔 ID Ankiety', value: `\`${pollId}\``, inline: true }
                        )
                        .setTimestamp(poll.closedAt)
                        .setFooter({ 
                            text: `Ankieta zakończona automatycznie`, 
                            iconURL: client.user.displayAvatarURL()
                        });
                    
                    await message.edit({
                        embeds: [resultsEmbed],
                        components: [] // Usunięcie przycisków
                    });
                }
            }
        } catch (updateError) {
            console.error('❌ Błąd podczas automatycznej aktualizacji ankiety:', updateError);
        }
        
        // Wysłanie wyników do kanału mod-log
        try {
            const modLogChannel = client.channels.cache.get('1412925469338107945');
            if (modLogChannel) {
                const modLogEmbed = new EmbedBuilder()
                    .setColor(0x00D166)
                    .setTitle('📊 Ankieta zakończona')
                    .setDescription(`**Pytanie:** ${poll.question}\n\n` +
                        `**Wyniki:**\n` +
                        `${poll.options.map((option, index) => {
                            const votes = results[index] || 0;
                            const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                            const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
                            const winner = votes === Math.max(...Object.values(results)) && votes > 0 ? '🏆 ' : '';
                            return `${winner}${numberEmojis[index]} ${option}: **${votes}** głosów (${percentage}%)`;
                        }).join('\n')}`)
                    .addFields(
                        { name: '📊 Łączna liczba głosów', value: `${totalVotes}`, inline: true },
                        { name: '🆔 ID Ankiety', value: `\`${pollId}\``, inline: true },
                        { name: '📍 Kanał', value: `<#${poll.channelId}>`, inline: true }
                    )
                    .setTimestamp(poll.closedAt)
                    .setFooter({ text: 'Ankieta zakończona automatycznie' });
                
                await modLogChannel.send({ embeds: [modLogEmbed] });
            }
        } catch (modLogError) {
            console.error('❌ Błąd podczas wysyłania do mod-log:', modLogError);
        }

        console.log(`📊 Ankieta "${poll.question}" została automatycznie zamknięta z ${totalVotes} głosami`);
        
    } catch (error) {
        console.error('❌ Błąd podczas automatycznego zamykania ankiety:', error);
    }
}

// Obsługa głosowania na ankietę
async function handlePollVote(interaction) {
    try {
        const parts = interaction.customId.split('_');
        // Format: poll_vote_poll_TIMESTAMP_RANDOMID_OPTIONINDEX
        const pollId = `${parts[2]}_${parts[3]}_${parts[4]}`;
        const optionIndex = parts[5];
        const polls = loadPolls();
        
        if (!polls[pollId]) {
            await safeReply(interaction, {
                content: '❌ Ankieta nie została znaleziona.',
                flags: 64
            });
            return;
        }
        
        const poll = polls[pollId];
        
        if (!poll.active) {
            await safeReply(interaction, {
                content: '❌ Ta ankieta jest już zamknięta.',
                flags: 64
            });
            return;
        }
        
        const userId = interaction.user.id;
        const previousVote = poll.votes[userId];
        
        // Zapisanie głosu
        poll.votes[userId] = parseInt(optionIndex);
        savePolls(polls);
        
        const selectedOption = poll.options[parseInt(optionIndex)];
        
        if (previousVote !== undefined) {
            await safeReply(interaction, {
                content: `✅ Zmieniono głos na: **${selectedOption}**`,
                flags: 64
            });
        } else {
            await safeReply(interaction, {
                content: `✅ Zagłosowano na: **${selectedOption}**`,
                flags: 64
            });
        }
        
        // Aktualizacja embeda ankiety z wynikami w czasie rzeczywistym
        try {
            const { results, totalVotes } = generatePollResults(poll);
            const channel = interaction.client.channels.cache.get(poll.channelId);
            if (channel) {
                const message = await channel.messages.fetch(poll.messageId);
                if (message) {
                    // Tworzenie zaktualizowanego embeda z wynikami
                    const updatedEmbed = new EmbedBuilder()
                        .setColor(0x5865F2)
                        .setTitle('📊 Ankieta (na żywo)')
                        .setDescription(`**${poll.question}**\n\n` + 
                            `${poll.options.map((opt, index) => {
                                const votes = results[index] || 0;
                                const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                                const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
                                const barLength = Math.floor(percentage / 2); // 50 znaków max
                                const bar = '█'.repeat(barLength) + '░'.repeat(50 - barLength);
                                return `${numberEmojis[index]} **${opt}**\n\`${bar}\` ${votes} głosów (${percentage}%)`;
                            }).join('\n\n')}`)
                        .addFields(
                            { name: '🆔 ID Ankiety', value: `\`${pollId}\``, inline: true },
                            { name: '👤 Utworzona przez', value: `${poll.createdBy}`, inline: true },
                            { name: '📊 Łączna liczba głosów', value: `${totalVotes}`, inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ 
                            text: 'Wyniki aktualizują się na żywo • Zagłosuj klikając przycisk', 
                            iconURL: interaction.client.user.displayAvatarURL()
                        });
                    
                    // Zachowanie oryginalnych przycisków
                    await message.edit({
                        embeds: [updatedEmbed],
                        components: message.components
                    });
                }
            }
        } catch (updateError) {
            console.error('❌ Błąd podczas aktualizacji ankiety na żywo:', updateError);
        }

        console.log(`📊 ${interaction.user.tag} zagłosował w ankiecie "${poll.question}" na opcję: ${selectedOption}`);
        
    } catch (error) {
        console.error('❌ Błąd podczas głosowania:', error);
        await safeReply(interaction, {
            content: '❌ Wystąpił błąd podczas głosowania.',
            flags: 64
        });
    }
}

module.exports = {
    commands: [pollCreateCommand],
    handlePollVote,
    loadPolls,
    savePolls
};