let selectedGuildId = localStorage.getItem('selectedGuildId');

const createSection = document.getElementById('create-embed-section');
const viewSection = document.getElementById('view-embeds-section');
const navCreate = document.getElementById('nav-create');
const navView = document.getElementById('nav-view');
const serverProfile = document.getElementById('server-profile');
const serverDropdown = document.getElementById('server-dropdown');
const serverIcon = document.getElementById('server-icon');
const serverName = document.getElementById('server-name');
const serverInitialIcon = document.getElementById('server-initial-icon');
const form = document.getElementById('embed-form');
const statusMessage = document.getElementById('status-message');
const previewContainer = document.getElementById('embed-preview');
const additionalFieldsContainer = document.getElementById('additional-fields');
const channelSelect = document.getElementById('channel-select');
const roleSelect = document.getElementById('role-select');
const themeToggleCheckbox = document.getElementById('theme-toggle-checkbox');
const reactionEmojiInput = document.getElementById('reactionEmoji');
const deletedEmbedsSection = document.getElementById('deleted-embeds-section');
const navDeleted = document.getElementById('nav-deleted');
const embedsContainer = document.getElementById('embeds-container');

// Lógica para el cambio de tema
const isDarkMode = localStorage.getItem('darkMode') === 'true';
if (isDarkMode) {
    document.body.classList.add('dark-mode');
    if (themeToggleCheckbox) {
        themeToggleCheckbox.checked = true;
    }
}
if (themeToggleCheckbox) {
    themeToggleCheckbox.addEventListener('change', () => {
        if (themeToggleCheckbox.checked) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('darkMode', 'true');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('darkMode', 'false');
        }
    });
}

if (navCreate && navView) {
    navCreate.addEventListener('click', (e) => {
        e.preventDefault();
        createSection.style.display = 'block';
        viewSection.style.display = 'none';
        deletedEmbedsSection.style.display = 'none';
        navCreate.classList.add('active');
        navView.classList.remove('active');
        if (navDeleted) navDeleted.classList.remove('active');
    });

    navView.addEventListener('click', (e) => {
        e.preventDefault();
        createSection.style.display = 'none';
        viewSection.style.display = 'block';
        deletedEmbedsSection.style.display = 'none';
        navCreate.classList.remove('active');
        navView.classList.add('active');
        if (navDeleted) navDeleted.classList.remove('active');
        if (selectedGuildId) {
            loadEmbedsList();
        } else {
            embedsContainer.innerHTML = '<p>Por favor, selecciona un servidor.</p>';
        }
    });
}

if (navDeleted) {
    navDeleted.addEventListener('click', (e) => {
        e.preventDefault();
        createSection.style.display = 'none';
        viewSection.style.display = 'none';
        deletedEmbedsSection.style.display = 'block';
        navCreate.classList.remove('active');
        navView.classList.remove('active');
        navDeleted.classList.add('active');
        if (selectedGuildId) {
            loadDeletedEmbedsList();
        } else {
            document.getElementById('deleted-embeds-container').innerHTML = '<p>Por favor, selecciona un servidor.</p>';
        }
    });
}

if (serverProfile) {
    serverProfile.addEventListener('click', () => {
        serverDropdown.style.display = serverDropdown.style.display === 'block' ? 'none' : 'block';
    });
}

document.addEventListener('click', (e) => {
    if (serverProfile && !serverProfile.contains(e.target)) {
        serverDropdown.style.display = 'none';
    }
});

// FUNCIÓN DUPLICAR
window.duplicateEmbed = async function(messageId) {
    window.location.href = `/edit?id=${messageId}&duplicate=true`;
};

// NUEVA FUNCIÓN PARA DUPLICAR DESDE LA VISTA PRINCIPAL
window.duplicateEmbedInView = async function(messageId) {
    try {
        const response = await fetch(`/api/get-embed/${messageId}`);
        if (!response.ok) throw new Error('Error al obtener el embed para duplicar.');
        const embedToDuplicate = await response.json();
        
        // Cargar los datos del embed en el formulario
        populateFormFromEmbedData(embedToDuplicate.embedContent);
        
        // Cambiar a la vista de creación y recargar canales/roles
        createSection.style.display = 'block';
        viewSection.style.display = 'none';
        navCreate.classList.add('active');
        navView.classList.remove('active');
        await loadChannelsAndRoles(selectedGuildId);
        channelSelect.value = embedToDuplicate.channelId;
        roleSelect.value = embedToDuplicate.roleId;

        alert('Embed duplicado. Ahora puedes editarlo y publicarlo como uno nuevo.');
        updatePreview();
    } catch (error) {
        console.error('Error al duplicar el embed:', error);
        alert('Error al duplicar el embed.');
    }
};

