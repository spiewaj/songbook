function edit(file) {
    let d = document.createElement('form');
    d.setAttribute("action", "https://ghe.spiewaj.com/users/me/changes:new")
    d.setAttribute("method", "post")
    let i = document.createElement("input")
    i.setAttribute("type", "hidden")
    i.setAttribute("name", "file")
    i.setAttribute("value", file)
    d.appendChild(i);

    document.body.appendChild(d);
    d.submit();
}

// Shared utility function for HTML escaping
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
// Theme management
(function() {
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        // Update toggle icons if they exist
        const toggles = document.querySelectorAll('.theme-toggle .material-symbols-outlined');
        toggles.forEach(icon => {
            icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
        });
    }

    // Initialize theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        setTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme('dark');
    }

    document.addEventListener("DOMContentLoaded", () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const toggles = document.querySelectorAll('.theme-toggle .material-symbols-outlined');
        toggles.forEach(icon => {
            icon.textContent = currentTheme === 'dark' ? 'light_mode' : 'dark_mode';
        });
    });

    // Expose toggle function
    window.toggleTheme = function(event) {
        if (event) event.preventDefault();
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    };
})();

// Active songbook context navigation for [Powrót]
(function() {
    function setupSongbookNavigation() {
        let sbId = null;
        try {
            const params = new URLSearchParams(window.location.search);
            sbId = params.get('songbook');
            if (!sbId && window.location.hash) {
                const match = window.location.hash.match(/(?:#|&)songbook=([^&]+)/);
                if (match) sbId = decodeURIComponent(match[1]);
            }
            if (!sbId && document.referrer && document.referrer.includes('songbook=')) {
                const refMatch = document.referrer.match(/[?#&]songbook=([^&]+)/);
                if (refMatch) sbId = decodeURIComponent(refMatch[1]);
            }
            if (!sbId) {
                sbId = sessionStorage.getItem('activeSongbook');
            }
        } catch (e) {
            console.warn("Could not determine active songbook:", e);
        }

        if (sbId) {
            const returnLinks = document.querySelectorAll('a[href="../index.html"], a[href="index.html"]');
            returnLinks.forEach(link => {
                const baseHref = link.getAttribute('href');
                link.setAttribute('href', `${baseHref}#songbook=${encodeURIComponent(sbId)}`);
                link.textContent = '[Powrót do śpiewnika]';
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupSongbookNavigation);
    } else {
        setupSongbookNavigation();
    }
})();
