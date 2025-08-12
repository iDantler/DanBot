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
        const roles = guild.roles.cache.map(role => ({
            id: role.id,
            name: role.name,
            color: role.hexColor,
            mentionable: role.mentionable
        }));
        res.json(roles);
    } catch (error) {
        console.error('Error al obtener los roles:', error);
        res.status(500).json({ error: 'No se pudieron obtener los roles.' });
    }
});

app.get('/api/embeds', (req, res) => {
    try {
        res.json(embedsData);
    } catch (error) {
        console.error('Error al obtener los embeds:', error);
        res.status(500).json({ error: 'No se pudieron obtener los embeds.' });
    }
});

// Nueva ruta para obtener un embed específico por su ID
app.get('/api/get-embed/:messageId', (req, res) => {
    try {
        const { messageId } = req.params;
        const embed = embedsData.find(e => e.embedMessageId === messageId);
        if (!embed) {
            return res.status(404).json({ error: 'Embed no encontrado.' });
        }
        res.json(embed);
    } catch (error) {
        console.error('Error al obtener el embed:', error);
        res.status(500).json({ error: 'No se pudo obtener el embed.' });
    }
});

// Ruta corregida para editar un embed
app.post('/api/edit-embed', async (req, res) => {
    try {
        const { embedMessageId, channelId, color, autor, titulo, descripcion, imagen, thumbnail, footer, footerIcon, reactionEmoji, fieldNames, fieldValues } = req.body;

        const embedToEditIndex = embedsData.findIndex(e => e.embedMessageId === embedMessageId);
        if (embedToEditIndex === -1) {
            return res.status(404).json({ success: false, message: 'Embed no encontrado.' });
        }

        const embedToEdit = embedsData[embedToEditIndex];
        const guild = await client.guilds.fetch(embedToEdit.guildId);
        const channel = guild.channels.cache.get(channelId);

        if (!channel) {
            return res.status(404).json({ success: false, message: 'Canal no encontrado.' });
        }

        const message = await channel.messages.fetch(embedMessageId).catch(() => null);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Mensaje de embed no encontrado en Discord.' });
        }

        const updatedEmbed = new EmbedBuilder()
            .setTitle(titulo)
            .setDescription(descripcion)
            .setColor(parseInt(color.replace('#', '0x'), 16));
        
        if (autor && autor.trim().length > 0) {
            updatedEmbed.setAuthor({ name: autor });
        }

        if (imagen) {
            updatedEmbed.setImage(imagen);
        }

        if (thumbnail) {
            updatedEmbed.setThumbnail(thumbnail);
        }

        if (footer || footerIcon) {
            const footerText = footer && footer.trim().length > 0 ? footer : '';
            if (footerText || footerIcon) {
                updatedEmbed.setFooter({
                    text: footerText,
                    iconURL: footerIcon || ''
                });
            }
        }
        
        const fields = fieldNames.map((name, index) => ({
            name: name,
            value: fieldValues[index],
            inline: true,
        }));

        if (fields.length > 0) {
            updatedEmbed.addFields(fields);
        }
        
        await message.edit({ embeds: [updatedEmbed] });

        if (message.reactions) {
            await message.reactions.removeAll().catch(error => console.error('Error al eliminar reacciones:', error));
        }
        if (reactionEmoji) {
            await message.react(reactionEmoji);
        }

        embedsData[embedToEditIndex].embedContent = {
            color: parseInt(color.replace('#', '0x'), 16),
            author: autor ? { name: autor } : null,
            title: titulo,
            description: descripcion,
            image: imagen ? { url: imagen } : null,
            thumbnail: thumbnail ? { url: thumbnail } : null,
            footer: (footer || footerIcon) ? { text: footer, icon_url: footerIcon } : null,
            fields: fields,
        };
        embedsData[embedToEditIndex].reactionEmoji = reactionEmoji;
        embedsData[embedToEditIndex].channelId = channelId;
        embedsData[embedToEditIndex].roleId = req.body.roleId;

        saveMessageData();
        
        res.json({ success: true, message: 'Embed editado correctamente.' });

    } catch (error) {
        console.error('Error al editar el embed:', error);
        res.status(500).json({ success: false, message: 'Error al editar el embed.' });
    }
});