window.addField = function(name = '', value = '') {
    if (!additionalFieldsContainer) return;
    const noFieldsMessage = document.getElementById('no-fields-message');
    if (noFieldsMessage) noFieldsMessage.style.display = 'none';
    
    const newField = document.createElement('div');
    newField.className = 'field-group';
    newField.innerHTML = `
        <input type="text" name="fieldNames[]" placeholder="Nombre del Campo" value="${name}">
        <input type="text" name="fieldValues[]" placeholder="Valor del Campo" value="${value}">
        <button type="button" onclick="this.parentElement.remove(); updatePreview();" class="remove-field-button"><i class="fas fa-times"></i></button>
    `;
    additionalFieldsContainer.appendChild(newField);
};

function generateColor(name) {
    let hash = 0;
    if (!name) return '#5865f2';
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF)
        .toString(16)
        .toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
}

function updateProfileIcon(name, iconUrl) {
    if (serverName) serverName.textContent = name;
    if (iconUrl) {
        if (serverIcon) serverIcon.src = iconUrl;
        if (serverIcon) serverIcon.style.display = 'block';
        if (serverInitialIcon) serverInitialIcon.style.display = 'none';
    } else {
        if (serverInitialIcon) serverInitialIcon.textContent = name ? name.charAt(0).toUpperCase() : '?';
        if (serverInitialIcon) serverInitialIcon.style.backgroundColor = generateColor(name);
        if (serverIcon) serverIcon.style.display = 'none';
        if (serverInitialIcon) serverInitialIcon.style.display = 'flex';
    }
}

async function loadData() {
    try {
        const guildsResponse = await fetch('/api/guilds');
        const guilds = await guildsResponse.json();

        if (serverDropdown) {
            serverDropdown.innerHTML = '';
            guilds.forEach(g => {
                const li = document.createElement('li');
                li.dataset.guildId = g.id;
                const iconHtml = g.iconURL 
                    ? `<img src="${g.iconURL}" alt="Icono del servidor">`
                    : `<div class="server-initial-icon-dropdown" style="background-color: ${generateColor(g.name)};">${g.name.charAt(0).toUpperCase()}</div>`;
                li.innerHTML = `${iconHtml}<span>${g.name}</span>`;
                li.addEventListener('click', () => {
                    selectGuild(g.id, g.name, g.iconURL);
                    serverDropdown.style.display = 'none';
                });
                serverDropdown.appendChild(li);
            });
        }
        
        if (selectedGuildId) {
            const selectedGuild = guilds.find(g => g.id === selectedGuildId);
            if (selectedGuild) {
                selectGuild(selectedGuild.id, selectedGuild.name, selectedGuild.iconURL);
            } else {
                selectedGuildId = null;
                localStorage.removeItem('selectedGuildId');
                if (serverName) serverName.textContent = 'Selecciona un servidor';
                updateProfileIcon('?', null);
                if (channelSelect) channelSelect.disabled = true;
                if (roleSelect) roleSelect.disabled = true;
                if (document.getElementById('submit-button')) document.getElementById('submit-button').disabled = true;
            }
        } else {
            if (channelSelect) channelSelect.disabled = true;
            if (roleSelect) roleSelect.disabled = true;
            if (document.getElementById('submit-button')) document.getElementById('submit-button').disabled = true;
            if (serverName) serverName.textContent = 'Selecciona un servidor';
            updateProfileIcon('?', null);
        }
    } catch (error) {
        console.error('Error al cargar datos:', error);
        if (serverName) serverName.textContent = 'Error';
        updateProfileIcon('?', null);
    }
}

async function selectGuild(guildId, guildName, guildIcon) {
    selectedGuildId = guildId;
    localStorage.setItem('selectedGuildId', selectedGuildId);
    if (serverName) serverName.textContent = guildName;
    updateProfileIcon(guildName, guildIcon);
    await loadChannelsAndRoles(guildId);
    if (viewSection && viewSection.style.display !== 'none') {
        loadEmbedsList();
    }
    if (deletedEmbedsSection && deletedEmbedsSection.style.display !== 'none') {
        loadDeletedEmbedsList();
    }
}

