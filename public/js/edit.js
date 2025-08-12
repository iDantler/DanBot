document.addEventListener('DOMContentLoaded', async () => {
    // Variable para almacenar el ID del servidor seleccionado
    let selectedGuildId = localStorage.getItem('selectedGuildId');

    // Elementos del DOM
    const navCreate = document.getElementById('nav-create');
    const navView = document.getElementById('nav-view');
    const serverProfile = document.getElementById('server-profile');
    const serverDropdown = document.getElementById('server-dropdown');
    const serverIcon = document.getElementById('server-icon');
    const serverName = document.getElementById('server-name');
    const serverInitialIcon = document.getElementById('server-initial-icon');
    const form = document.getElementById('edit-embed-form');
    const statusMessage = document.getElementById('status-message');
    const previewContainer = document.getElementById('embed-preview');
    const additionalFieldsContainer = document.getElementById('additional-fields');
    const channelSelect = document.getElementById('channel-select');
    const roleSelect = document.getElementById('role-select');
    const themeToggleCheckbox = document.getElementById('theme-toggle-checkbox');
    const reactionEmojiInput = document.getElementById('reactionEmoji'); // Nuevo: campo de emoji de reacción

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
            window.location.href = '/';
        });

        navView.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/embeds';
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
    }

    async function loadChannelsAndRoles(guildId) {
        if (channelSelect && roleSelect) {
            channelSelect.disabled = false;
            roleSelect.disabled = false;
            if (document.getElementById('submit-button')) document.getElementById('submit-button').disabled = false;
        }

        const channelIdToSelect = channelSelect.value;
        const roleIdToSelect = roleSelect.value;

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
                if (channelIdToSelect) {
                    channelSelect.value = channelIdToSelect;
                }
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
                if (roleIdToSelect) {
                    roleSelect.value = roleIdToSelect;
                }
            } catch (error) {
                console.error(error);
                roleSelect.innerHTML = '<option value="">Error al cargar roles</option>';
            }
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
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            data.embedMessageId = new URLSearchParams(window.location.search).get('id');

            const fieldNames = formData.getAll('fieldNames[]');
            const fieldValues = formData.getAll('fieldValues[]');
            data.fieldNames = fieldNames;
            data.fieldValues = fieldValues;

            if (statusMessage) {
                statusMessage.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Editando embed...`;
                statusMessage.className = 'status-message info';
            }

            try {
                const response = await fetch('/api/edit-embed', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (statusMessage) {
                    if (result.success) {
                        statusMessage.innerHTML = `<i class="fas fa-check-circle"></i> ${result.message}`;
                        statusMessage.className = 'status-message confirmation';
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

    const embedId = new URLSearchParams(window.location.search).get('id');
    if (embedId) {
        try {
            const response = await fetch(`/api/get-embed/${embedId}`);
            if (!response.ok) throw new Error('Embed no encontrado.');
            const embedData = await response.json();
            
            // Cargar los datos del embed
            form.color.value = `#${(embedData.embedContent.color).toString(16).padStart(6, '0')}`;
            form.autor.value = embedData.embedContent.author?.name || '';
            form.titulo.value = embedData.embedContent.title || '';
            form.descripcion.value = embedData.embedContent.description || '';
            form.imagen.value = embedData.embedContent.image?.url || '';
            form.pie.value = embedData.embedContent.footer?.text || '';
            form.pieIcono.value = embedData.embedContent.footer?.icon_url || '';
            
            // Ahora rellenamos también el emoji de reacción
            if (reactionEmojiInput) {
                reactionEmojiInput.value = embedData.reactionEmoji || '';
            }

            // Cargar los campos adicionales
            if (additionalFieldsContainer) {
                additionalFieldsContainer.innerHTML = '';
            }
            if (embedData.embedContent.fields) {
                embedData.embedContent.fields.forEach(field => {
                    addField(field.name, field.value);
                });
            }

            await loadData();
            if (channelSelect) channelSelect.value = embedData.channelId;
            if (roleSelect) roleSelect.value = embedData.roleId;

            updatePreview();

        } catch (error) {
            console.error('Error al cargar el embed:', error);
            if (statusMessage) {
                statusMessage.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Error al cargar los datos del embed.`;
                statusMessage.className = 'status-message error';
            }
            if (form) form.style.display = 'none';
        }
    } else {
        if (statusMessage) {
            statusMessage.innerHTML = `<i class="fas fa-exclamation-triangle"></i> No se encontró el ID del embed para editar.`;
            statusMessage.className = 'status-message error';
        }
        if (form) form.style.display = 'none';
    }
});