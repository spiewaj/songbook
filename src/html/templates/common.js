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
    if (text === null || text === undefined) return '';
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
            const returnLinks = document.querySelectorAll('a[href^="../index.html"], a[href^="index.html"], a[href="/"], a[href^="/#"]');
            returnLinks.forEach(link => {
                const rawHref = link.getAttribute('href');
                if (rawHref === '../index.html' || rawHref === 'index.html' || rawHref === '/' || rawHref.includes('#songbook=') || rawHref.startsWith('/#')) {
                    if (link.classList.contains('nav-return') || link.textContent.includes('Powrót')) {
                        const targetHref = (rawHref === '/' || rawHref.startsWith('/#'))
                            ? `/#${encodeURIComponent(sbId)}`
                            : `${rawHref.split('#')[0].split('?')[0]}#${encodeURIComponent(sbId)}`;
                        link.setAttribute('href', targetHref);
                        link.innerHTML = '<span class="material-symbols-outlined">arrow_back</span> Powrót do śpiewnika';
                    }
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupSongbookNavigation);
    } else {
        setupSongbookNavigation();
    }
})();

// Touch gestures for mobile song navigation (e.g. swipe left/right to return to song list)
(function() {
    function isSongPage() {
        return Boolean(
            (document.body && document.body.classList.contains('song')) ||
            document.querySelector('.song') ||
            document.querySelector('a.nav-return') ||
            window.location.pathname.includes('/songs_html/')
        );
    }

    function getReturnUrl() {
        const returnLink = document.querySelector('a.nav-return');
        if (returnLink) {
            const href = returnLink.getAttribute('href');
            if (href) return href;
        }
        const generalReturn = document.querySelector('.top-navigation a[href="/"], .top-navigation a[href^="/#"], .top-navigation a[href^="../index.html"]');
        if (generalReturn) {
            const href = generalReturn.getAttribute('href');
            if (href) return href;
        }
        return '/';
    }

    function showSwipeFeedback() {
        if (navigator.vibrate) {
            try { navigator.vibrate(15); } catch (e) {}
        }
        let indicator = document.querySelector('.swipe-navigation-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'swipe-navigation-indicator';
            document.body.appendChild(indicator);
        }
        const returnLink = document.querySelector('a.nav-return');
        const isSongbook = returnLink && returnLink.textContent.includes('śpiewnika');
        const text = isSongbook ? 'Powrót do śpiewnika…' : 'Powrót do listy…';
        indicator.innerHTML = `<span class="material-symbols-outlined">arrow_back</span><span>${escapeHtml(text)}</span>`;
        // Force reflow
        void indicator.offsetWidth;
        indicator.classList.add('visible');
    }

    function navigateBack() {
        showSwipeFeedback();

        // Check if referrer is from the same site (and not another song)
        let canUseHistory = false;
        try {
            if (document.referrer && window.history.length > 1) {
                const refUrl = new URL(document.referrer);
                if (refUrl.origin === window.location.origin && !refUrl.pathname.includes('/songs_html/')) {
                    canUseHistory = true;
                }
            }
        } catch (e) {
            canUseHistory = false;
        }

        const targetUrl = getReturnUrl();
        if (canUseHistory) {
            window.history.back();
            // Fallback in case history.back() didn't unload within 300ms
            setTimeout(() => {
                window.location.href = targetUrl;
            }, 300);
        } else {
            setTimeout(() => {
                window.location.href = targetUrl;
            }, 100);
        }
    }

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let isTracking = false;

    function onTouchStart(e) {
        if (e.touches.length !== 1) {
            isTracking = false;
            return;
        }
        // Don't trigger if interacting with interactive controls or form elements
        if (e.target && e.target.closest('input, textarea, select, button')) {
            isTracking = false;
            return;
        }
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
        isTracking = true;
    }

    function onTouchMove(e) {
        if (!isTracking || e.touches.length !== 1) {
            isTracking = false;
            return;
        }
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const deltaX = currentX - touchStartX;
        const deltaY = currentY - touchStartY;

        // If vertical scrolling dominates, cancel gesture tracking so native vertical scrolling continues smoothly
        if (Math.abs(deltaY) > 60 && Math.abs(deltaY) > Math.abs(deltaX)) {
            isTracking = false;
        }
    }

    function onTouchEnd(e) {
        if (!isTracking) return;
        isTracking = false;

        // Check if user currently has active text selection
        if (window.getSelection && !window.getSelection().isCollapsed) {
            return;
        }

        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        const duration = Date.now() - touchStartTime;

        // Gesture criteria:
        // Duration: between 50ms and 600ms
        // Vertical deviation: at most 70px
        // Horizontal distance: at least 65px
        // Clearly horizontal angle: abs(deltaX) >= abs(deltaY) * 1.5
        const isHorizontal = Math.abs(deltaX) >= 65 && Math.abs(deltaY) <= 70 && Math.abs(deltaX) >= Math.abs(deltaY) * 1.5;
        const isQuickEnough = duration >= 50 && duration <= 600;

        if (isHorizontal && isQuickEnough) {
            // Swipe left (thumb moves from right to left, deltaX < 0)
            const isSwipeLeft = deltaX <= -65;
            // Swipe right (deltaX > 0, start not at very edge to avoid conflicting with browser edge swipe)
            const isSwipeRight = deltaX >= 65 && touchStartX >= 30;

            if (isSwipeLeft || isSwipeRight) {
                navigateBack();
            }
        }
    }

    function setupGestures() {
        if (!isSongPage()) return;

        // Add passive touch listeners so vertical scrolling is 100% fluid
        document.addEventListener('touchstart', onTouchStart, { passive: true });
        document.addEventListener('touchmove', onTouchMove, { passive: true });
        document.addEventListener('touchend', onTouchEnd, { passive: true });

        // Clean up indicator on bfcache restore
        window.addEventListener('pageshow', () => {
            const indicator = document.querySelector('.swipe-navigation-indicator');
            if (indicator) indicator.remove();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupGestures);
    } else {
        setupGestures();
    }
})();
