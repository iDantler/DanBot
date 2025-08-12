document.addEventListener('DOMContentLoaded', () => {
    const themeToggleCheckbox = document.getElementById('theme-toggle-checkbox');
    const isDarkMode = localStorage.getItem('darkMode') === 'true';

    // Aplicar el tema guardado al cargar la página
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        if (themeToggleCheckbox) {
            themeToggleCheckbox.checked = true;
        }
    }

    // Escuchar el evento de cambio en el checkbox
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
});