async function loadChannelsAndRoles(guildId) {
    if (channelSelect && roleSelect) {
        channelSelect.disabled = false;
        roleSelect.disabled = false;
        if (document.getElementById('submit-button')) document.getElementById('submit-button').disabled = false;
    }
    
    if (channelSelect) {
        try {
            const response = await fetch(`/api/channels?guildId=${guildId}`);
            if (!response.ok) throw new Error('Error al cargar los canales');
            const channels = await response.json();
            channelSelect.innerHTML = '<option value="">Selecciona un canal</option>';
            channels.forEach(c => {
                const option = document.createElement('option');
                option.value = c.id;
                option.textContent = `#${c.name}`;
                channelSelect.appendChild(option);
            });
        } catch (error) {
            console.error(error);
            channelSelect.innerHTML = '<option value="">Error al cargar canales</option>';
        }
    }
    
    if (roleSelect) {
        try {
            const response = await fetch(`/api/roles?guildId=${guildId}`);
            if (!response.ok) throw new Error('Error al cargar los roles');
            const roles = await response.json();
            roleSelect.innerHTML = '<option value="">Selecciona un rol</option>';
            roles.forEach(r => {
                const option = document.createElement('option');
                option.value = r.id;
                option.textContent = r.name;
                roleSelect.appendChild(option);
            });
        } catch (error) {
            console.error(error);
            roleSelect.innerHTML = '<option value="">Error al cargar roles</option>';
        }
    }
}

// CORREGIDA: Muestra borradores y embeds publicados con sus botones
async function loadEmbedsList() {
    if (!embedsContainer) return;
    embedsContainer.innerHTML = '<p>Cargando embeds...</p>';
    if (!selectedGuildId) {
        embedsContainer.innerHTML = '<p>Por favor, selecciona un servidor para ver los embeds.</p>';
        return;
    }
    try {
        const response = await fetch('/api/embeds');
        if (!response.ok) throw new Error('Error al cargar la lista de embeds');
        const embeds = await response.json();
        const embedsForCurrentGuild = embeds.filter(e => e.guildId === selectedGuildId && !e.deleted);
        
        if (embedsForCurrentGuild.length === 0) {
            embedsContainer.innerHTML = '<p>No hay embeds activos en este servidor.</p>';
        } else {
            embedsContainer.innerHTML = '';
            embedsForCurrentGuild.forEach(embed => {
                const embedItem = createEmbedElement(embed);
                embedsContainer.appendChild(embedItem);
            });
        }
    } catch (error) {
        console.error('Error al cargar la lista de embeds:', error);
        embedsContainer.innerHTML = `<p class="error"><i class="fas fa-exclamation-triangle"></i> Error al cargar la lista de embeds.</p>`;
    }
}

function createEmbedElement(embed) {
    const embedItem = document.createElement('div');
    embedItem.className = 'embed-item';
    embedItem.dataset.id = embed.embedMessageId;

    const embedStatus = embed.isPublished ? 'Publicado' : 'Borrador';
    const embedStatusClass = embed.isPublished ? 'status-published' : 'status-draft';
    
    const color = embed.embedContent.color ? '#' + embed.embedContent.color.toString(16).padStart(6, '0') : '#5865f2';
    const title = embed.embedContent.title || 'Sin título';

    embedItem.innerHTML = `
        <div class="embed-preview-container" style="border-left-color: ${color};">
            <div class="embed-preview-header">
                <span class="embed-status ${embedStatusClass}">${embedStatus}</span>
            </div>
            <div class="embed-preview-title">${title}</div>
            <div class="embed-preview-description">${applyMarkdown(embed.embedContent.description || '')}</div>
        </div>
        <div class="embed-actions">
            <button class="edit-button" onclick="window.location.href='/edit?id=${embed.embedMessageId}'"><i class="fas fa-edit"></i> Editar</button>
            <button class="delete-button" onclick="deleteEmbed('${embed.embedMessageId}')"><i class="fas fa-trash"></i> Eliminar</button>
            ${!embed.isPublished ? `<button class="publish-button" onclick="publishEmbed('${embed.embedMessageId}')"><i class="fas fa-paper-plane"></i> Publicar</button>` : ''}
        </div>
    `;

    return embedItem;
}

