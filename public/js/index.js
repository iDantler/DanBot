// Variable para almacenar el ID del servidor seleccionado
let selectedGuildId = localStorage.getItem('selectedGuildId');

// Elementos del DOM
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


if (navCreate && navView) {
    navCreate.addEventListener('click', (e) => {
        e.preventDefault();
        createSection.style.display = 'block';
        viewSection.style.display = 'none';
        navCreate.classList.add('active');
        navView.classList.remove('active');
    });

    navView.addEventListener('click', (e) => {
        e.preventDefault();
        createSection.style.display = 'none';
        viewSection.style.display = 'block';
        navCreate.classList.remove('active');
        navView.classList.add('active');
        if (selectedGuildId) {
            loadEmbedsList();
        } else {
            document.getElementById('embeds-container').innerHTML = '<p>Por favor, selecciona un servidor.</p>';
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

window.addField = function(name = '', value = '') {
    if (!additionalFieldsContainer) return;
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

async function loadEmbedsList() {
    const embedsContainer = document.getElementById('embeds-container');
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
        
        const embedsForCurrentGuild = embeds.filter(e => e.guildId === selectedGuildId);
        
        if (embedsForCurrentGuild.length === 0) {
            embedsContainer.innerHTML = '<p>No hay embeds activos en este servidor.</p>';
        } else {
            embedsContainer.innerHTML = '';
            embedsForCurrentGuild.forEach(embed => {
                const embedItem = document.createElement('div');
                embedItem.className = 'embed-item';
                embedItem.innerHTML = `
                    <div class="embed-info">
                        <div class="embed-title">${embed.embedContent.title}</div>
                        <small>Canal: <span class="channel-name">...</span> | Emoji: ${embed.reactionEmoji}</small>
                    </div>
                    <div class="embed-actions">
                        <button class="edit-button" onclick="window.location.href='/edit?id=${embed.embedMessageId}'"><i class="fas fa-edit"></i> Editar</button>
                        <button class="delete-button" onclick="deleteEmbed('${embed.embedMessageId}')"><i class="fas fa-trash"></i> Eliminar</button>
                    </div>
                `;
                embedsContainer.appendChild(embedItem);

                fetch(`/api/channels?guildId=${embed.guildId}`)
                    .then(res => res.json())
                    .then(channels => {
                        const channel = channels.find(c => c.id === embed.channelId);
                        if (channel) {
                            embedItem.querySelector('.channel-name').textContent = `#${channel.name}`;
                        }
                    })
                    .catch(err => console.error(err));
            });
        }
    } catch (error) {
        console.error('Error al cargar la lista de embeds:', error);
        embedsContainer.innerHTML = `<p class="error"><i class="fas fa-exclamation-triangle"></i> Error al cargar la lista de embeds.</p>`;
    }
}

async function deleteEmbed(embedId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este embed? También se eliminará del canal de Discord.')) {
        return;
    }

    try {
        const response = await fetch(`/api/delete-embed/${embedId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        const statusMessage = document.getElementById('status-message');
        if (result.success) {
            statusMessage.innerHTML = `<i class="fas fa-check-circle"></i> ${result.message}`;
            statusMessage.className = 'status-message confirmation';
            loadEmbedsList();
        } else {
            statusMessage.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${result.message}`;
            statusMessage.className = 'status-message error';
        }
    } catch (error) {
        console.error('Error al eliminar el embed:', error);
        const statusMessage = document.getElementById('status-message');
        statusMessage.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Ocurrió un error al eliminar el embed.`;
        statusMessage.className = 'status-message error';
    }
}

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

    const color = form.color.value || '#5865f2';
    const autor = form.autor.value;
    const titulo = form.titulo.value;
    const descripcion = form.descripcion.value;
    const imagen = form.imagen.value;
    const pie = form.pie.value;
    const pieIcono = form.pieIcono.value;

    let fieldsHtml = '';
    const fieldNames = form.querySelectorAll('input[name="fieldNames[]"]');
    const fieldValues = form.querySelectorAll('input[name="fieldValues[]"]');
    for (let i = 0; i < fieldNames.length; i++) {
        if (fieldNames[i].value && fieldValues[i].value) {
            fieldsHtml += `
                <div class="embed-preview-field">
                    <div class="embed-preview-field-name">${applyMarkdown(fieldNames[i].value)}</div>
                    <div class="embed-preview-field-value">${applyMarkdown(fieldValues[i].value)}</div>
                </div>
            `;
        }
    }

    previewContainer.style.setProperty('--embed-color', color);
    previewContainer.innerHTML = `
        ${autor ? `<div class="embed-preview-author">${applyMarkdown(autor)}</div>` : ''}
        ${titulo ? `<div class="embed-preview-title">${applyMarkdown(titulo)}</div>` : ''}
        ${descripcion ? `<div class="embed-preview-description">${applyMarkdown(descripcion).replace(/\n/g, '<br>')}</div>` : ''}
        ${fieldsHtml ? `<div class="embed-preview-fields">${fieldsHtml}</div>` : ''}
        ${imagen ? `<img class="embed-preview-image" src="${imagen}" alt="Imagen del embed">` : ''}
        ${pie ? `<div class="embed-preview-footer">
            ${pieIcono ? `<img src="${pieIcono}" alt="Icono del pie">` : ''}
            ${applyMarkdown(pie)}
        </div>` : ''}
    `;
}

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedGuildId) {
            if (statusMessage) {
                statusMessage.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Por favor, selecciona un servidor primero.`;
                statusMessage.className = 'status-message error';
            }
            return;
        }
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.guildId = selectedGuildId;
        
        const fieldNames = formData.getAll('fieldNames[]');
        const fieldValues = formData.getAll('fieldValues[]');
        data.fieldNames = fieldNames;
        data.fieldValues = fieldValues;

        if (statusMessage) {
            statusMessage.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Creando embed...`;
            statusMessage.className = 'status-message info';
        }

        try {
            // RUTA CORREGIDA DE VUELTA A LA ORIGINAL
            const response = await fetch('/crear-embed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (statusMessage) {
                if (result.success) {
                    statusMessage.innerHTML = `<i class="fas fa-check-circle"></i> ${result.message}`;
                    statusMessage.className = 'status-message confirmation';
                    form.reset();
                    if (additionalFieldsContainer) {
                         additionalFieldsContainer.innerHTML = '';
                    }
                    updatePreview();
                } else {
                    statusMessage.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${result.message}`;
                    statusMessage.className = 'status-message error';
                }
            }
        } catch (error) {
            if (statusMessage) {
                statusMessage.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Ocurrió un error de conexión.`;
                statusMessage.className = 'status-message error';
            }
            console.error('Error:', error);
        }
    });

    form.addEventListener('input', updatePreview);
}


window.onload = () => {
    loadData();
    if (form) {
      updatePreview();
    }
    
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
};