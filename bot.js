const fs = require('fs');
const express = require('express');
const path = require('path');
require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, ChannelType, SlashCommandBuilder, Events } = require('discord.js');

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

// Define tus comandos slash
const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Responde con Pong!')
].map(command => command.toJSON());

client.once(Events.ClientReady, async () => {
    console.log(`¡El bot ${client.user.tag} está listo!`);
    embedsData = loadMessageData(); // Cargar los datos al inicio del bot
    
    // Registrar comandos slash al iniciar el bot
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    try {
        console.log('Iniciando el registro de comandos de aplicación (/)');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log('Comandos de aplicación registrados correctamente.');
    } catch (error) {
        console.error('Error al registrar/eliminar comandos:', error);
    }
});

// Manejador de eventos para interacciones (incluidos los comandos slash)
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'ping') {
        await interaction.reply('Pong!');
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
        const { embedMessageId, channelId, color, autor, titulo, descripcion, imagen, thumbnail, footer, footerIcon, reactionEmoji, fieldNames, fieldValues, isPublished } = req.body;
        
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
        
        // CORRECCIÓN: Manejar el caso donde el mensaje no existe en Discord
        const message = await channel.messages.fetch(embedMessageId).catch(() => null);

        const updatedEmbedContent = {
            color: parseInt(color.replace('#', '0x'), 16),
            author: autor ? { name: autor } : null,
            title: titulo,
            description: descripcion,
            image: imagen ? { url: imagen } : null,
            thumbnail: thumbnail ? { url: thumbnail } : null,
            footer: (footer || footerIcon) ? { text: footer, icon_url: footerIcon } : null,
            fields: fieldNames.map((name, index) => ({
                name: name,
                value: fieldValues[index],
                inline: false,
            })),
        };
        
        // Actualizar el embed en la base de datos local
        embedsData[embedToEditIndex].embedContent = updatedEmbedContent;
        embedsData[embedToEditIndex].reactionEmoji = reactionEmoji;
        embedsData[embedToEditIndex].channelId = channelId;
        embedsData[embedToEditIndex].roleId = req.body.roleId;

        if (message) {
            const updatedEmbed = new EmbedBuilder()
                .setColor(updatedEmbedContent.color);
            
            if (updatedEmbedContent.title && updatedEmbedContent.title.trim().length > 0) {
                updatedEmbed.setTitle(updatedEmbedContent.title);
            }
            if (updatedEmbedContent.description && updatedEmbedContent.description.trim().length > 0) {
                updatedEmbed.setDescription(updatedEmbedContent.description);
            }
            if (updatedEmbedContent.author && updatedEmbedContent.author.name && updatedEmbedContent.author.name.trim().length > 0) {
                updatedEmbed.setAuthor({ name: updatedEmbedContent.author.name });
            }
            if (updatedEmbedContent.image) {
                updatedEmbed.setImage(updatedEmbedContent.image.url);
            }
            if (updatedEmbedContent.thumbnail) {
                updatedEmbed.setThumbnail(updatedEmbedContent.thumbnail.url);
            }
            if (updatedEmbedContent.footer && (updatedEmbedContent.footer.text || updatedEmbedContent.footer.icon_url)) {
                updatedEmbed.setFooter({
                    text: updatedEmbedContent.footer.text,
                    iconURL: updatedEmbedContent.footer.icon_url,
                });
            }
            if (updatedEmbedContent.fields && updatedEmbedContent.fields.length > 0) {
                updatedEmbed.addFields(updatedEmbedContent.fields);
            }

            await message.edit({ embeds: [updatedEmbed] });
            if (message.reactions) {
                await message.reactions.removeAll().catch(error => console.error('Error al eliminar reacciones:', error));
            }
            if (reactionEmoji) {
                await message.react(reactionEmoji);
            }
            
            embedsData[embedToEditIndex].isPublished = true;
            saveMessageData();
            res.json({ success: true, message: 'Embed editado correctamente en Discord.' });
        } else {
            console.warn(`[SERVER] Mensaje con ID ${embedMessageId} no encontrado en Discord. Guardando como borrador.`);
            embedsData[embedToEditIndex].isPublished = false;
            // Generar un nuevo ID temporal para el borrador para que no se confunda con el antiguo ID de Discord
            embedsData[embedToEditIndex].embedMessageId = 'draft_' + Date.now().toString();
            saveMessageData();
            res.json({ success: true, message: 'El embed original fue eliminado. Se ha guardado como borrador.' });
        }
        
    } catch (error) {
        console.error('Error al editar el embed:', error);
        res.status(500).json({ success: false, message: 'Error al editar el embed.' });
    }
});

