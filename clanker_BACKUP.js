// Discord bot that pulls a user's current roblox avatar 
// and embeds it as an image in Discord

require('dotenv').config();
const token = process.env.token;
const { Client, Intents, MessageEmbed } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fetch = require('node-fetch');
const fs = require('fs');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

// Array of blacklisted group IDs
const blacklistedGroups = [795699811]; // Add group IDs here, e.g., [123456, 789012]

// Function to log interactions to JSON file
function logInteraction(command, username, discordUserId) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        command,
        robloxUsername: username,
        discordUserId
    };
    let logs = [];
    try {
        if (fs.existsSync('logs.json')) {
            const data = fs.readFileSync('logs.json', 'utf8');
            if (data.trim()) {
                logs = JSON.parse(data);
            }
        }
        logs.push(logEntry);
        fs.writeFileSync('logs.json', JSON.stringify(logs, null, 2));
    } catch (error) {
        console.error('Error logging interaction:', error);
    }
}

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    const commands = [
        {
            name: 'avatar',
            description: 'Get a Roblox user\'s avatar',
            options: [
                {
                    name: 'username',
                    type: 3, // STRING
                    description: 'The Roblox username',
                    required: true
                }
            ]
        },
        {
            name: 'groups',
            description: 'Get a Roblox user\'s groups and ranks',
            options: [
                {
                    name: 'username',
                    type: 3, // STRING
                    description: 'The Roblox username',
                    required: true
                }
            ]
        }
    ];

    const rest = new REST({ version: '9' }).setToken(token);

    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    // Quickly save who is using the bot, so we can track who installed it.
    const userData = {
        id: interaction.user.id,
    };

    if (interaction.commandName === 'avatar') {
        const username = interaction.options.getString('username');

        try {
            // Get user ID from username
            const userResponse = await fetch('https://users.roblox.com/v1/usernames/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ usernames: [username] })
            });
            const userData = await userResponse.json();

            if (!userData.data || userData.data.length === 0) {
                return interaction.reply('User not found.');
            }

            const userId = userData.data[0].id;

            // Get avatar thumbnail
            const avatarResponse = await fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`);
            const avatarData = await avatarResponse.json();

            if (!avatarData.data || avatarData.data.length === 0) {
                return interaction.reply('Could not fetch avatar.');
            }

            const avatarUrl = avatarData.data[0].imageUrl;

            // Create embed
            const embed = new MessageEmbed()
                .setTitle(`${username}'s Roblox Avatar`)
                .setImage(avatarUrl)
                .setColor('#ff0000');

            interaction.reply({ embeds: [embed] });
            logInteraction('avatar', username, interaction.user.id);
        } catch (error) {
            console.error(error);
            interaction.reply('An error occurred while fetching the avatar.');
        }
    }

    if (interaction.commandName === 'groups') {
        const username = interaction.options.getString('username');

        try {
            // Get user ID from username
            const userResponse = await fetch('https://users.roblox.com/v1/usernames/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ usernames: [username] })
            });
            const userData = await userResponse.json();

            if (!userData.data || userData.data.length === 0) {
                return interaction.reply('User not found.');
            }

            const userId = userData.data[0].id;

            // Get user's groups and roles
            const groupsResponse = await fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
            const groupsData = await groupsResponse.json();

            if (!groupsData.data || groupsData.data.length === 0) {
                return interaction.reply('No groups found for this user.');
            }

            let groupsList = '';
            for (const group of groupsData.data) {
                const flag = blacklistedGroups.includes(group.group.id) ? '🚩' : '';
                groupsList += `${flag} **${group.group.name}** - ${group.role.name}\n`;
            }

            // Create embed
            const embed = new MessageEmbed()
                .setTitle(`${username}'s Roblox Groups`)
                .setDescription(groupsList)
                .setColor('#ff0000');

            interaction.reply({ embeds: [embed] });
            logInteraction('groups', username, interaction.user.id);
        } catch (error) {
            console.error(error);
            interaction.reply('An error occurred while fetching the groups.');
        }
    }
});

client.login(token);