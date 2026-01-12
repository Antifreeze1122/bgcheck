// Discord bot that pulls a user's current roblox avatar
// and embeds it as an image in Discord

require('dotenv').config();
const token = process.env.token;

const { Client, Intents, MessageEmbed } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fetch = require('node-fetch');
const fs = require('fs');

const client = new Client({
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
});

// Array of blacklisted group IDs
const blacklistedGroupsNS = [795699811, 33700249,13670820,8801488,35494044,
                            34244533,13300798,11577231,35490443,15956028,
                            181910361]; // 🚩
const blacklistedGroupsNLA = []; // 🟧
const blacklistedGroupsUniversal = []; // 🔵 (condo games and such)

// =========================
// LOG USER ONCE (INSTALL TRACKING)
// =========================
function logUserOnce(interaction) {
    const filePath = 'users.json';

    const newEntry = {
        discordUserId: interaction.user.id,
        discordUsername: interaction.user.tag,
        firstSeen: new Date().toISOString()
    };

    let users = [];

    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            if (data.trim()) {
                users = JSON.parse(data);
            }
        }

        const alreadyLogged = users.some(
            user => user.discordUserId === interaction.user.id
        );

        if (alreadyLogged) return;

        users.push(newEntry);
        fs.writeFileSync(filePath, JSON.stringify(users, null, 2));
        console.log(`New user logged: ${interaction.user.tag}`);

    } catch (error) {
        console.error('Error logging user:', error);
    }
}
// =========================


client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    const commands = [
        {
            name: 'avatar',
            description: 'Get a Roblox user\'s avatar',
            options: [
                {
                    name: 'username',
                    type: 3,
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
                    type: 3,
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
            { body: commands }
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});


client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    // Log user ONLY once
    logUserOnce(interaction);

    if (interaction.commandName === 'avatar') {
        const username = interaction.options.getString('username');

        try {
            const userResponse = await fetch(
                'https://users.roblox.com/v1/usernames/users',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usernames: [username] })
                }
            );

            const robloxUserData = await userResponse.json();

            if (!robloxUserData.data || robloxUserData.data.length === 0) {
                return interaction.reply('User not found.');
            }

            const userId = robloxUserData.data[0].id;

            const avatarResponse = await fetch(
                `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`
            );

            const avatarData = await avatarResponse.json();

            if (!avatarData.data || avatarData.data.length === 0) {
                return interaction.reply('Could not fetch avatar.');
            }

            const avatarUrl = avatarData.data[0].imageUrl;

            const embed = new MessageEmbed()
                .setTitle(`${username}'s Roblox Avatar`)
                .setImage(avatarUrl)
                .setColor('#ff0000');

            interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            interaction.reply('An error occurred while fetching the avatar.');
        }
    }


    if (interaction.commandName === 'groups') {
        const username = interaction.options.getString('username');

        try {
            const userResponse = await fetch(
                'https://users.roblox.com/v1/usernames/users',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usernames: [username] })
                }
            );

            const robloxUserData = await userResponse.json();

            if (!robloxUserData.data || robloxUserData.data.length === 0) {
                return interaction.reply('User not found.');
            }

            const userId = robloxUserData.data[0].id;

            const groupsResponse = await fetch(
                `https://groups.roblox.com/v2/users/${userId}/groups/roles`
            );

            const groupsData = await groupsResponse.json();

            if (!groupsData.data || groupsData.data.length === 0) {
                return interaction.reply('No groups found for this user.');
            }

            let groupsList = '';
            for (const group of groupsData.data) {
                const flag = blacklistedGroupsNS.includes(group.group.id) ? '🚩' : '';
                groupsList += `${flag} **${group.group.name}** - ${group.role.name}\n`;
            }
            for (const group of groupsData.data) {
                const flag = blacklistedGroupsNLA.includes(group.group.id) ? '🟧' : '';
                groupsList += `${flag} **${group.group.name}** - ${group.role.name}\n`;
            }
            for (const group of groupsData.data) {
                const flag = blacklistedGroupsUniversal.includes(group.group.id) ? '🔵' : '';
                groupsList += `${flag} **${group.group.name}** - ${group.role.name}\n`;
            }
            // see if the group list is too long to embed
            // if so, embed two messages
            const MAX = 2048;

            // Safely split text into chunks no larger than 2048 chars
            function splitToEmbeds(text, maxParts = 3) {
                const lines = text.split("\n");
                const parts = [];
                let current = "";

                for (const line of lines) {
                    // If adding this line would exceed the limit, push current and start new
                    if ((current + line + "\n").length > MAX) {
                        parts.push(current.trim());
                        current = line + "\n";

                        // Stop at maxParts
                        if (parts.length === maxParts - 1) break;
                    } else {
                        current += line + "\n";
                    }
                }

                // Add whatever remains
                if (parts.length < maxParts && current.trim().length > 0) {
                    parts.push(current.trim());
                }

                return parts;
            }

            const chunks = splitToEmbeds(groupsList, 3);

            const embeds = chunks.map((chunk, i) => {
                // Absolute final safety — truncate if somehow still too long
                if (chunk.length > MAX) {
                    chunk = chunk.substring(0, MAX - 3) + "...";
                }

                return new MessageEmbed()
                    .setTitle(`${username}'s Roblox Groups (Part ${i + 1})`)
                    .setDescription(chunk)
                    .setColor("#ff0000");
            });

            await interaction.reply({ embeds });

            const embed = new MessageEmbed()
                .setTitle(`${username}'s Roblox Groups`)
                .setDescription(groupsList)
                .setColor('#ff0000');

            interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            interaction.reply('An error occurred while fetching the groups.');
        }
    }
});

client.login(token);
