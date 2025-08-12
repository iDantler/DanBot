const fs = require('fs');
const express = require('express');
const path = require('path');
require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, ChannelType } = require('discord.js');

// --- Configuración del servidor web ---
const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/edit', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'edit.html'));
});

app.get('/embeds', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Servidor web activo en el puerto ${port}`);
});

// --- Configuración del bot de Discord ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent
    ],
    partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
});

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

let embedsData = [];

const saveMessageData = () => {
    try {
        fs.writeFileSync('./data.json', JSON.stringify(embedsData, null, 2));
        console.log('[BOT] Datos de embeds guardados en data.json.');
    } catch (error) {
        console.error('Error al escribir en data.json:', error);
    }
};

const loadMessageData = () => {
    try {
        if (fs.existsSync('./data.json')) {
            const data = fs.readFileSync('./data.json');
            const parsedData = JSON.parse(data);
            console.log(`[BOT] ${parsedData.length} embeds cargados desde data.json.`);
            return parsedData;
        }
    } catch (error) {
        console.error('Error al leer de data.json:', error);
    }
    return []; // Devolver una lista vacía en caso de error o si el archivo no existe
};

client.once('ready', async () => {
    console.log(`¡El bot ${client.user.tag} está listo!`);
    embedsData = loadMessageData(); // Cargar los datos al inicio del bot
    
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: [] },
        );
    } catch (error) {
        console.error('Error al registrar/eliminar comandos:', error);
    }
});

app.get('/api/guilds', async (req, res) => {
    try {
        const guilds = client.guilds.cache.map(guild => ({
            id: guild.id,
            name: guild.name,
            iconURL: guild.iconURL() || false
        }));
        res.json(guilds);
    } catch (error) {
        console.error('Error al obtener los servidores:', error);
        res.status(500).json({ error: 'No se pudieron obtener los servidores.' });
    }
});

app.get('/api/channels', async (req, res) => {
    const { guildId } = req.query;
    if (!guildId) {
        return res.status(400).json({ error: 'Falta el parámetro guildId.' });
    }
    try {
        const guild = await client.guilds.fetch(guildId);
        const channels = guild.channels.cache
            .filter(c => c.type === ChannelType.GuildText)
            .map(c => ({ id: c.id, name: c.name }));
        res.json(channels);
    } catch (error) {
        console.error('Error al obtener los canales:', error);
        res.status(500).json({ error: 'No se pudieron obtener los canales.' });
    }
});

app.get('/api/roles', async (req, res) => {
    const { guildId } = req.query;
    if (!guildId) {
        return res.status(400).json({ error: 'Falta el parámetro guildId.' });
    }
    try {
        const guild = await client.guilds.fetch(guildId);
        const roles = guild.roles.cache
            .filter(r => !r.managed && r.id !== guild.id)
            .map(r => ({ id: r.id, name: r.name }));
        res.json(roles);
    } catch (error) {
        console.error('Error al obtener los roles:', error);
        res.status(500).json({ error: 'No se pudieron obtener los roles.' });
    }
});

app.get('/api/embeds', (req, res) => {
    res.json(embedsData);
});

app.get('/api/get-embed/:id', (req, res) => {
    const embed = embedsData.find(e => e.embedMessageId === req.params.id);
    if (!embed) {
        return res.status(404).json({ message: 'Embed no encontrado.' });
    }
    res.json(embed);
});

app.delete('/api/delete-embed/:id', async (req, res) => {
    const embedIndex = embedsData.findIndex(e => e.embedMessageId === req.params.id);
    if (embedIndex === -1) {
        return res.status(404).json({ success: false, message: 'Embed no encontrado.' });
    }

    const embedToDelete = embedsData[embedIndex];
    try {
        const channel = await client.channels.fetch(embedToDelete.channelId);
        const message = await channel.messages.fetch(embedToDelete.embedMessageId);
        await message.delete();
    } catch (error) {
        console.log(`El embed con ID ${embedToDelete.embedMessageId} ya no existe en Discord. Solo se eliminará de la lista.`);
    }

    embedsData.splice(embedIndex, 1);
    saveMessageData();
    res.status(200).json({ success: true, message: 'Embed eliminado con éxito.' });
});

const createDiscordEmbed = (data) => {
    const embed = new EmbedBuilder()
        .setColor(data.color)
        .setTitle(data.titulo)
        .setDescription(data.descripcion)
        .setTimestamp();

    if (data.autor) {
        embed.setAuthor({ name: data.autor });
    }
    if (data.imagen) {
        embed.setImage(data.imagen);
    }
    if (data.pie) {
        const footerOptions = { text: data.pie };
        if (data.pieIcono) {
            footerOptions.iconURL = data.pieIcono;
        }
        embed.setFooter(footerOptions);
    }
    if (data.fieldNames && data.fieldNames.length > 0) {
        for (let i = 0; i < data.fieldNames.length; i++) {
            if (data.fieldNames[i] && data.fieldValues[i]) {
                embed.addFields({ name: data.fieldNames[i], value: data.fieldValues[i], inline: true });
            }
        }
    }
    return embed;
};

app.post('/crear-embed', async (req, res) => {
    try {
        const data = req.body;
        if (!data.guildId) {
            return res.status(400).json({ success: false, message: 'No se ha seleccionado un servidor.' });
        }
        const channel = await client.channels.fetch(data.channelId);
        const embed = createDiscordEmbed(data);
        const sentMessage = await channel.send({ embeds: [embed] });

        // Añadir el emoji de reacción
        if (data.reactionEmoji) {
            await sentMessage.react(data.reactionEmoji);
        }

        embedsData.push({
            guildId: data.guildId,
            embedMessageId: sentMessage.id,
            channelId: sentMessage.channel.id,
            reactionEmoji: data.reactionEmoji,
            roleId: data.roleId,
            embedContent: embed.toJSON()
        });
        saveMessageData();

        res.status(200).json({ success: true, message: 'Embed creado con éxito!' });
    } catch (error) {
        console.error('Error al crear el embed desde la web:', error);
        res.status(500).json({ success: false, message: 'Hubo un error al crear el embed.' });
    }
});

app.post('/api/edit-embed', async (req, res) => {
    const data = req.body;
    const embedIndex = embedsData.findIndex(e => e.embedMessageId === data.embedMessageId);
    if (embedIndex === -1) {
        return res.status(404).json({ success: false, message: 'Embed no encontrado.' });
    }
    
    data.guildId = embedsData[embedIndex].guildId;

    try {
        const embedToEdit = embedsData[embedIndex];
        const channel = await client.channels.fetch(data.channelId);
        const message = await channel.messages.fetch(embedToEdit.embedMessageId);
        
        const newEmbed = createDiscordEmbed(data);
        await message.edit({ embeds: [newEmbed] });

        embedsData[embedIndex] = {
            guildId: data.guildId,
            embedMessageId: embedToEdit.embedMessageId,
            channelId: data.channelId,
            reactionEmoji: data.reactionEmoji,
            roleId: data.roleId,
            embedContent: newEmbed.toJSON()
        };
        saveMessageData();
        
        if (data.reactionEmoji !== embedToEdit.reactionEmoji) {
            await message.reactions.removeAll();
            await message.react(data.reactionEmoji);
        }

        res.status(200).json({ success: true, message: 'Embed editado con éxito.' });
    } catch (error) {
        console.error('Error al editar el embed:', error);
        res.status(500).json({ success: false, message: 'Hubo un error al editar el embed.' });
    }
});

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    
    // Buscar el embed por el ID del mensaje
    const embed = embedsData.find(e => e.embedMessageId === reaction.message.id);
    
    // Comprobar si el emoji de la reacción es el correcto
    if (!embed || reaction.emoji.name !== embed.reactionEmoji) return;
    
    try {
        const member = await reaction.message.guild.members.fetch(user.id);
        const role = reaction.message.guild.roles.cache.get(embed.roleId);
        if (role) {
            await member.roles.add(role);
            console.log(`Rol ${role.name} asignado a ${member.user.tag}`);
        }
    } catch (error) {
        console.error('Error al añadir el rol:', error);
    }
});

client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    
    // Buscar el embed por el ID del mensaje
    const embed = embedsData.find(e => e.embedMessageId === reaction.message.id);
    
    // Comprobar si el emoji de la reacción es el correcto
    if (!embed || reaction.emoji.name !== embed.reactionEmoji) return;
    
    try {
        const member = await reaction.message.guild.members.fetch(user.id);
        const role = reaction.message.guild.roles.cache.get(embed.roleId);
        if (role) {
            await member.roles.remove(role);
            console.log(`Rol ${role.name} quitado a ${member.user.tag}`);
        }
    } catch (error) {
        console.error('Error al quitar el rol:', error);
    }
});

client.login(process.env.DISCORD_BOT_TOKEN,
);
