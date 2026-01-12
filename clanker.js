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
const blacklistedGroupsNS = [795699811, 33700249]; // 🚩
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
            if (groupsList.length > 2048) {
                const midIndex = Math.floor(groupsList.length / 2);
                let splitIndex = groupsList.indexOf('\n', midIndex);
                if (splitIndex === -1) splitIndex = midIndex;
                const firstEmbed = groupsList.substring(0, splitIndex);
                const secondEmbed = groupsList.substring(splitIndex + 1);
                const embed1 = new MessageEmbed()
                    .setTitle(`${username}'s Roblox Groups (Part 1)`)
                    .setDescription(firstEmbed)
                    .setColor('#ff0000');
                const embed2 = new MessageEmbed()
                    .setTitle(`${username}'s Roblox Groups (Part 2)`)
                    .setDescription(secondEmbed)
                    .setColor('#ff0000');
                interaction.reply({ embeds: [embed1, embed2] });
                return;
            }

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
