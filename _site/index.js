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

const STATIC_SONGBOOK_ARTIFACTS = {
    '53wdhiz': {
        title: 'Śpiewnik 53 WDHiZ',
        epub: '53wdhiz.epub',
        pdf_a5: 'songs_tex/53wdhiz_a5.pdf',
        pdf_a4: 'songs_tex/53wdhiz_a4.pdf'
    },
    'spiewnik_lupienicki': {
        title: 'Śpiewnik Łupienicki',
        epub: 'spiewnik_lupienicki.epub',
        pdf_a5: 'songs_tex/spiewnik_lupienicki_a5.pdf',
        pdf_a4: 'songs_tex/spiewnik_lupienicki_a4.pdf'
    },
    'dino': {
        title: 'Śpiewnik Dino',
        epub: 'dino.epub',
        pdf_a5: 'songs_tex/dino_a5.pdf',
        pdf_a4: 'songs_tex/dino_a4.pdf'
    },
    'default_all': {
        title: 'Śpiewnik główny',
        epub: 'default_all.epub',
        pdf_a5: 'songs_tex/default_all_a5.pdf',
        pdf_a4: 'songs_tex/default_all_a4.pdf'
    },
    '21wdw': {
        title: 'Śpiewnik 21 WDW',
        epub: 'default_all.epub',
        pdf_a5: 'songs_tex/default_all_a5.pdf',
        pdf_a4: 'songs_tex/default_all_a4.pdf'
    }
};