// NUEVA FUNCIÓN: Publicar un borrador de embed
window.publishEmbed = async function(messageId) {
    if (!confirm('¿Estás seguro de que quieres publicar este borrador?')) {
        return;
    }
    try {
        const response = await fetch(`/api/publish-embed/${messageId}`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Error al publicar el borrador.');

        const result = await response.json();
        alert(result.message);
        loadEmbedsList();

    } catch (error) {
        console.error('Error al publicar el borrador:', error);
        alert('Hubo un error al publicar el borrador.');
    }
}

// CORREGIDA: Ahora filtra por el estado 'deleted: true'
async function loadDeletedEmbedsList() {
    const embedsContainer = document.getElementById('deleted-embeds-container');
    const status = document.getElementById('deleted-embeds-status');
    if (!embedsContainer) return;
    status.textContent = 'Cargando embeds eliminados...';
    if (!selectedGuildId) {
        status.textContent = 'Por favor, selecciona un servidor para ver los embeds eliminados.';
        return;
    }
    try {
        const response = await fetch('/api/embeds');
        if (!response.ok) throw new Error('Error al cargar la lista de embeds eliminados');
        const embeds = await response.json();
        const deletedEmbeds = embeds.filter(e => e.guildId === selectedGuildId && e.deleted);
        if (deletedEmbeds.length === 0) {
            status.textContent = 'No hay embeds eliminados en este servidor.';
        } else {
            status.style.display = 'none';
            embedsContainer.innerHTML = '';
            deletedEmbeds.forEach(embed => {
                const embedItem = document.createElement('div');
                embedItem.className = 'embed-item deleted-item';
                embedItem.innerHTML = `
                    <div class="embed-info">
                        <div class="embed-title">${embed.embedContent.title || 'Sin título'}</div>
                        <small>Canal: <span class="channel-name">...</span> | Emoji: ${embed.reactionEmoji || 'N/A'}</small>
                    </div>
                    <div class="embed-actions">
                        <button class="recover-button" onclick="republishEmbed('${embed.embedMessageId}')"><i class="fas fa-trash-restore"></i> Publicar de nuevo</button>
                    </div>
                `;
                embedsContainer.appendChild(embedItem);
            });
        }
    } catch (error) {
        console.error('Error al cargar embeds eliminados:', error);
        status.textContent = 'Error al cargar los embeds eliminados.';
    }
}

// NUEVA FUNCIÓN PARA VOLVER A PUBLICAR EL EMBED
window.republishEmbed = async function(messageId) {
    try {
        const response = await fetch(`/api/restore-embed/${messageId}`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Error al restaurar el embed.');

        const result = await response.json();
        alert(result.message);
        
        // Redirigir a la vista de embeds (que ahora mostrará el borrador)
        navView.click();
    } catch (error) {
        console.error('Error al restaurar el embed:', error);
        alert('Error al restaurar el embed.');
    }
};

window.deleteEmbed = async function(messageId) {
    if (!confirm('¿Estás seguro de que quieres ELIMINAR este embed? Esto lo eliminará permanentemente de Discord y lo moverá a la papelera de reciclaje en el panel.')) {
        return;
    }
    try {
        const response = await fetch(`/api/embed/${messageId}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Error al eliminar el embed.');
        alert('Embed eliminado y movido a la papelera de reciclaje.');
        loadEmbedsList();
    } catch (error) {
        console.error('Error al eliminar el embed:', error);
        alert('Error al eliminar el embed.');
    }
};

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = {};
    for (const [key, value] of formData.entries()) {
        if (key.endsWith('[]')) {
            const fieldName = key.replace('[]', '');
            if (!data[fieldName]) {
                data[fieldName] = [];
            }
            data[fieldName].push(value);
        } else {
            data[key] = value;
        }
    }
    
    const fields = [];
    const fieldNames = data.fieldNames || [];
    const fieldValues = data.fieldValues || [];
    for (let i = 0; i < fieldNames.length; i++) {
        fields.push({
            name: fieldNames[i],
            value: fieldValues[i]
        });
    }
    delete data.fieldNames;
    delete data.fieldValues;

    const postData = {
        guildId: selectedGuildId, 
        channelId: data.channelId,
        roleId: data.roleId,
        reactionEmoji: data.reactionEmoji,
        embedData: { 
            title: data.titulo,
            author: data.autor,
            color: data.color,
            description: data.descripcion,
            image: data.imagen,
            thumbnail: data.thumbnail,
            footer: data.footer,
            footerIcon: data.footerIcon,
            fields: fields
        }
    };
    
    statusMessage.style.display = 'none';
    statusMessage.className = 'status-message';
    try {
        const response = await fetch('/api/embed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postData)
        });
        
        const result = await response.json();

        if (response.ok) {
            statusMessage.textContent = 'Embed publicado exitosamente.';
            statusMessage.classList.add('confirmation');
            form.reset();
            updatePreview();
        } else {
            throw new Error(result.error || 'Error al publicar el embed.');
        }
    } catch (error) {
        console.error('Error al publicar el embed:', error);
        statusMessage.textContent = `Error: ${error.message}`;
        statusMessage.classList.add('error');
    }
});

function applyMarkdown(text) {
    if (!text) return '';
    let formattedText = text;
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    formattedText = formattedText.replace(/\*(.*?)\*/g, '<i>$1</i>');
    formattedText = formattedText.replace(/__(.*?)__/g, '<u>$1</u>');
    formattedText = formattedText.replace(/~~(.*?)~~/g, '<del>$1</del>');
    return formattedText;
}

function updatePreview() {
    if (!form || !previewContainer) return;
    const embedPreview = document.getElementById('embed-preview');
    const color = form.color.value || '#5865f2';
    
    const embedContent = {
        title: form.titulo.value,
        author: form.autor.value,
        description: form.descripcion.value,
        image: form.imagen.value,
        thumbnail: form.thumbnail.value,
        footer: form.footer.value,
        footerIcon: form.footerIcon.value
    };

    embedPreview.style.borderLeftColor = color;
    document.getElementById('preview-title').textContent = embedContent.title;
    document.getElementById('preview-author').textContent = embedContent.author;
    document.getElementById('preview-description').innerHTML = applyMarkdown(embedContent.description);
    
    const imageEl = document.getElementById('preview-image');
    if (embedContent.image) {
        imageEl.src = embedContent.image;
        imageEl.style.display = 'block';
    } else {
        imageEl.style.display = 'none';
    }

    const thumbnailEl = document.getElementById('preview-thumbnail');
    const thumbnailImgEl = thumbnailEl.querySelector('img');
    if (embedContent.thumbnail) {
        thumbnailImgEl.src = embedContent.thumbnail;
        thumbnailEl.style.display = 'block';
    } else {
        thumbnailEl.style.display = 'none';
    }

    const footerEl = document.getElementById('preview-footer');
    const footerTextEl = document.getElementById('preview-footer-text');
    const footerIconEl = document.getElementById('preview-footer-icon');
    if (embedContent.footer) {
        footerTextEl.textContent = embedContent.footer;
        footerEl.style.display = 'flex';
    } else {
        footerEl.style.display = 'none';
    }
    if (embedContent.footerIcon) {
        footerIconEl.src = embedContent.footerIcon;
        footerIconEl.style.display = 'block';
    } else {
        footerIconEl.style.display = 'none';
    }

    const additionalFields = document.getElementById('additional-fields');
    const fields = document.getElementById('preview-fields');
    fields.innerHTML = '';
    const fieldGroups = additionalFields.querySelectorAll('.field-group');
    if (fieldGroups.length > 0) {
        const previewFieldContainer = document.createElement('div');
        previewFieldContainer.className = 'preview-fields-container';
        fieldGroups.forEach(group => {
            const name = group.querySelector('input[name="fieldNames[]"]').value;
            const value = group.querySelector('input[name="fieldValues[]"]').value;
            if (name && value) {
                const fieldEl = document.createElement('div');
                fieldEl.className = 'embed-preview-field';
                fieldEl.innerHTML = `
                    <div class="field-name"><b>${name}</b></div>
                    <div class="field-value">${applyMarkdown(value)}</div>
                `;
                fields.appendChild(fieldEl);
            }
        });
    }
}

if (form) {
    const formElements = form.querySelectorAll('input, select, textarea');
    formElements.forEach(element => {
        element.addEventListener('input', updatePreview);
    });
}

function populateFormFromEmbedData(embedData) {
    if (!form) return;
    document.getElementById('titulo').value = embedData.title || '';
    document.getElementById('autor').value = embedData.author || '';
    document.getElementById('color').value = embedData.color || '#5865f2';
    document.getElementById('descripcion').value = embedData.description || '';
    document.getElementById('imagen').value = embedData.image || '';
    document.getElementById('thumbnail').value = embedData.thumbnail || '';
    document.getElementById('footer').value = embedData.footer || '';
    document.getElementById('footerIcon').value = embedData.footerIcon || '';
    document.getElementById('reactionEmoji').value = embedData.reactionEmoji || '';

    additionalFieldsContainer.innerHTML = '';
    if (embedData.fields && embedData.fields.length > 0) {
        embedData.fields.forEach(field => addField(field.name, field.value));
    }
}

document.addEventListener('DOMContentLoaded', loadData);