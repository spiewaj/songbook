/**
 * Main index page logic: song searching, URL filtering,
 * and Cloud Songbook reader support (#songbook={id}).
 */

function simplifyString(str) {
    if (typeof str !== 'string') {
        return '';
    }
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ł/gi, 'l'); // Added to handle 'ł' and 'Ł'
}

let activeSongbookFilter = null; // { id, title, songIds: Set<string> }

function getSongIdFromLi(li) {
    if (li.dataset && li.dataset.songId) {
        return li.dataset.songId;
    }
    const a = li.getElementsByClassName("song-link")[0] || li.getElementsByTagName("a")[0];
    if (a && a.getAttribute("href")) {
        const match = a.getAttribute("href").match(/(?:.*\/)?([^\/]+)\.html$/);
        if (match) return match[1];
    }
    return null;
}

function filterSongs() {
    // 1. Get references to the input and the list
    const input = document.getElementById('songSearch');
    const filter = (input ? input.value : '').toUpperCase();
    const ul = document.getElementById('songs');
    if (!ul) return;
    const li = ul.getElementsByTagName('li');

    let visibleCount = 0;

    // 2. Loop through all list items
    for (let i = 0; i < li.length; i++) {
        const item = li[i];
        const songId = getSongIdFromLi(item);

        // Check songbook filter first
        if (activeSongbookFilter && activeSongbookFilter.songIds) {
            if (!songId || !activeSongbookFilter.songIds.has(songId)) {
                item.style.display = "none";
                continue;
            }
        }

        // If no text query, show matching song
        if (!filter) {
            item.style.display = "";
            visibleCount++;
            continue;
        }

        let txtValue = "";
        // Find the title link inside the list item
        const a = item.getElementsByClassName("title")[0];
        if (a) {
            txtValue += ' ' + (a.textContent || a.innerText);
        }
        for (const span of item.getElementsByTagName("span")) {
            if (span.textContent !== 'edit') {
                txtValue += ' ' + (span.textContent || span.innerText);
            }
        }

        if (txtValue.toUpperCase().indexOf(filter) > -1 ||
            simplifyString(txtValue).toUpperCase().indexOf(filter) > -1) {
            item.style.display = ""; // Show the list item
            visibleCount++;
        } else {
            item.style.display = "none"; // Hide the list item
        }
    }

    // Update banner count if songbook active
    const countEl = document.getElementById('songbook-filter-count');
    if (countEl && activeSongbookFilter) {
        const totalSbSongs = activeSongbookFilter.songIds ? activeSongbookFilter.songIds.size : 0;
        if (filter) {
            countEl.textContent = `(pokazano ${visibleCount} z ${totalSbSongs})`;
        } else {
            countEl.textContent = `(${totalSbSongs} ${totalSbSongs === 1 ? 'piosenka' : (totalSbSongs < 5 ? 'piosenki' : 'piosenek')})`;
        }
    }
}

async function loadSongbookFilter(songbookId) {
    if (!songbookId) return;

    const banner = document.getElementById('songbook-filter-banner');
    const titleEl = document.getElementById('songbook-filter-title');
    const countEl = document.getElementById('songbook-filter-count');
    const editBtn = document.getElementById('songbook-filter-edit-btn');

    if (banner) {
        banner.style.display = 'flex';
        banner.classList.remove('warning');
        if (titleEl) titleEl.textContent = "Wczytywanie śpiewnika...";
        if (countEl) countEl.textContent = "";
    }

    try {
        // Wait briefly if FirebaseSongbook is still initializing
        let attempts = 0;
        while (!window.FirebaseSongbook && attempts < 25) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        if (!window.FirebaseSongbook) {
            throw new Error("Moduł bazy danych nie jest dostępny.");
        }

        const doc = await window.FirebaseSongbook.fetchSongbook(songbookId);
        if (!doc) {
            throw new Error("Nie znaleziono śpiewnika lub jest to śpiewnik prywatny.");
        }

        let songIds = doc.resolvedSongIds;
        if (!Array.isArray(songIds) || songIds.length === 0) {
            // Fallback: if resolvedSongIds is missing or empty, resolve from YAML
            if (doc.yaml && window.resolveSongIdsFromYaml) {
                const resp = await fetch('index.json');
                const data = await resp.json();
                songIds = window.resolveSongIdsFromYaml(doc.yaml, data.songs || []);
            } else {
                songIds = [];
            }
        }

        activeSongbookFilter = {
            id: doc.id,
            title: doc.title || doc.id,
            songIds: new Set(songIds)
        };

        if (titleEl) titleEl.textContent = activeSongbookFilter.title;
        if (countEl) {
            const c = songIds.length;
            countEl.textContent = `(${c} ${c === 1 ? 'piosenka' : (c < 5 ? 'piosenki' : 'piosenek')})`;
        }
        if (editBtn) {
            editBtn.href = `songbook_edit.html#songbook=${encodeURIComponent(doc.id)}`;
            editBtn.style.display = 'inline-flex';
        }

        filterSongs();

    } catch (err) {
        console.warn("Błąd filtrowania śpiewnika:", err);
        if (banner) {
            banner.classList.add('warning');
            if (titleEl) titleEl.textContent = err.message || "Błąd wczytywania śpiewnika";
            if (countEl) countEl.textContent = "";
            if (editBtn) editBtn.style.display = 'none';
        }
    }
}

function clearSongbookFilter() {
    activeSongbookFilter = null;
    const banner = document.getElementById('songbook-filter-banner');
    if (banner) banner.style.display = 'none';

    // Remove hash without page jump
    if (window.location.hash.includes('songbook=')) {
        if (history.replaceState) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
        } else {
            window.location.hash = '';
        }
    }

    filterSongs();
}

function checkSongbookFromUrl() {
    let sbId = null;
    const params = new URLSearchParams(window.location.search);
    sbId = params.get('songbook');

    if (!sbId && window.location.hash) {
        const hashMatch = window.location.hash.match(/(?:#|&)songbook=([^&]+)/);
        if (hashMatch) {
            sbId = decodeURIComponent(hashMatch[1]);
        }
    }

    if (sbId) {
        loadSongbookFilter(sbId);
    } else if (activeSongbookFilter) {
        clearSongbookFilter();
    }
}

// Expose handlers globally
window.filterSongs = filterSongs;
window.loadSongbookFilter = loadSongbookFilter;
window.clearSongbookFilter = clearSongbookFilter;
window.checkSongbookFromUrl = checkSongbookFromUrl;