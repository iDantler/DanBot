let selectedGuildId = localStorage.getItem('selectedGuildId');

const serverProfile = document.getElementById('server-profile');
const serverDropdown = document.getElementById('server-dropdown');
const serverIcon = document.getElementById('server-icon');
const serverName = document.getElementById('server-name');
const serverInitialIcon = document.getElementById('server-initial-icon');
const form = document.getElementById('edit-embed-form');
const statusMessage = document.getElementById('status-message');
const additionalFieldsContainer = document.getElementById('additional-fields');
const channelSelect = document.getElementById('channel-select');
const roleSelect = document.getElementById('role-select');
const navCreate = document.getElementById('nav-create');
const navView = document.getElementById('nav-view');
const themeToggleCheckbox = document.getElementById('theme-toggle-checkbox');
const embedMessageIdInput = document.getElementById('embed-message-id');
const submitButton = document.getElementById('submit-button');

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
                if (submitButton) submitButton.disabled = true;
            }
        } else {
            if (channelSelect) channelSelect.disabled = true;
            if (roleSelect) roleSelect.disabled = true;
            if (submitButton) submitButton.disabled = true;
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
}

async function loadChannelsAndRoles(guildId) {
    if (channelSelect && roleSelect) {
        channelSelect.disabled = false;
        roleSelect.disabled = false;
        if (submitButton) submitButton.disabled = false;
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
            roleSelect.innerHTML = '<option value="">No asignar</option>';
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
    if (!form) return;

    const embedPreview = document.getElementById('embed-preview');
    const color = form.color.value || '#5865f2';
    
    embedPreview.style.borderLeftColor = color;
    
    const previewAuthor = document.getElementById('preview-author');
    previewAuthor.textContent = form.autor.value;
    previewAuthor.style.display = form.autor.value ? 'block' : 'none';

    const previewTitle = document.getElementById('preview-title');
    previewTitle.textContent = form.titulo.value;
    previewTitle.style.display = form.titulo.value ? 'block' : 'none';

    const previewDescription = document.getElementById('preview-description');
    previewDescription.innerHTML = applyMarkdown(form.descripcion.value);
    previewDescription.style.display = form.descripcion.value ? 'block' : 'none';
    
    const imageEl = document.getElementById('preview-image');
    if (form.imagen.value) {
        imageEl.src = form.imagen.value;
        imageEl.style.display = 'block';
    } else {
        imageEl.style.display = 'none';
    }

    const thumbnailEl = document.getElementById('preview-thumbnail');
    const thumbnailImgEl = thumbnailEl.querySelector('img');
    if (form.thumbnail.value) {
        thumbnailImgEl.src = form.thumbnail.value;
        thumbnailEl.style.display = 'block';
    } else {
        thumbnailEl.style.display = 'none';
    }

    const footerEl = document.getElementById('preview-footer');
    const footerTextEl = document.getElementById('preview-footer-text');
    const footerIconEl = document.getElementById('preview-footer-icon');
    if (form.footer.value) {
        footerTextEl.textContent = form.footer.value;
        footerEl.style.display = 'flex';
    } else {
        footerEl.style.display = 'none';
    }
    if (form.footerIcon.value) {
        footerIconEl.src = form.footerIcon.value;
        footerIconEl.style.display = 'block';
    } else {
        footerIconEl.style.display = 'none';
    }

    // Actualizar campos adicionales
    const fields = document.getElementById('preview-fields');
    fields.innerHTML = '';
    const fieldGroups = additionalFieldsContainer.querySelectorAll('.field-group');
    if (fieldGroups.length > 0) {
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

window.duplicateEmbedInEdit = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const messageId = urlParams.get('id');
    const embedIdInput = document.getElementById('embed-message-id');
    const submitBtn = document.getElementById('submit-button');

    if (messageId) {
        // Redirige a la misma página con el parámetro 'duplicate=true'
        window.location.href = `/edit?id=${messageId}&duplicate=true`;
    }
};

// Cargar los datos del embed a editar
async function loadEmbedToEdit() {
    const urlParams = new URLSearchParams(window.location.search);
    const messageId = urlParams.get('id');
    const isDuplicating = urlParams.get('duplicate') === 'true';

    if (!messageId) {
        document.querySelector('#edit-embed-section h3').textContent = 'Error: ID de embed no encontrado.';
        form.style.display = 'none';
        return;
    }

    try {
        const response = await fetch(`/api/get-embed/${messageId}`);
        if (!response.ok) throw new Error('Embed no encontrado.');
        const embedData = await response.json();
        
        // Cargar los datos en el formulario
        document.getElementById('titulo').value = embedData.embedContent.title || '';
        document.getElementById('autor').value = embedData.embedContent.author?.name || '';
        const hexColor = '#' + (embedData.embedContent.color ? embedData.embedContent.color.toString(16).padStart(6, '0') : '5865f2');
        document.getElementById('color').value = hexColor;
        document.getElementById('descripcion').value = embedData.embedContent.description || '';
        document.getElementById('imagen').value = embedData.embedContent.image?.url || '';
        document.getElementById('thumbnail').value = embedData.embedContent.thumbnail?.url || '';
        document.getElementById('footer').value = embedData.embedContent.footer?.text || '';
        document.getElementById('footerIcon').value = embedData.embedContent.footer?.icon_url || '';
        document.getElementById('reactionEmoji').value = embedData.reactionEmoji || '';

        // Limpiar y añadir campos adicionales
        additionalFieldsContainer.innerHTML = '';
        if (embedData.embedContent.fields && embedData.embedContent.fields.length > 0) {
            const noFieldsMessage = document.getElementById('no-fields-message');
            if(noFieldsMessage) noFieldsMessage.style.display = 'none';
            embedData.embedContent.fields.forEach(field => addField(field.name, field.value));
        } else {
            const p = document.createElement('p');
            p.id = 'no-fields-message';
            p.className = 'text-muted';
            p.textContent = 'No hay campos adicionales.';
            additionalFieldsContainer.appendChild(p);
        }

        // Cargar canales y roles del servidor
        await loadChannelsAndRoles(embedData.guildId);
        channelSelect.value = embedData.channelId;
        roleSelect.value = embedData.roleId;

        if (isDuplicating) {
            document.querySelector('#edit-embed-section h3').textContent = 'Duplicar Embed';
            submitButton.textContent = 'Crear Embed';
            embedMessageIdInput.value = ''; 
        } else if (embedData.isPublished) {
            document.querySelector('#edit-embed-section h3').textContent = 'Editar Embed Activo';
            submitButton.textContent = 'Guardar Cambios en Discord';
            embedMessageIdInput.value = messageId;
        } else {
            document.querySelector('#edit-embed-section h3').textContent = 'Editar Borrador de Embed';
            submitButton.textContent = 'Publicar Borrador';
            embedMessageIdInput.value = messageId;
        }

        updatePreview();
    } catch (error) {
        console.error('Error al cargar el embed:', error);
        document.querySelector('#edit-embed-section h3').textContent = 'Error: Embed no encontrado.';
        form.style.display = 'none';
    }
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const embedId = embedMessageIdInput.value;
    const isNewEmbed = !embedId;

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
    
    const postData = {
        embedMessageId: data.embedMessageId,
        channelId: data.channelId,
        roleId: data.roleId,
        color: data.color,
        autor: data.autor,
        titulo: data.titulo,
        descripcion: data.descripcion,
        imagen: data.imagen,
        thumbnail: data.thumbnail,
        footer: data.footer,
        footerIcon: data.footerIcon,
        reactionEmoji: data.reactionEmoji,
        fieldNames: data.fieldNames || [],
        fieldValues: data.fieldValues || []
    };
    
    statusMessage.style.display = 'none';
    statusMessage.className = 'status-message';
    try {
        let endpoint = '';
        let isPublished = true;
        let method = 'POST';

        if (isNewEmbed) {
            endpoint = '/api/embed';
        } else {
            const embedResponse = await fetch(`/api/get-embed/${embedId}`);
            if (embedResponse.ok) {
                const embedData = await embedResponse.json();
                isPublished = embedData.isPublished;
            } else {
                isPublished = false;
            }

            if (isPublished) {
                endpoint = '/api/edit-embed';
            } else {
                endpoint = '/api/publish-embed/' + embedId;
                const res = await fetch(endpoint, {
                    method: 'POST',
                });
                const result = await res.json();
                if (res.ok) {
                    statusMessage.textContent = result.message;
                    statusMessage.classList.add('confirmation');
                    setTimeout(() => {
                        window.location.href = `/embeds?guildId=${selectedGuildId}`;
                    }, 1000);
                } else {
                    throw new Error(result.message || 'Error al publicar el embed.');
                }
                return;
            }
        }
        
        const res = await fetch(endpoint, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postData)
        });

        const result = await res.json();
        if (res.ok) {
            statusMessage.textContent = result.message;
            statusMessage.classList.add('confirmation');
            setTimeout(() => {
                window.location.href = `/embeds?guildId=${selectedGuildId}`;
            }, 1000);
        } else {
            throw new Error(result.message || 'Error al guardar el embed.');
        }

    } catch (error) {
        console.error('Error al guardar el embed:', error);
        statusMessage.textContent = `Error: ${error.message}`;
        statusMessage.classList.add('error');
    }
    statusMessage.style.display = 'block';
});

document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    await loadEmbedToEdit();
});