// NUEVA RUTA: Publicar un borrador de embed
app.post('/api/publish-embed/:messageId', async (req, res) => {
    try {
        const { messageId } = req.params;
        const embedToPublishIndex = embedsData.findIndex(e => e.embedMessageId === messageId);
        
        if (embedToPublishIndex === -1) {
            return res.status(404).json({ error: 'Borrador de embed no encontrado.' });
        }

        const embedData = embedsData[embedToPublishIndex];
        const guild = await client.guilds.fetch(embedData.guildId);
        const channel = guild.channels.cache.get(embedData.channelId);
        
        if (!channel) {
            return res.status(404).json({ error: 'Canal no encontrado.' });
        }
        
        const newEmbed = new EmbedBuilder();
        const embedContent = embedData.embedContent;
        
        if (embedContent.color) {
            newEmbed.setColor(embedContent.color);
        }
        if (embedContent.title) {
            newEmbed.setTitle(embedContent.title);
        }
        if (embedContent.description) {
            newEmbed.setDescription(embedContent.description);
        }
        if (embedContent.author && embedContent.author.name && embedContent.author.name.trim().length > 0) {
            newEmbed.setAuthor({ name: embedContent.author.name });
        }
        if (embedContent.image && embedContent.image.url && embedContent.image.url.trim().length > 0) {
            newEmbed.setImage(embedContent.image.url);
        }
        if (embedContent.thumbnail && embedContent.thumbnail.url && embedContent.thumbnail.url.trim().length > 0) {
            newEmbed.setThumbnail(embedContent.thumbnail.url);
        }

        if (embedContent.footer && (embedContent.footer.text || embedContent.footer.icon_url)) {
            newEmbed.setFooter({
                text: embedContent.footer.text || '',
                iconURL: embedContent.footer.icon_url || ''
            });
        }
        
        if (embedContent.fields && embedContent.fields.length > 0) {
            const validFields = embedContent.fields.filter(field => field.name.trim().length > 0 && field.value.trim().length > 0);
            if (validFields.length > 0) {
                newEmbed.addFields(validFields);
            }
        }
        
        const sentMessage = await channel.send({ embeds: [newEmbed] });
        if (embedData.reactionEmoji) {
            await sentMessage.react(embedData.reactionEmoji);
        }
        
        // Actualizar el borrador a un embed publicado
        embedsData[embedToPublishIndex].embedMessageId = sentMessage.id;
        embedsData[embedToPublishIndex].isPublished = true;
        
        saveMessageData();
        
        res.status(200).json({ message: 'Borrador publicado correctamente.', embedMessageId: sentMessage.id });

    } catch (error) {
        console.error('Error al publicar el borrador:', error);
        res.status(500).json({ error: 'No se pudo publicar el borrador.' });
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
        
        const newEmbed = new EmbedBuilder();
        
        if (embedData.color) {
            newEmbed.setColor(parseInt(embedData.color.replace('#', '0x'), 16));
        }
        if (embedData.title) {
            newEmbed.setTitle(embedData.title);
        }
        if (embedData.description) {
            newEmbed.setDescription(embedData.description);
        }
        if (embedData.author && embedData.author.trim().length > 0) {
            newEmbed.setAuthor({ name: embedData.author });
        }
        if (embedData.image && embedData.image.trim().length > 0) {
            newEmbed.setImage(embedData.image);
        }
        if (embedData.thumbnail && embedData.thumbnail.trim().length > 0) {
            newEmbed.setThumbnail(embedData.thumbnail);
        }

        if (embedData.footer && embedData.footer.text || embedData.footerIcon && embedData.footerIcon.trim().length > 0) {
            newEmbed.setFooter({
                text: embedData.footer || '',
                iconURL: embedData.footerIcon || ''
            });
        }
        
        if (embedData.fields && embedData.fields.length > 0) {
            const validFields = embedData.fields.filter(field => field.name.trim().length > 0 && field.value.trim().length > 0);
            if (validFields.length > 0) {
                newEmbed.addFields(validFields);
            }
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
            embedContent: embedData,
            deleted: false,
            isPublished: true // Nuevo campo
        };

        if (embedMessageId) {
            // Actualizar un embed existente que no ha sido publicado
            const embedIndex = embedsData.findIndex(e => e.embedMessageId === embedMessageId);
            if (embedIndex !== -1) {
                embedsData[embedIndex].embedMessageId = sentMessage.id;
                embedsData[embedIndex].isPublished = true;
            }
        } else {
            embedsData.push(newEmbedEntry);
        }

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
        if (channel) {
            const message = await channel.messages.fetch(messageId).catch(() => null);
            if (message) {
                await message.delete();
            }
        }
        
        embedEntry.deleted = true;
        embedEntry.isPublished = false; // El embed ya no está publicado en Discord
        saveMessageData();

        res.status(200).json({ message: 'Embed eliminado correctamente.' });

    } catch (error) {
        console.error('Error al eliminar el embed:', error);
        res.status(500).json({ error: 'No se pudo eliminar el embed.' });
    }
});

// NUEVA RUTA: Restaura un embed de la papelera
app.post('/api/restore-embed/:messageId', async (req, res) => {
    const { messageId } = req.params;
    try {
        const embedEntry = embedsData.find(e => e.embedMessageId === messageId);
        if (!embedEntry || !embedEntry.deleted) {
            return res.status(404).json({ error: 'Embed no encontrado en la papelera.' });
        }
        
        embedEntry.deleted = false;
        embedEntry.isPublished = false;
        // Asigna un ID temporal para que sea único en la lista, el ID original de Discord se borró al eliminar
        embedEntry.embedMessageId = 'draft_' + Date.now().toString(); 
        saveMessageData();
        
        res.status(200).json({ message: 'Embed restaurado correctamente.' });

    } catch (error) {
        console.error('Error al restaurar el embed:', error);
        res.status(500).json({ error: 'No se pudo restaurar el embed.' });
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

    const embedEntry = embedsData.find(e => e.embedMessageId === reaction.message.id && e.reactionEmoji === reaction.emoji.name && !e.deleted);
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

    const embedEntry = embedsData.find(e => e.embedMessageId === reaction.message.id && e.reactionEmoji === reaction.emoji.name && !e.deleted);
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