function safeEscape(text) {
    if (typeof escapeHtml === 'function') {
        return escapeHtml(text);
    }
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function updateQuickDownloadBanner(songbookId, title, doc, draftData) {
    const titleEl = document.getElementById('quickDownloadTitle');
    const badgesEl = document.getElementById('quickDownloadBadges');
    if (!titleEl || !badgesEl) return;

    if (!songbookId || songbookId === 'default_all') {
        resetQuickDownloadBanner();
        return;
    }

    const staticArt = STATIC_SONGBOOK_ARTIFACTS[songbookId] || {};
    const artifacts = (doc && doc.artifacts) || (draftData && draftData.artifacts) || null;

    const epub = (artifacts && artifacts.epub) || staticArt.epub || null;
    const pdf_a5 = (artifacts && artifacts.pdf_a5) || staticArt.pdf_a5 || null;
    const pdf_a4 = (artifacts && artifacts.pdf_a4) || staticArt.pdf_a4 || null;

    const displayTitle = title || (doc && doc.title) || (draftData && draftData.title) || staticArt.title || songbookId;
    titleEl.textContent = `${displayTitle}:`;

    const badges = [];
    if (epub) {
        badges.push(
            `<a href="${safeEscape(epub)}" class="badge-download badge-epub" title="Pobierz na Kindle i czytniki (EPUB)" target="_blank" rel="noopener">` +
            `<span class="material-symbols-outlined">tablet_android</span> EPUB (Kindle)` +
            `</a>`
        );
    }
    if (pdf_a5) {
        badges.push(
            `<a href="${safeEscape(pdf_a5)}" class="badge-download badge-pdf-a5" title="Pobierz PDF w formacie A5 do druku" target="_blank" rel="noopener">` +
            `<span class="material-symbols-outlined">picture_as_pdf</span> PDF A5` +
            `</a>`
        );
    }
    if (pdf_a4) {
        badges.push(
            `<a href="${safeEscape(pdf_a4)}" class="badge-download badge-pdf-a4" title="Pobierz PDF w formacie A4" target="_blank" rel="noopener">` +
            `<span class="material-symbols-outlined">picture_as_pdf</span> PDF A4` +
            `</a>`
        );
    }

    if (badges.length > 0) {
        badges.push(
            `<a href="songbooks.html" class="quick-download-more" title="Zobacz wszystkie śpiewniki i formaty">` +
            `Więcej wydań →` +
            `</a>`
        );
        badgesEl.innerHTML = badges.join('');
    } else {
        badgesEl.innerHTML = `
            <span style="color: #6c757d; font-size: 0.85rem; font-style: italic;">
                Brak gotowych plików PDF/EPUB dla tego śpiewnika.
            </span>
            <a href="songbooks.html" class="quick-download-more" title="Zobacz wszystkie śpiewniki i formaty">
                Więcej wydań →
            </a>
        `;
    }
}

function resetQuickDownloadBanner() {
    const titleEl = document.getElementById('quickDownloadTitle');
    const badgesEl = document.getElementById('quickDownloadBadges');
    if (titleEl) {
        titleEl.textContent = 'Śpiewnik główny:';
    }
    if (badgesEl) {
        badgesEl.innerHTML = `
            <a href="default_all.epub" class="badge-download badge-epub" title="Pobierz na Kindle i czytniki (EPUB)">
                <span class="material-symbols-outlined">tablet_android</span> EPUB (Kindle)
            </a>
            <a href="songs_tex/default_all_a5.pdf" class="badge-download badge-pdf-a5" title="Pobierz PDF w formacie A5 do druku">
                <span class="material-symbols-outlined">picture_as_pdf</span> PDF A5
            </a>
            <a href="songs_tex/default_all_a4.pdf" class="badge-download badge-pdf-a4" title="Pobierz PDF w formacie A4">
                <span class="material-symbols-outlined">picture_as_pdf</span> PDF A4
            </a>
            <a href="songbooks.html" class="quick-download-more" title="Zobacz wszystkie śpiewniki i formaty">
                Więcej wydań →
            </a>
        `;
    }
}

async function loadSongbookFilter(songbookId) {
    if (!songbookId) return;

    const banner = document.getElementById('songbook-filter-banner');
    const titleEl = document.getElementById('songbook-filter-title');
    const countEl = document.getElementById('songbook-filter-count');
    const editBtn = document.getElementById('songbook-filter-edit-btn');
    const badgeEl = document.getElementById('songbook-filter-badge');
    const noteEl = document.getElementById('songbook-filter-note');
    const imgEl = document.getElementById('songbook-filter-image');
    const defaultIcon = document.getElementById('songbook-filter-default-icon');

    // Optimistically update quick download banner if known
    if (STATIC_SONGBOOK_ARTIFACTS[songbookId]) {
        updateQuickDownloadBanner(songbookId, STATIC_SONGBOOK_ARTIFACTS[songbookId].title, null, null);
    } else {
        const qTitleEl = document.getElementById('quickDownloadTitle');
        if (qTitleEl) qTitleEl.textContent = `${songbookId}:`;
    }

    if (banner) {
        banner.style.display = 'flex';
        banner.classList.remove('warning', 'is-draft', 'is-published');
        if (titleEl) titleEl.textContent = "Wczytywanie śpiewnika...";
        if (countEl) countEl.textContent = "";
        if (badgeEl) badgeEl.style.display = 'none';
        if (noteEl) noteEl.style.display = 'none';
        if (imgEl) imgEl.style.display = 'none';
        if (defaultIcon) defaultIcon.style.display = 'inline-block';
    }

    try {
        // 1. Check if draft preview is available in sessionStorage
        let draftData = null;
        try {
            const rawDraft = sessionStorage.getItem('songbook_draft_' + songbookId) || sessionStorage.getItem('active_songbook_draft');
            if (rawDraft) {
                const parsed = JSON.parse(rawDraft);
                if (parsed && parsed.id === songbookId) {
                    draftData = parsed;
                }
            }
        } catch (e) {
            console.warn("Could not parse draft data:", e);
        }

        const isPreviewRequested = window.location.hash.includes('preview=1') || (draftData && draftData.fromEditor);

        // 2. Fetch from Firebase
        let doc = null;
        let attempts = 0;
        while (!window.FirebaseSongbook && attempts < 25) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        if (window.FirebaseSongbook) {
            try {
                doc = await window.FirebaseSongbook.fetchSongbook(songbookId);
            } catch (e) {
                console.warn("Could not fetch cloud songbook:", e);
            }
        }

        let title = "";
        let songIds = [];
        let isDraft = true;

        if (draftData && (isPreviewRequested || !doc)) {
            // Priority for draft preview
            title = draftData.title || songbookId;
            songIds = draftData.resolvedSongIds || [];
            isDraft = !draftData.isPublished;
        } else if (doc) {
            title = doc.title || doc.id;
            songIds = doc.resolvedSongIds || [];
            isDraft = !doc.isPublished;
            if ((!Array.isArray(songIds) || songIds.length === 0) && doc.yaml && window.resolveSongIdsFromYaml) {
                try {
                    const resp = await fetch('index.json');
                    const data = await resp.json();
                    songIds = window.resolveSongIdsFromYaml(doc.yaml, data.songs || []);
                } catch (e) {
                    songIds = [];
                }
            }
        } else if (draftData) {
            title = draftData.title || songbookId;
            songIds = draftData.resolvedSongIds || [];
            isDraft = !draftData.isPublished;
        } else {
            throw new Error("Nie znaleziono śpiewnika lub jest to śpiewnik prywatny.");
        }

        const coverUrl = (draftData && (draftData.imageUrl || (draftData.image && draftData.image.url))) ||
                         (doc && (doc.imageUrl || (doc.image && doc.image.url))) || '';

        activeSongbookFilter = {
            id: songbookId,
            title: title,
            songIds: new Set(songIds),
            isDraft: isDraft,
            imageUrl: coverUrl
        };

        try {
            sessionStorage.setItem('activeSongbook', songbookId);
        } catch (e) {}

        if (imgEl && defaultIcon) {
            if (coverUrl) {
                imgEl.src = coverUrl;
                imgEl.style.display = 'block';
                defaultIcon.style.display = 'none';
                imgEl.onerror = () => {
                    imgEl.style.display = 'none';
                    defaultIcon.style.display = 'inline-block';
                };
            } else {
                imgEl.style.display = 'none';
                defaultIcon.style.display = 'inline-block';
            }
        }

        if (titleEl) titleEl.textContent = activeSongbookFilter.title;
        if (countEl) {
            const c = songIds.length;
            countEl.textContent = `(${c} ${c === 1 ? 'piosenka' : (c < 5 ? 'piosenki' : 'piosenek')})`;
        }

        if (badgeEl) {
            badgeEl.style.display = 'inline-flex';
            if (isDraft) {
                badgeEl.className = 'songbook-filter-badge sb-badge-draft';
                badgeEl.innerHTML = `<span class="material-symbols-outlined" style="font-size: 14px;">edit_note</span> Szkic roboczy`;
                if (banner) banner.classList.add('is-draft');
            } else {
                badgeEl.className = 'songbook-filter-badge sb-badge-published';
                badgeEl.innerHTML = `<span class="material-symbols-outlined" style="font-size: 14px;">check_circle</span> Opublikowany`;
                if (banner) banner.classList.add('is-published');
            }
        }

        if (noteEl) {
            if (isDraft) {
                noteEl.style.display = 'block';
                noteEl.innerHTML = isPreviewRequested
                    ? `<span class="material-symbols-outlined note-icon">visibility</span> <strong>Podgląd roboczy:</strong> Widzisz piosenki wybrane w edytorze. Śpiewnik nie jest jeszcze publicznie opublikowany w katalogu.`
                    : `<span class="material-symbols-outlined note-icon">info</span> <strong>Szkic roboczy:</strong> Ten śpiewnik jest wersją roboczą i nie został jeszcze opublikowany w katalogu.`;
            } else {
                noteEl.style.display = 'none';
            }
        }

        if (editBtn) {
            const currentUser = window.FirebaseSongbook ? window.FirebaseSongbook.getCurrentUser() : null;
            const isOwner = currentUser && doc && window.FirebaseSongbook && (
                doc.creatorId === currentUser.uid ||
                doc.ownerId === currentUser.uid ||
                (Array.isArray(doc.ownerIds) && doc.ownerIds.includes(currentUser.uid)) ||
                (doc.members && doc.members[currentUser.uid] && ['owner', 'editor'].includes(doc.members[currentUser.uid].role)) ||
                window.FirebaseSongbook.isAdmin(currentUser)
            );
            const isLocalDraft = !!(draftData && draftData.fromEditor);

            if (isOwner || isLocalDraft) {
                editBtn.href = `songbook_edit.html#songbook=${encodeURIComponent(songbookId)}`;
                editBtn.style.display = 'inline-flex';
                editBtn.innerHTML = isDraft
                    ? `<span class="material-symbols-outlined">edit</span> Edytuj / Opublikuj`
                    : `<span class="material-symbols-outlined">edit</span> Edytuj`;
            } else {
                editBtn.style.display = 'none';
            }
        }

        updateQuickDownloadBanner(songbookId, activeSongbookFilter.title, doc, draftData);

        filterSongs();

    } catch (err) {
        console.warn("Błąd filtrowania śpiewnika:", err);
        if (STATIC_SONGBOOK_ARTIFACTS[songbookId]) {
            updateQuickDownloadBanner(songbookId, STATIC_SONGBOOK_ARTIFACTS[songbookId].title, null, null);
        } else {
            resetQuickDownloadBanner();
        }
        if (banner) {
            banner.classList.add('warning');
            if (titleEl) titleEl.textContent = err.message || "Błąd wczytywania śpiewnika";
            if (countEl) countEl.textContent = "";
            if (badgeEl) badgeEl.style.display = 'none';
            if (imgEl) imgEl.style.display = 'none';
            if (defaultIcon) defaultIcon.style.display = 'inline-block';
            if (noteEl) {
                noteEl.style.display = 'block';
                noteEl.innerHTML = `Jeśli to Twój śpiewnik, możesz <a href="songbook_edit.html#songbook=${encodeURIComponent(songbookId)}" style="color: inherit; text-decoration: underline; font-weight: 500;">otworzyć go w edytorze</a>.`;
            }
            if (editBtn) editBtn.style.display = 'none';
        }
    }
}

function clearSongbookFilter() {
    activeSongbookFilter = null;
    try {
        sessionStorage.removeItem('activeSongbook');
    } catch (e) {}
    const banner = document.getElementById('songbook-filter-banner');
    if (banner) banner.style.display = 'none';

    resetQuickDownloadBanner();

    // Remove hash without page jump
    if (window.location.hash) {
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
        } else {
            // Also support direct clean #<songbookId> (e.g. #Osiecka, #dino, #53wdhiz)
            const rawHash = window.location.hash.replace(/^#/, '').trim();
            if (rawHash && rawHash !== 'before-search' && !rawHash.includes('=')) {
                sbId = decodeURIComponent(rawHash);
            }
        }
    }

    if (sbId) {
        loadSongbookFilter(sbId);
    } else {
        try {
            sessionStorage.removeItem('activeSongbook');
        } catch (e) {}
        if (activeSongbookFilter) {
            clearSongbookFilter();
        } else {
            resetQuickDownloadBanner();
        }
    }
}

// Intercept song link clicks to preserve songbook context
document.addEventListener('DOMContentLoaded', function() {
    const songsUl = document.getElementById('songs');
    if (songsUl) {
        const addSongbookParam = function(e) {
            if (!activeSongbookFilter || !activeSongbookFilter.id) return;
            const a = e.target.closest('a.song-link') || e.target.closest('a');
            if (a && a.getAttribute('href') && !a.getAttribute('href').startsWith('#') && !a.classList.contains('pdflink') && !a.classList.contains('editicon')) {
                let href = a.getAttribute('href');
                if (!href.includes('songbook=')) {
                    const sep = href.includes('?') ? '&' : '?';
                    a.setAttribute('href', `${href}${sep}songbook=${encodeURIComponent(activeSongbookFilter.id)}`);
                }
            }
        };
        songsUl.addEventListener('pointerdown', addSongbookParam, true);
        songsUl.addEventListener('click', addSongbookParam, true);
    }
});

// Expose handlers globally
window.filterSongs = filterSongs;
window.loadSongbookFilter = loadSongbookFilter;
window.clearSongbookFilter = clearSongbookFilter;
window.checkSongbookFromUrl = checkSongbookFromUrl;
window.updateQuickDownloadBanner = updateQuickDownloadBanner;
window.resetQuickDownloadBanner = resetQuickDownloadBanner;

// Listen for auth changes to update edit button visibility
(function initSongbookAuthListener() {
    let attempts = 0;
    const interval = setInterval(() => {
        attempts++;
        if (window.FirebaseSongbook) {
            clearInterval(interval);
            window.FirebaseSongbook.onAuthChange(() => {
                if (activeSongbookFilter && activeSongbookFilter.id) {
                    loadSongbookFilter(activeSongbookFilter.id);
                }
            });
        } else if (attempts > 50) {
            clearInterval(interval);
        }
    }, 100);
})();