// Ruta corregida para crear un nuevo embed
app.post('/api/embed', async (req, res) => {
    try {
        const { embedMessageId, guildId, channelId, embedData, reactionEmoji, roleId } = req.body;
        const guild = await client.guilds.fetch(guildId);
        const channel = guild.channels.cache.get(channelId);
        if (!channel) {
            return res.status(404).json({ error: 'Canal no encontrado.' });
        }
        
        let message;
        if (embedMessageId) {
            message = await channel.messages.fetch(embedMessageId).catch(() => null);
            if (message) {
                const existingEmbed = message.embeds[0];
                const updatedEmbed = new EmbedBuilder(existingEmbed).addFields(embedData.fields || []);
                await message.edit({ embeds: [updatedEmbed] });
                
                const embedIndex = embedsData.findIndex(e => e.embedMessageId === embedMessageId);
                if (embedIndex !== -1) {
                    embedsData[embedIndex] = { ...embedsData[embedIndex], embedData };
                }
                saveMessageData();
                return res.status(200).json({ message: 'Embed actualizado correctamente.', embedMessageId });
            }
        }
        
        const newEmbed = new EmbedBuilder()
            .setTitle(embedData.title)
            .setDescription(embedData.description)
            // LÍNEA CORREGIDA: Se convierte el color de string a número.
            .setColor(parseInt(embedData.color.replace('#', '0x'), 16));

        if (embedData.author && embedData.author.name) {
            newEmbed.setAuthor({ name: embedData.author.name });
        }
        if (embedData.image && embedData.image.url) {
            newEmbed.setImage(embedData.image.url);
        }
        if (embedData.thumbnail && embedData.thumbnail.url) {
            newEmbed.setThumbnail(embedData.thumbnail.url);
        }

        if (embedData.footer && (embedData.footer.text || embedData.footer.icon_url)) {
            newEmbed.setFooter({
                text: embedData.footer.text || '',
                iconURL: embedData.footer.icon_url || ''
            });
        }

        if (embedData.fields && embedData.fields.length > 0) {
            newEmbed.addFields(embedData.fields);
        }
        
        const sentMessage = await channel.send({ embeds: [newEmbed] });
        if (reactionEmoji) {
            await sentMessage.react(reactionEmoji);
        }
        
        const newEmbedEntry = {
            guildId,
            embedMessageId: sentMessage.id,
            channelId,
            reactionEmoji,
            roleId,
            embedContent: embedData
        };
        embedsData.push(newEmbedEntry);
        saveMessageData();
        
        res.status(200).json({ message: 'Embed enviado correctamente.', embedMessageId: sentMessage.id });

    } catch (error) {
        console.error('Error al crear/editar el embed:', error);
        res.status(500).json({ error: 'No se pudo crear/editar el embed.' });
    }
});

app.delete('/api/embed/:messageId', async (req, res) => {
    const { messageId } = req.params;
    try {
        const embedEntry = embedsData.find(e => e.embedMessageId === messageId);
        if (!embedEntry) {
            return res.status(404).json({ error: 'Embed no encontrado en los datos locales.' });
        }

        const { guildId, channelId } = embedEntry;

        const guild = await client.guilds.fetch(guildId);
        const channel = guild.channels.cache.get(channelId);
        if (!channel) {
            embedsData = embedsData.filter(e => e.embedMessageId !== messageId);
            saveMessageData();
            return res.status(200).json({ message: 'Embed eliminado de los datos locales (canal no encontrado).' });
        }

        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (message) {
            await message.delete();
        }

        embedsData = embedsData.filter(e => e.embedMessageId !== messageId);
        saveMessageData();

        res.status(200).json({ message: 'Embed eliminado correctamente.' });

    } catch (error) {
        console.error('Error al eliminar el embed:', error);
        res.status(500).json({ error: 'No se pudo eliminar el embed.' });
    }
});

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;

    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Error al hacer fetch a la reacción:', error);
            return;
        }
    }

    const embedEntry = embedsData.find(e => e.embedMessageId === reaction.message.id && e.reactionEmoji === reaction.emoji.name);
    if (embedEntry) {
        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id);
        const role = guild.roles.cache.get(embedEntry.roleId);
        if (role && member) {
            await member.roles.add(role).catch(console.error);
        }
    }
});

client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;

    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Error al hacer fetch a la reacción:', error);
            return;
        }
    }

    const embedEntry = embedsData.find(e => e.embedMessageId === reaction.message.id && e.reactionEmoji === reaction.emoji.name);
    if (embedEntry) {
        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id);
        const role = guild.roles.cache.get(embedEntry.roleId);
        if (role && member) {
            await member.roles.remove(role).catch(console.error);
        }
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);