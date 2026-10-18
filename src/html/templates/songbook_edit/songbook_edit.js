let allSongs = [];
let selectedSongIds = new Set();
let songById = new Map();
let dynamicFilters = [];
let filterCounter = 0;
let activeAggregatedFilters = new Map(); // Track which aggregated filters are active

// Cloud State (Phase 3)
let currentUser = null;
let currentCloudSongbook = null;
let songsLoadedPromise = null;

// Load index.json on page load
async function loadSongs() {
    try {
        const response = await fetch('index.json');
        const data = await response.json();
        allSongs = data.songs;
        
        // Create song lookup map
        allSongs.forEach(song => {
            songById.set(song.id, song);
        });
        
        populateFilters();
        renderSongList();
        updateStats();
    } catch (error) {
        console.error('Failed to load index.json:', error);
        document.getElementById('songList').innerHTML = 
            '<div class="empty-state">Nie można załadować piosenek automatycznie.<br>Użyj przycisku powyżej, aby załadować plik index.json ręcznie.</div>';
        document.getElementById('fileUploadSection').style.display = 'block';
    }
}

function loadJSONFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            allSongs = data.songs;
            
            // Create song lookup map
            allSongs.forEach(song => {
                songById.set(song.id, song);
            });
            
            document.getElementById('fileUploadSection').style.display = 'none';
            populateFilters();
            renderSongList();
            updateStats();
        } catch (error) {
            alert('Błąd podczas parsowania pliku JSON: ' + error.message);
        }
    };
    reader.readAsText(file);
}

function populateFilters() {
    // No longer needed - we'll show aggregated results in the search list
}

function getFilteredItems() {
    const searchTerm = document.getElementById('searchBox').value.toLowerCase().trim();
    
    if (!searchTerm) {
        // Return all songs when no search term
        return allSongs.map(song => ({
            type: 'song',
            data: song
        }));
    }
    
    // Collect matching items
    const results = [];
    const matchedArtists = new Set();
    const matchedTextAuthors = new Set();
    const matchedGenres = new Set();
    
    // Find matching songs and collect their metadata
    allSongs.forEach(song => {
        const searchableText = [
            song.title,
            song.artist || '',
            song.text_author || '',
            song.genre || '',
            ...(song.aliases || [])
        ].join(' ').toLowerCase();
        
        if (searchableText.includes(searchTerm)) {
            results.push({
                type: 'song',
                data: song
            });
            
            // Collect metadata for aggregation
            if (song.artist && song.artist.toLowerCase().includes(searchTerm)) {
                matchedArtists.add(song.artist);
            }
            if (song.text_author && song.text_author.toLowerCase().includes(searchTerm)) {
                matchedTextAuthors.add(song.text_author);
            }
            if (song.genre && song.genre.toLowerCase().includes(searchTerm)) {
                matchedGenres.add(song.genre);
            }
        }
    });
    
    // Add aggregated items at the top
    const aggregatedItems = [];
    
    Array.from(matchedArtists).sort().forEach(artist => {
        aggregatedItems.push({
            type: 'artist',
            data: { name: artist }
        });
    });
    
    Array.from(matchedTextAuthors).sort().forEach(author => {
        aggregatedItems.push({
            type: 'text_author',
            data: { name: author }
        });
    });
    
    Array.from(matchedGenres).sort().forEach(genre => {
        aggregatedItems.push({
            type: 'genre',
            data: { name: genre }
        });
    });
    
    return [...aggregatedItems, ...results];
}

function renderSongList() {
    const songList = document.getElementById('songList');
    const items = getFilteredItems();
    
    if (items.length === 0) {
        songList.innerHTML = '<div class="empty-state">Nie znaleziono wyników</div>';
        return;
    }
    
    songList.innerHTML = items.map(item => {
        if (item.type === 'song') {
            const song = item.data;
            const isSelected = selectedSongIds.has(song.id);
            const meta = [];
            if (song.artist) meta.push(song.artist);
            if (song.genre) meta.push(song.genre);
            
            const aliasText = song.aliases && song.aliases.length > 0 
                ? ` (${escapeHtml(song.aliases.join(', '))})`
                : '';
            
            return `
                <div class="song-item ${isSelected ? 'selected' : ''}" 
                     onclick="toggleSong('${song.id}')">
                    <input type="checkbox" 
                           ${isSelected ? 'checked' : ''}
                           onclick="event.stopPropagation(); toggleSong('${song.id}')">
                    <div class="song-info">
                        <div class="song-title">
                            <a href="${escapeHtml(song.html_url)}" target="_blank" onclick="event.stopPropagation()">${escapeHtml(song.title)}</a>${aliasText}
                        </div>
                        ${meta.length > 0 ? `<div class="song-meta">${escapeHtml(meta.join(' • '))}</div>` : ''}
                    </div>
                </div>
            `;
        } else if (item.type === 'artist') {
            return renderAggregatedItem('artist', item.data.name);
        } else if (item.type === 'text_author') {
            return renderAggregatedItem('text_author', item.data.name);
        } else if (item.type === 'genre') {
            return renderAggregatedItem('genre', item.data.name);
        }
    }).join('');
    
    updateStats();
}

// Helper function to render aggregated filter items
function renderAggregatedItem(type, name) {
    const filterKey = `${type}:${name}`;
    const isChecked = activeAggregatedFilters.has(filterKey);
    
    const config = {
        artist: { icon: 'person', label: 'Wykonawca' },
        text_author: { icon: 'edit_note', label: 'Autor tekstu' },
        genre: { icon: 'category', label: 'Gatunek' }
    };
    
    const { icon, label } = config[type];
    
    return `
        <div class="aggregated-item ${type}-item">
            <input type="checkbox" 
                   ${isChecked ? 'checked' : ''}
                   data-filter-type="${type}"
                   data-filter-value="${escapeHtml(name)}"
                   onchange="toggleAggregatedFilterByData(this)"
                   onclick="event.stopPropagation()">
            <span class="material-symbols-outlined">${icon}</span>
            <div class="item-info">
                <div class="item-title">${label}: ${escapeHtml(name)}</div>
                <div class="item-meta">Zaznacz aby dodać filtr "Wszystkie pasujące"</div>
            </div>
        </div>
    `;
}

function toggleAggregatedFilterByData(checkbox) {
    const type = checkbox.dataset.filterType;
    const value = checkbox.dataset.filterValue;
    const checked = checkbox.checked;
    toggleAggregatedFilter(type, value, checked);
}

function toggleAggregatedFilter(type, value, checked) {
    const filterKey = `${type}:${value}`;
    
    if (checked) {
        // Add filter
        activeAggregatedFilters.set(filterKey, { type, value });
        addDynamicFilter(type, value);
    } else {
        // Remove filter
        activeAggregatedFilters.delete(filterKey);
        // Find and remove the matching filter
        const filterToRemove = dynamicFilters.find(f => f.type === type && f.value === value);
        if (filterToRemove) {
            removeDynamicFilter(filterToRemove.id);
        }
    }
    
    renderSongList();
    renderSelectedSongs();
}

function selectByArtist(artist) {
    addDynamicFilter('artist', artist);
}

function selectByTextAuthor(author) {
    addDynamicFilter('text_author', author);
}

function selectByGenre(genre) {
    addDynamicFilter('genre', genre);
}

function toggleSong(songId) {
    if (selectedSongIds.has(songId)) {
        selectedSongIds.delete(songId);
    } else {
        selectedSongIds.add(songId);
    }
    renderSongList();
    renderSelectedSongs();
}

function renderSelectedSongs() {
    const container = document.getElementById('selectedSongs');
    const selectedCount = document.getElementById('selectedCount');
    
    // Calculate all songs that will be included (filters + individual selections)
    const allIncludedSongs = getAllIncludedSongs();
    
    selectedCount.textContent = allIncludedSongs.size;
    if (typeof updateFinishSummary === 'function') {
        updateFinishSummary();
    }
    
    if (allIncludedSongs.size === 0 && dynamicFilters.length === 0) {
        container.innerHTML = '<div class="empty-state">Nie wybrano jeszcze żadnych piosenek</div>';
        return;
    }
    
    // Convert to array and sort alphabetically by title
    const songsArray = Array.from(allIncludedSongs)
        .map(id => songById.get(id))
        .filter(song => song) // Remove any undefined
        .sort((a, b) => a.title.localeCompare(b.title, 'pl'));
    
    // Show summary
    let html = '';
    
    if (dynamicFilters.length > 0) {
        html += '<div class="selection-summary">';
        html += '<strong>Filtry:</strong><br>';
        dynamicFilters.forEach(filter => {
            const matchCount = getMatchingsongsForFilter(filter).length;
            const typeLabels = {
                'genre': 'Gatunek',
                'artist': 'Wykonawca',
                'text_author': 'Autor tekstu'
            };
            html += `<div class="filter-summary">
                ${typeLabels[filter.type]}: ${escapeHtml(filter.value)} (${matchCount})
                <button class="remove-btn" onclick="removeDynamicFilter(${filter.id})" style="margin-left: 8px;">Usuń</button>
            </div>`;
        });
        html += '</div>';
    }
    
    html += '<div class="selection-summary">';
    html += `<strong>Razem (po deduplikacji):</strong> ${allIncludedSongs.size} ${allIncludedSongs.size === 1 ? 'piosenka' : allIncludedSongs.size < 5 ? 'piosenki' : 'piosenek'}`;
    html += '</div>';
    
    // Show expandable list
    html += '<details class="final-song-list" open>';
    html += '<summary><strong>Finalna lista piosenek</strong></summary>';
    html += '<div class="final-songs-container">';
    html += songsArray.map(song => {
        const isExplicit = selectedSongIds.has(song.id);
        const matchingFilters = dynamicFilters.filter(filter => {
            return getMatchingsongsForFilter(filter).some(s => s.id === song.id);
        });
        
        const typeLabels = {
            'genre': 'Gatunek',
            'artist': 'Wykonawca',
            'text_author': 'Autor tekstu'
        };
        
        let badge = '';
        if (isExplicit) {
            badge = `<button class="remove-song-btn" onclick="removeSong('${song.id}')">Usuń</button>`;
        } else if (matchingFilters.length > 0) {
            const filterDescriptions = matchingFilters.map(f => 
                `${typeLabels[f.type]}: ${escapeHtml(f.value)}`
            ).join(', ');
            badge = `<span class="filter-badge">Wybrany przez filtr dynamiczny: ${filterDescriptions}</span>`;
        }
        
        const aliasText = song.aliases && song.aliases.length > 0 
            ? ` (${escapeHtml(song.aliases.join(', '))})`
            : '';
        
        return `
        <div class="final-song-item">
            <span class="song-number">${songsArray.indexOf(song) + 1}.</span>
            <span class="song-title">
                <a href="${escapeHtml(song.html_url)}" target="_blank">${escapeHtml(song.title)}</a>${aliasText}
            </span>
            ${badge}
        </div>
    `;
    }).join('');
    html += '</div>';
    html += '</details>';
    
    container.innerHTML = html;
}

function getAllIncludedSongs() {
    const includedSongs = new Set();
    
    // Add songs from dynamic filters
    dynamicFilters.forEach(filter => {
        const matchingSongs = getMatchingsongsForFilter(filter);
        matchingSongs.forEach(song => includedSongs.add(song.id));
    });
    
    // Add individually selected songs
    selectedSongIds.forEach(id => includedSongs.add(id));
    
    return includedSongs;
}

function removeSong(songId) {
    selectedSongIds.delete(songId);
    renderSongList();
    renderSelectedSongs();
}

function selectAllVisible() {
    const items = getFilteredItems();
    items.forEach(item => {
        if (item.type === 'song') {
            selectedSongIds.add(item.data.id);
        }
    });
    renderSongList();
    renderSelectedSongs();
}

function deselectAllVisible() {
    const items = getFilteredItems();
    items.forEach(item => {
        if (item.type === 'song') {
            selectedSongIds.delete(item.data.id);
        }
    });
    renderSongList();
    renderSelectedSongs();
}

function clearSelection() {
    if (confirm('Czy na pewno chcesz wyczyścić wszystkie wybrane piosenki?')) {
        selectedSongIds.clear();
        renderSongList();
        renderSelectedSongs();
    }
}

function updateStats() {
    const items = getFilteredItems();
    const songCount = items.filter(item => item.type === 'song').length;
    const totalItems = items.length;
    
    if (songCount === totalItems) {
        document.getElementById('visibleCount').textContent = `${songCount} piosenek`;
    } else {
        const otherCount = totalItems - songCount;
        document.getElementById('visibleCount').textContent = `${songCount} piosenek, ${otherCount} grup`;
    }
    
    document.getElementById('totalCount').textContent = `${allSongs.length} piosenek`;
}

// Dynamic Filters
function addDynamicFilter(type = 'genre', value = '') {
    const filterId = filterCounter++;
    dynamicFilters.push({
        id: filterId,
        type: type,
        value: value
    });
    renderDynamicFilters();
    renderSongList();
}

function removeDynamicFilter(filterId) {
    const filter = dynamicFilters.find(f => f.id === filterId);
    if (filter) {
        // Remove from activeAggregatedFilters if it exists
        const filterKey = `${filter.type}:${filter.value}`;
        activeAggregatedFilters.delete(filterKey);
    }
    dynamicFilters = dynamicFilters.filter(f => f.id !== filterId);
    renderDynamicFilters();
    renderSongList();
    renderSelectedSongs();
}

function updateDynamicFilter(filterId, field, value) {
    const filter = dynamicFilters.find(f => f.id === filterId);
    if (filter) {
        filter[field] = value;
        renderDynamicFilters();
    }
}

function getMatchingsongsForFilter(filter) {
    return allSongs.filter(song => {
        if (filter.type === 'genre') {
            return song.genre === filter.value;
        } else if (filter.type === 'artist') {
            return song.artist === filter.value;
        } else if (filter.type === 'text_author') {
            return song.text_author === filter.value;
        }
        return false;
    });
}

function renderDynamicFilters() {
    const container = document.getElementById('dynamicFiltersList');
    
    // If container doesn't exist, filters are shown in selectedSongs panel instead
    if (!container) {
        return;
    }
    
    if (dynamicFilters.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = dynamicFilters.map(filter => {
        const matchingCount = getMatchingsongsForFilter(filter).length;
        const typeLabels = {
            'genre': 'Gatunek',
            'artist': 'Wykonawca',
            'text_author': 'Autor tekstu'
        };
        
        return `
        <div class="filter-item">
            <div class="filter-controls">
                <select onchange="updateDynamicFilter(${filter.id}, 'type', this.value)">
                    <option value="genre" ${filter.type === 'genre' ? 'selected' : ''}>Gatunek</option>
                    <option value="artist" ${filter.type === 'artist' ? 'selected' : ''}>Wykonawca</option>
                    <option value="text_author" ${filter.type === 'text_author' ? 'selected' : ''}>Autor tekstu</option>
                </select>
                <input type="text" 
                       value="${escapeHtml(filter.value)}" 
                       onchange="updateDynamicFilter(${filter.id}, 'value', this.value)"
                       placeholder="Wartość...">
                <button class="remove-btn" onclick="removeDynamicFilter(${filter.id})">Usuń</button>
            </div>
            <div class="filter-match-count">
                Dopasowane: ${matchingCount} ${matchingCount === 1 ? 'piosenka' : matchingCount < 5 ? 'piosenki' : 'piosenek'}
            </div>
        </div>
    `}).join('');
}

function generateYAMLString() {
    const songbookId = document.getElementById('songbookId').value.trim();
    const songbookTitle = document.getElementById('songbookTitle').value.trim();
    const songbookSubtitle = document.getElementById('songbookSubtitle').value.trim();
    const songbookPublisher = document.getElementById('songbookPublisher').value.trim();
    const songbookPlace = document.getElementById('songbookPlace').value.trim();
    
    if (!songbookId) {
        alert('Proszę podać ID śpiewnika');
        return null;
    }
    
    if (!songbookTitle) {
        alert('Proszę podać tytuł śpiewnika');
        return null;
    }
    
    if (selectedSongIds.size === 0 && dynamicFilters.length === 0) {
        alert('Proszę wybrać przynajmniej jedną piosenkę lub dodać filtr');
        return null;
    }
    
    // Generate UUID
    const uuid = generateUUID();
    
    // Build songbook data structure
    const songbook = {
        id: songbookId,
        uuid: uuid,
        title: songbookTitle,
        url: `https://spiewaj.com/#${songbookId}`,
        songs: []
    };
    
    if (songbookSubtitle) {
        songbook.subtitle = songbookSubtitle;
    }
    
    if (songbookPublisher) {
        songbook.publisher = songbookPublisher;
    }
    
    if (songbookPlace) {
        songbook.place = songbookPlace;
    }
    
    // Add dynamic filters first
    dynamicFilters.forEach(filter => {
        if (filter.value) {
            const filterObj = {};
            filterObj[filter.type] = { equals: filter.value };
            songbook.songs.push(filterObj);
        }
    });
    
    // Add individual selected songs as glob patterns
    Array.from(selectedSongIds).forEach(id => {
        const song = songById.get(id);
        if (song && song.path) {
            songbook.songs.push({ glob: song.path });
        } else {
            songbook.songs.push({ glob: `songs/**/${id}.xml` });
        }
    });
    
    if (typeof jsyaml !== 'undefined' && jsyaml.dump) {
        return jsyaml.dump({ songbook }, { indent: 2, lineWidth: -1 });
    }
    return JSON.stringify({ songbook }, null, 2);
}

function generateYAML() {
    const yaml = generateYAMLString();
    if (yaml) {
        document.getElementById('yamlOutput').value = yaml;
        document.getElementById('outputArea').style.display = 'block';
    }
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function escapeYAML(text) {
    if (text.includes('"') || text.includes('\n') || text.includes(':')) {
        return text.replace(/"/g, '\\"');
    }
    return text;
}

function downloadYAML() {
    const yaml = document.getElementById('yamlOutput').value;
    const songbookId = document.getElementById('songbookId').value.trim() || 'spiewnik';
    const filename = `${songbookId}.songbook.yaml`;
    
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function copyToClipboard() {
    const textarea = document.getElementById('yamlOutput');
    textarea.select();
    document.execCommand('copy');
    alert('Skopiowano do schowka!');
}

function downloadYAMLDirect() {
    const yaml = generateYAMLString();
    if (!yaml) return;
    
    const songbookId = document.getElementById('songbookId').value.trim() || 'spiewnik';
    const filename = `${songbookId}.songbook.yaml`;
    
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function loadFromYAMLString(content, cloudDoc = null) {
    let data;
    if (typeof jsyaml !== 'undefined') {
        data = jsyaml.load(content);
    } else {
        data = JSON.parse(content);
    }
    
    if (!data || !data.songbook) {
        throw new Error("Nieprawidłowy format pliku: brak obiektu 'songbook'");
    }
    
    const sb = data.songbook;
    
    // Populate form fields
    document.getElementById('songbookId').value = sb.id || cloudDoc?.id || '';
    document.getElementById('songbookTitle').value = sb.title || cloudDoc?.title || '';
    document.getElementById('songbookSubtitle').value = sb.subtitle || cloudDoc?.subtitle || '';
    document.getElementById('songbookPublisher').value = sb.publisher || cloudDoc?.publisher || '';
    document.getElementById('songbookPlace').value = sb.place || cloudDoc?.place || '';
    
    const publicEl = document.getElementById('songbookIsPublic');
    if (publicEl) {
        publicEl.checked = cloudDoc ? cloudDoc.isPublic !== false : true;
    }
    
    currentCloudSongbook = cloudDoc;
    userEditedId = !!(sb.id || cloudDoc?.id); // Prevents auto-generation of ID
    updateCloudStatusUI();
    updateCollaboratorsUI();
    
    // Clear current selections
    selectedSongIds.clear();
    dynamicFilters = [];
    filterCounter = 0;
    activeAggregatedFilters.clear();
    
    // Parse songs
    if (sb.songs && Array.isArray(sb.songs)) {
        sb.songs.forEach(item => {
            if (item.glob) {
                // Convert glob to regex
                let regexStr = '^' + item.glob
                    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex specials except *
                    .replace(/\/\*\*\//g, '/(?:.*/)?')     // /**/ -> /(?:.*/)?
                    .replace(/\*\*/g, '.*')                // Remaining ** -> .*
                    .replace(/\*/g, '[^/]*')               // * -> [^/]*
                    + '$';
                const regex = new RegExp(regexStr);
                
                let found = false;
                for (const song of allSongs) {
                    if (song.path && regex.test(song.path)) {
                        selectedSongIds.add(song.id);
                        found = true;
                    } else if (!song.path && `songs/**/${song.id}.xml` === item.glob) {
                        selectedSongIds.add(song.id);
                        found = true;
                    }
                }
                // Fallback for single filename
                if (!found && !item.glob.includes('*')) {
                    const match = item.glob.match(/([^\/]+)\.xml$/);
                    if (match) {
                        const songId = match[1];
                        if (songById.has(songId)) {
                            selectedSongIds.add(songId);
                        }
                    }
                }
            } else if (item.genre && item.genre.equals) {
                addDynamicFilter('genre', item.genre.equals);
                activeAggregatedFilters.set(`genre:${item.genre.equals}`, { type: 'genre', value: item.genre.equals });
            } else if (item.artist && item.artist.equals) {
                addDynamicFilter('artist', item.artist.equals);
                activeAggregatedFilters.set(`artist:${item.artist.equals}`, { type: 'artist', value: item.artist.equals });
            } else if (item.text_author && item.text_author.equals) {
                addDynamicFilter('text_author', item.text_author.equals);
                activeAggregatedFilters.set(`text_author:${item.text_author.equals}`, { type: 'text_author', value: item.text_author.equals });
            }
        });
    }
    
    // Render updates
    renderDynamicFilters();
    renderSongList();
    renderSelectedSongs();
    updateStats();
}

function loadFromYAMLFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            loadFromYAMLString(e.target.result);
            alert('Śpiewnik został pomyślnie wczytany!');
        } catch (error) {
            alert('Błąd podczas wczytywania pliku: ' + error.message);
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

/* ==========================================================================
   Cloud Operations & Collaborators (Phase 3)
   ========================================================================== */

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function handleLoginCloud() {
    if (!window.FirebaseSongbook) {
        alert("Moduł Firebase nie został jeszcze załadowany.");
        return;
    }
    try {
        await window.FirebaseSongbook.loginWithGoogle();
    } catch (e) {
        console.error("Login cancelled or failed:", e);
        if (e.code === 'auth/popup-blocked') {
            alert("Przeglądarka zablokowała wyskakujące okno logowania Google. Zezwól na wyskakujące okienka dla tej strony.");
        } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
            alert("Błąd logowania przez Google: " + (e.message || e));
        }
    }
}

async function handleLogoutCloud() {
    if (!window.FirebaseSongbook) return;
    try {
        await window.FirebaseSongbook.logout();
        currentCloudSongbook = null;
        updateCollaboratorsUI();
        setCloudStatusText('');
    } catch (e) {
        console.error("Logout failed:", e);
    }
}

async function ensureAuthenticated() {
    if (!window.FirebaseSongbook) {
        throw new Error("Moduł Firebase nie został jeszcze załadowany.");
    }

    let user = window.FirebaseSongbook.getCurrentUser();
    if (!user) {
        try {
            user = await window.FirebaseSongbook.loginWithGoogle();
        } catch (e) {
            if (e.code === 'auth/popup-blocked') {
                throw new Error("Przeglądarka zablokowała wyskakujące okno logowania Google. Zezwól na wyskakujące okienka dla tej strony.");
            } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
                throw new Error("Błąd logowania przez Google: " + (e.message || e));
            } else {
                throw new Error("Logowanie zostało anulowane.");
            }
        }
    }
    return user;
}

function getSongbookFormData() {
    let songbookId = document.getElementById('songbookId').value.trim();
    const songbookTitle = document.getElementById('songbookTitle').value.trim();
    if (!songbookTitle) {
        alert("Podaj tytuł śpiewnika przed zapisaniem.");
        document.getElementById('songbookTitle').focus();
        return null;
    }

    // When modifying an existing cloud songbook, ensure its ID remains fixed
    if (currentCloudSongbook && currentCloudSongbook.id) {
        songbookId = currentCloudSongbook.id;
        document.getElementById('songbookId').value = songbookId;
    }

    if (!songbookId) {
        alert("Podaj ID śpiewnika przed zapisaniem.");
        document.getElementById('songbookId').focus();
        return null;
    }

    const yamlStr = generateYAMLString();
    if (!yamlStr) return null;

    const isPublic = document.getElementById('songbookIsPublic') ? document.getElementById('songbookIsPublic').checked : true;

    return {
        id: songbookId,
        title: songbookTitle,
        subtitle: document.getElementById('songbookSubtitle').value.trim(),
        publisher: document.getElementById('songbookPublisher').value.trim(),
        place: document.getElementById('songbookPlace').value.trim(),
        isPublic: isPublic,
        yaml: yamlStr
    };
}

function setCloudStatusText(text) {
    const badge = document.getElementById('cloudStatusBadge');
    if (badge) badge.textContent = text || '';
    const finishBadge = document.getElementById('finishStatusBadge');
    if (finishBadge) finishBadge.textContent = text || '';
}

function updateFinishSummary() {
    const titleEl = document.getElementById('songbookTitle');
    const finishTitle = document.getElementById('finishSummaryTitle');
    if (finishTitle && titleEl) {
        const titleVal = titleEl.value.trim();
        finishTitle.textContent = titleVal || 'Bez tytułu';
    }

    const finishCount = document.getElementById('finishSummaryCount');
    if (finishCount) {
        const count = typeof getAllIncludedSongs === 'function' ? getAllIncludedSongs().size : 0;
        let suffix = 'piosenek';
        if (count === 1) {
            suffix = 'piosenka';
        } else if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) {
            suffix = 'piosenki';
        }
        finishCount.textContent = `${count} ${suffix}`;
    }

    const finishVis = document.getElementById('finishSummaryVisibility');
    const isPublicEl = document.getElementById('songbookIsPublic');
    if (finishVis) {
        const isPub = isPublicEl ? isPublicEl.checked : true;
        finishVis.textContent = isPub ? 'Publiczny w katalogu' : 'Prywatny (szkic)';
        finishVis.className = isPub ? 'badge-public' : 'badge-private';
    }

    const finishIdContainer = document.getElementById('finishSummaryIdContainer');
    const finishId = document.getElementById('finishSummaryId');
    const songbookIdEl = document.getElementById('songbookId');
    const activeId = currentCloudSongbook?.id || (songbookIdEl ? songbookIdEl.value.trim() : '');
    if (finishIdContainer && finishId) {
        if (activeId) {
            finishId.textContent = activeId;
            finishIdContainer.style.display = 'inline-flex';
        } else {
            finishIdContainer.style.display = 'none';
        }
    }
}

async function saveDraftCloud() {
    const btnDraft = document.getElementById('btnSaveDraft');
    const btnDraftHeader = document.getElementById('btnSaveDraftHeader');
    const btnPublish = document.getElementById('btnSavePublish');

    try {
        await ensureAuthenticated();
        const data = getSongbookFormData();
        if (!data) return;

        if (btnDraft) btnDraft.disabled = true;
        if (btnDraftHeader) btnDraftHeader.disabled = true;
        if (btnPublish) btnPublish.disabled = true;
        setCloudStatusText("Zapisywanie szkicu...");

        const res = await window.FirebaseSongbook.saveSongbook({
            ...data,
            additionalOwnerIds: currentCloudSongbook?.ownerIds || [],
            allSongs: allSongs,
            isPublished: false,
            artifacts: currentCloudSongbook?.artifacts || {}
        });

        currentCloudSongbook = res;
        userEditedId = true;
        updateCloudStatusUI();
        updateCollaboratorsUI();

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setCloudStatusText(`✓ Zapisano szkic (${timeStr})`);

        if (history.replaceState) {
            history.replaceState(null, '', `#songbook=${encodeURIComponent(data.id)}`);
        }
    } catch (e) {
        console.error("Błąd zapisu szkicu:", e);
        alert(e.message || "Błąd zapisu w chmurze.");
        setCloudStatusText("Błąd zapisu");
    } finally {
        if (btnDraft) btnDraft.disabled = false;
        if (btnDraftHeader) btnDraftHeader.disabled = false;
        if (btnPublish) btnPublish.disabled = false;
    }
}

function updatePublishStep(stepId, state, statusText) {
    const el = document.getElementById(stepId);
    if (!el) return;
    el.className = 'publish-step ' + (state || '');
    const icon = el.querySelector('.step-icon');
    const status = el.querySelector('.step-status');
    if (status) status.textContent = statusText;
    if (icon) {
        if (state === 'running') icon.textContent = 'progress_activity';
        else if (state === 'success') icon.textContent = 'check_circle';
        else if (state === 'error') icon.textContent = 'error';
        else icon.textContent = 'sync';
    }
}

function openPublishModal() {
    const modal = document.getElementById('modalPublish');
    if (modal) modal.style.display = 'flex';
    const resultLinks = document.getElementById('publishResultLinks');
    if (resultLinks) resultLinks.style.display = 'none';
    const badgesArea = document.getElementById('publishBadgesArea');
    if (badgesArea) badgesArea.innerHTML = '';
    const catalogBtn = document.getElementById('btnPublishViewInCatalog');
    if (catalogBtn) catalogBtn.style.display = 'none';

    updatePublishStep('stepCloudSave', 'running', 'Zapisywanie...');
    updatePublishStep('stepPdfA5', '', 'Oczekiwanie...');
    updatePublishStep('stepPdfA4', '', 'Oczekiwanie...');
    updatePublishStep('stepEpub', '', 'Oczekiwanie...');
}

function closePublishModal() {
    const modal = document.getElementById('modalPublish');
    if (modal) modal.style.display = 'none';
}

async function saveAndPublishCloud() {
    const btnDraft = document.getElementById('btnSaveDraft');
    const btnDraftHeader = document.getElementById('btnSaveDraftHeader');
    const btnPublish = document.getElementById('btnSavePublish');

    try {
        await ensureAuthenticated();
        const data = getSongbookFormData();
        if (!data) return;

        openPublishModal();
        if (btnDraft) btnDraft.disabled = true;
        if (btnDraftHeader) btnDraftHeader.disabled = true;
        if (btnPublish) btnPublish.disabled = true;

        // Step 1: Save metadata to cloud with isPublished: true
        const artifacts = { ...(currentCloudSongbook?.artifacts || {}) };
        const res = await window.FirebaseSongbook.saveSongbook({
            ...data,
            additionalOwnerIds: currentCloudSongbook?.ownerIds || [],
            allSongs: allSongs,
            isPublished: true,
            artifacts: artifacts
        });
        currentCloudSongbook = res;
        userEditedId = true;
        updateCloudStatusUI();
        updateCollaboratorsUI();
        updatePublishStep('stepCloudSave', 'success', 'Zapisano w chmurze');

        const urlParams = new URLSearchParams(window.location.search);
        const branch = urlParams.get('branch') || 'main';
        const songbookTitle = data.title || 'spiewnik';
        const dateStr = new Date().toISOString().split('T')[0];

        // Step 2: Render PDF A5
        updatePublishStep('stepPdfA5', 'running', 'Kompilacja LaTeX...');
        let pdfA5Promise = renderArtifactCloudRun({
            yaml_content: data.yaml,
            branch: branch,
            papersize: 'a5',
            songbook_id: data.id,
            is_published: true
        }, '/api/render/songbook_yaml').then(({ url }) => {
            const filename = encodeURIComponent(`${songbookTitle}_A5_${dateStr}.pdf`);
            const sep = url.includes('?') ? '&' : '?';
            const finalUrl = `${url}${sep}filename=${filename}&disposition=inline`;
            artifacts.pdf_a5 = finalUrl;
            updatePublishStep('stepPdfA5', 'success', 'Gotowy');
            return finalUrl;
        }).catch(err => {
            console.warn("Błąd PDF A5:", err);
            updatePublishStep('stepPdfA5', 'error', 'Błąd: ' + (err.message || 'Nieudana kompilacja'));
            return null;
        });

        // Step 3: Render PDF A4
        updatePublishStep('stepPdfA4', 'running', 'Kompilacja LaTeX...');
        let pdfA4Promise = renderArtifactCloudRun({
            yaml_content: data.yaml,
            branch: branch,
            papersize: 'a4',
            songbook_id: data.id,
            is_published: true
        }, '/api/render/songbook_yaml').then(({ url }) => {
            const filename = encodeURIComponent(`${songbookTitle}_A4_${dateStr}.pdf`);
            const sep = url.includes('?') ? '&' : '?';
            const finalUrl = `${url}${sep}filename=${filename}&disposition=inline`;
            artifacts.pdf_a4 = finalUrl;
            updatePublishStep('stepPdfA4', 'success', 'Gotowy');
            return finalUrl;
        }).catch(err => {
            console.warn("Błąd PDF A4:", err);
            updatePublishStep('stepPdfA4', 'error', 'Błąd: ' + (err.message || 'Nieudana kompilacja'));
            return null;
        });

        // Step 4: Render EPUB
        updatePublishStep('stepEpub', 'running', 'Generowanie e-booka...');
        let epubPromise = renderArtifactCloudRun({
            yaml_content: data.yaml,
            branch: branch,
            songbook_id: data.id,
            is_published: true
        }, '/api/render/songbook_epub').then(({ url }) => {
            const filename = encodeURIComponent(`${songbookTitle}_${dateStr}.epub`);
            const sep = url.includes('?') ? '&' : '?';
            const finalUrl = `${url}${sep}filename=${filename}&disposition=attachment`;
            artifacts.epub = finalUrl;
            updatePublishStep('stepEpub', 'success', 'Gotowy');
            return finalUrl;
        }).catch(err => {
            console.warn("Błąd EPUB:", err);
            updatePublishStep('stepEpub', 'error', 'Niedostępne');
            return null;
        });

        // Wait for all 3 formats to complete
        await Promise.allSettled([pdfA5Promise, pdfA4Promise, epubPromise]);

        // Save generated artifacts to Firestore
        await window.FirebaseSongbook.updateSongbookArtifacts(data.id, artifacts, true);
        currentCloudSongbook.artifacts = artifacts;
        currentCloudSongbook.isPublished = true;

        // Render download badges in modal
        const badgesArea = document.getElementById('publishBadgesArea');
        if (badgesArea) {
            badgesArea.innerHTML = '';
            if (artifacts.epub) {
                badgesArea.innerHTML += `
                    <a href="${artifacts.epub}" class="badge-download badge-epub" target="_blank" rel="noopener">
                        <span class="material-symbols-outlined">tablet_android</span> EPUB
                    </a>`;
            }
            if (artifacts.pdf_a5) {
                badgesArea.innerHTML += `
                    <a href="${artifacts.pdf_a5}" class="badge-download badge-pdf-a5" target="_blank" rel="noopener">
                        <span class="material-symbols-outlined">picture_as_pdf</span> PDF A5
                    </a>`;
            }
            if (artifacts.pdf_a4) {
                badgesArea.innerHTML += `
                    <a href="${artifacts.pdf_a4}" class="badge-download badge-pdf-a4" target="_blank" rel="noopener">
                        <span class="material-symbols-outlined">picture_as_pdf</span> PDF A4
                    </a>`;
            }
        }

        const resultLinks = document.getElementById('publishResultLinks');
        if (resultLinks) resultLinks.style.display = 'block';
        const catalogBtn = document.getElementById('btnPublishViewInCatalog');
        if (catalogBtn) catalogBtn.style.display = 'inline-flex';

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setCloudStatusText(`✓ Opublikowano (${timeStr})`);

        if (history.replaceState) {
            history.replaceState(null, '', `#songbook=${encodeURIComponent(data.id)}`);
        }
    } catch (e) {
        console.error("Błąd publikacji:", e);
        alert(e.message || "Błąd podczas publikacji śpiewnika.");
        setCloudStatusText("Błąd publikacji");
    } finally {
        if (btnDraft) btnDraft.disabled = false;
        if (btnDraftHeader) btnDraftHeader.disabled = false;
        if (btnPublish) btnPublish.disabled = false;
    }
}

function updateCloudStatusUI() {
    const banner = document.getElementById('cloudSongbookBanner');
    const badgeVis = document.getElementById('cloudSongbookVisibilityBadge');
    const idText = document.getElementById('cloudSongbookIdText');
    const btnToggleText = document.getElementById('btnToggleVisibilityText');
    const btnToggle = document.getElementById('btnToggleVisibility');
    const btnDup = document.getElementById('btnDuplicateSongbook');
    const idEl = document.getElementById('songbookId');
    const help = document.getElementById('songbookIdHelp');

    if (currentCloudSongbook && currentCloudSongbook.id) {
        if (idEl) {
            idEl.value = currentCloudSongbook.id;
            idEl.readOnly = true;
            idEl.style.backgroundColor = '#f1f3f5';
            idEl.style.cursor = 'not-allowed';
        }
        if (help) {
            help.textContent = 'ID jest unikalnym i stałym identyfikatorem śpiewnika w chmurze (nie zmienia się po edycji tytułu).';
        }
        if (btnDup) btnDup.style.display = 'inline-flex';

        const isPub = currentCloudSongbook.isPublic !== false;
        if (banner) banner.style.display = 'flex';
        if (badgeVis) {
            badgeVis.textContent = isPub ? 'Publiczny w katalogu' : 'Prywatny (szkic)';
            badgeVis.className = isPub ? 'badge-public' : 'badge-private';
        }
        if (idText) {
            idText.innerHTML = `ID: <code>${escapeHTML(currentCloudSongbook.id)}</code>`;
        }
        if (btnToggleText) {
            btnToggleText.textContent = isPub ? 'Cofnij publikację (zrób prywatny)' : 'Opublikuj w katalogu';
        }
        if (btnToggle) {
            const icon = btnToggle.querySelector('.material-symbols-outlined');
            if (icon) icon.textContent = isPub ? 'visibility_off' : 'public';
        }
    } else {
        if (idEl) {
            idEl.readOnly = false;
            idEl.style.backgroundColor = '';
            idEl.style.cursor = '';
        }
        if (help) help.textContent = '';
        if (btnDup) btnDup.style.display = 'none';
        if (banner) banner.style.display = 'none';
    }

    updateFinishSummary();
}

function startNewSongbook(force = false) {
    if (force || confirm("Czy na pewno chcesz rozpocząć nowy śpiewnik? Niezapisane zmiany zostaną utracone.")) {
        document.getElementById('songbookTitle').value = '';
        const idEl = document.getElementById('songbookId');
        idEl.value = '';
        idEl.readOnly = false;
        idEl.style.backgroundColor = '';
        idEl.style.cursor = '';
        document.getElementById('songbookSubtitle').value = '';
        document.getElementById('songbookPublisher').value = '';
        document.getElementById('songbookPlace').value = '';
        if (document.getElementById('songbookIsPublic')) {
            document.getElementById('songbookIsPublic').checked = true;
        }
        userEditedId = false;
        currentCloudSongbook = null;
        updateCloudStatusUI();
        updateCollaboratorsUI();
        clearSelection();
        setCloudStatusText('');
        const paperSizeSelect = document.getElementById('paperSize');
        if (paperSizeSelect) paperSizeSelect.value = 'a5';
        if (history.replaceState) {
            history.replaceState(null, '', window.location.pathname);
        }
    }
}

function duplicateAsNewSongbook() {
    if (!currentCloudSongbook) return;
    const oldTitle = document.getElementById('songbookTitle').value.trim();
    const oldId = document.getElementById('songbookId').value.trim();

    currentCloudSongbook = null;
    userEditedId = false;

    const newId = (oldId || 'spiewnik') + '_kopia';
    const newTitle = (oldTitle || 'Śpiewnik') + ' (Kopia)';

    document.getElementById('songbookTitle').value = newTitle;
    const idEl = document.getElementById('songbookId');
    idEl.value = newId;
    idEl.readOnly = false;
    idEl.style.backgroundColor = '';
    idEl.style.cursor = '';

    updateCloudStatusUI();

    const help = document.getElementById('songbookIdHelp');
    if (help) help.textContent = 'Tworzenie niezależnego nowego śpiewnika jako kopia. Dostosuj tytuł/ID i kliknij "Zapisz szkic".';

    setCloudStatusText('Przygotowano kopię do zapisu jako nowy śpiewnik');

    if (history.replaceState) {
        history.replaceState(null, '', window.location.pathname);
    }
}

async function deleteCurrentSongbook() {
    if (!currentCloudSongbook || !currentCloudSongbook.id) return;
    const id = currentCloudSongbook.id;
    const title = currentCloudSongbook.title || id;
    if (!confirm(`Czy na pewno chcesz bezpowrotnie usunąć śpiewnik "${title}" (ID: ${id}) z chmury? Ta operacja jest nieodwracalna.`)) {
        return;
    }

    try {
        await window.FirebaseSongbook.deleteSongbook(id);
        alert(`Śpiewnik "${title}" został usunięty.`);
        startNewSongbook(true);
    } catch (e) {
        console.error("Błąd usuwania śpiewnika:", e);
        alert("Błąd podczas usuwania śpiewnika: " + (e.message || e));
    }
}

async function toggleCurrentSongbookVisibility() {
    if (!currentCloudSongbook || !currentCloudSongbook.id) return;
    const id = currentCloudSongbook.id;
    const makePublic = !(currentCloudSongbook.isPublic !== false);

    const confirmMsg = makePublic
        ? `Czy chcesz opublikować śpiewnik "${currentCloudSongbook.title || id}" w publicznym katalogu?`
        : `Czy chcesz wycofać śpiewnik "${currentCloudSongbook.title || id}" z publicznego katalogu i oznaczyć go jako prywatny? Będzie on nadal dostępny w sekcji "Moje śpiewniki".`;

    if (!confirm(confirmMsg)) return;

    try {
        await window.FirebaseSongbook.setSongbookVisibility(id, makePublic);
        currentCloudSongbook.isPublic = makePublic;
        currentCloudSongbook.isPublished = makePublic;

        const isPubCheckbox = document.getElementById('songbookIsPublic');
        if (isPubCheckbox) isPubCheckbox.checked = makePublic;

        updateCloudStatusUI();
        setCloudStatusText(makePublic ? '✓ Opublikowano w katalogu' : '✓ Oznaczono jako prywatny');
    } catch (e) {
        console.error("Błąd zmiany widoczności:", e);
        alert("Błąd zmiany widoczności: " + (e.message || e));
    }
}

async function toggleCloudSongbookVisibility(id, makePublic) {
    const confirmMsg = makePublic
        ? `Czy chcesz udostępnić ten śpiewnik w publicznym katalogu?`
        : `Czy chcesz wycofać ten śpiewnik z publicznego katalogu i oznaczyć go jako prywatny?`;
    if (!confirm(confirmMsg)) return;

    try {
        await window.FirebaseSongbook.setSongbookVisibility(id, makePublic);
        if (currentCloudSongbook && currentCloudSongbook.id === id) {
            currentCloudSongbook.isPublic = makePublic;
            currentCloudSongbook.isPublished = makePublic;
            const isPubCheckbox = document.getElementById('songbookIsPublic');
            if (isPubCheckbox) isPubCheckbox.checked = makePublic;
            updateCloudStatusUI();
        }
        await openMySongbooksModal();
    } catch (e) {
        console.error("Błąd zmiany widoczności:", e);
        alert("Błąd podczas zmiany widoczności: " + (e.message || e));
    }
}

async function openMySongbooksModal() {
    const modal = document.getElementById('modalMySongbooks');
    if (!modal) return;
    modal.style.display = 'flex';

    const container = document.getElementById('mySongbooksListContainer');
    container.innerHTML = '<div class="loader">Ładowanie Twoich śpiewników...</div>';

    if (!window.FirebaseSongbook) {
        container.innerHTML = '<p style="color: #c82333;">Moduł Firebase nie jest dostępny.</p>';
        return;
    }

    const user = window.FirebaseSongbook.getCurrentUser();
    if (!user) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <p>Musisz być zalogowany, aby przeglądać swoje śpiewniki.</p>
                <button class="btn btn-primary" onclick="handleLoginCloud().then(() => openMySongbooksModal())">
                    Zaloguj przez Google
                </button>
            </div>
        `;
        return;
    }

    try {
        const songbooks = await window.FirebaseSongbook.fetchMySongbooks();
        if (!songbooks || songbooks.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 30px;">
                    <p style="font-size: 1.1em; color: #555;">Nie masz jeszcze zapisanych śpiewników w chmurze.</p>
                    <p style="font-size: 0.9em; color: #888;">Stwórz swój śpiewnik i kliknij <strong>"Zapisz szkic"</strong> lub <strong>"Zapisz i opublikuj"</strong>.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = songbooks.map(sb => {
            const count = sb.songCount || (sb.resolvedSongIds ? sb.resolvedSongIds.length : 0);
            let dateStr = '';
            if (sb.updatedAt && sb.updatedAt.toDate) {
                dateStr = sb.updatedAt.toDate().toLocaleDateString('pl-PL');
            }
            const isPub = sb.isPublic !== false;
            return `
                <div class="songbook-card">
                    <div class="songbook-card-info">
                        <div class="songbook-card-title" onclick="loadCloudSongbookById('${escapeHTML(sb.id)}')">${escapeHTML(sb.title || sb.id)}</div>
                        <div class="songbook-card-meta">
                            <span>ID: <code>${escapeHTML(sb.id)}</code></span>
                            <span>•</span>
                            <span>${count} ${count === 1 ? 'piosenka' : (count < 5 ? 'piosenki' : 'piosenek')}</span>
                            ${dateStr ? `<span>• ${dateStr}</span>` : ''}
                            <span class="${isPub ? 'badge-public' : 'badge-private'}">${isPub ? 'Publiczny' : 'Prywatny'}</span>
                        </div>
                    </div>
                    <div class="songbook-card-actions">
                        <a class="btn btn-sm btn-secondary" href="index.html#songbook=${encodeURIComponent(sb.id)}" target="_blank" style="text-decoration: none;">Przeglądaj</a>
                        <button class="btn btn-sm btn-primary" onclick="loadCloudSongbookById('${escapeHTML(sb.id)}')">Edytuj</button>
                        ${isPub ? `
                            <button class="btn btn-sm btn-outline" onclick="toggleCloudSongbookVisibility('${escapeHTML(sb.id)}', false)" title="Wycofaj z publicznego katalogu i oznacz jako prywatny">
                                <span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle;">visibility_off</span> Ukryj
                            </button>
                        ` : `
                            <button class="btn btn-sm btn-outline" style="color: #2e7d32; border-color: #2e7d32;" onclick="toggleCloudSongbookVisibility('${escapeHTML(sb.id)}', true)" title="Udostępnij w publicznym katalogu">
                                <span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle;">public</span> Opublikuj
                            </button>
                        `}
                        <button class="btn btn-sm btn-outline btn-danger-soft" onclick="deleteCloudSongbookById('${escapeHTML(sb.id)}')" title="Trwale usuń z chmury">
                            <span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle;">delete</span> Usuń
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error("Błąd pobierania śpiewników:", e);
        container.innerHTML = `<p style="color: #c82333;">Błąd podczas ładowania śpiewników: ${escapeHTML(e.message)}</p>`;
    }
}

function closeMySongbooksModal() {
    const modal = document.getElementById('modalMySongbooks');
    if (modal) modal.style.display = 'none';
}

async function loadCloudSongbookById(id) {
    closeMySongbooksModal();
    setCloudStatusText("Wczytywanie...");
    try {
        if (songsLoadedPromise) await songsLoadedPromise;
        const doc = await window.FirebaseSongbook.fetchSongbook(id);
        if (!doc) {
            alert("Nie znaleziono śpiewnika w chmurze.");
            return;
        }
        loadFromYAMLString(doc.yaml, doc);
        setCloudStatusText(`Wczytano: ${doc.title}`);
        if (history.replaceState) {
            history.replaceState(null, '', `#songbook=${encodeURIComponent(doc.id)}`);
        }
    } catch (e) {
        alert("Błąd podczas wczytywania śpiewnika: " + e.message);
    }
}

async function deleteCloudSongbookById(id) {
    if (!confirm(`Czy na pewno chcesz trwale usunąć śpiewnik "${id}" z chmury? Ta operacja jest nieodwracalna.`)) return;
    try {
        await window.FirebaseSongbook.deleteSongbook(id);
        if (currentCloudSongbook && currentCloudSongbook.id === id) {
            startNewSongbook(true);
        }
        await openMySongbooksModal();
    } catch (e) {
        console.error("Błąd usuwania:", e);
        alert("Błąd usuwania: " + (e.message || e));
    }
}

function openReaderPage() {
    const songbookId = document.getElementById('songbookId').value.trim();
    if (!songbookId) {
        alert("Najpierw podaj ID i zapisz śpiewnik w chmurze.");
        return;
    }
    const baseUrl = `${window.location.origin}${window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1)}`;
    const readerUrl = `${baseUrl}index.html#songbook=${encodeURIComponent(songbookId)}`;
    window.open(readerUrl, '_blank');
}

function openShareModal() {
    const songbookId = document.getElementById('songbookId').value.trim();
    if (!songbookId) {
        alert("Najpierw podaj ID i zapisz śpiewnik.");
        return;
    }
    const modal = document.getElementById('modalShare');
    if (!modal) return;
    modal.style.display = 'flex';

    const baseUrl = `${window.location.origin}${window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1)}`;
    const readerUrl = `${baseUrl}index.html#songbook=${encodeURIComponent(songbookId)}`;
    const editUrl = `${baseUrl}songbook_edit.html#songbook=${encodeURIComponent(songbookId)}`;

    const readerInput = document.getElementById('shareReaderUrlInput');
    if (readerInput) readerInput.value = readerUrl;
    const readerBtn = document.getElementById('shareReaderOpenBtn');
    if (readerBtn) readerBtn.href = readerUrl;

    const editInput = document.getElementById('shareUrlInput');
    if (editInput) editInput.value = editUrl;

    const emailBox = document.getElementById('shareCurrentUserEmail');
    if (emailBox) {
        if (currentUser) {
            emailBox.textContent = currentUser.displayName
                ? `${currentUser.displayName} (${currentUser.email || 'brak emaila'})`
                : (currentUser.email || currentUser.uid);
        } else {
            emailBox.textContent = "Niezalogowany";
        }
    }

    renderCollaboratorsList();
}

function closeShareModal() {
    const modal = document.getElementById('modalShare');
    if (modal) modal.style.display = 'none';
}

function copyShareReaderUrl() {
    const input = document.getElementById('shareReaderUrlInput');
    if (!input) return;
    input.select();
    navigator.clipboard.writeText(input.value).then(() => {
        alert("Link do czytania śpiewnika (spiewaj.com) skopiowany do schowka!");
    });
}

function copyShareUrl() {
    const input = document.getElementById('shareUrlInput');
    if (!input) return;
    input.select();
    navigator.clipboard.writeText(input.value).then(() => {
        alert("Link do edycji w kreatorze skopiowany do schowka!");
    });
}

function updateCollaboratorsUI() {
    const previewEl = document.getElementById('collaboratorsPreview');
    const countEl = document.getElementById('collaboratorsCountText');
    if (!previewEl || !countEl) return;

    if (currentCloudSongbook && Array.isArray(currentCloudSongbook.ownerIds) && currentCloudSongbook.ownerIds.length > 1) {
        previewEl.style.display = 'block';
        countEl.textContent = `${currentCloudSongbook.ownerIds.length} osoby z uprawnieniami`;
    } else {
        previewEl.style.display = 'none';
    }
}

function renderCollaboratorsList() {
    const container = document.getElementById('collaboratorsList');
    if (!container) return;

    if (!currentCloudSongbook || !Array.isArray(currentCloudSongbook.ownerIds)) {
        container.innerHTML = '<p style="color: #666; font-size: 0.9em;">Zapisz ten śpiewnik w chmurze, aby zarządzać współtwórcami.</p>';
        return;
    }

    const members = currentCloudSongbook.members || {};
    const creatorId = currentCloudSongbook.creatorId;

    container.innerHTML = currentCloudSongbook.ownerIds.map(uid => {
        const memberInfo = members[uid] || {};
        let label = '';
        if (memberInfo.displayName && memberInfo.email) {
            label = `${memberInfo.displayName} (${memberInfo.email})`;
        } else {
            label = memberInfo.displayName || memberInfo.email || `Użytkownik (${uid.substring(0, 8)}...)`;
        }
        const isCreator = uid === creatorId;
        const role = isCreator ? 'Właściciel' : 'Edytor';
        const isMe = currentUser && currentUser.uid === uid;
        const canRemove = currentUser && currentUser.uid === creatorId && !isCreator;

        return `
            <div class="collaborator-item">
                <div>
                    <strong>${escapeHTML(label)}</strong> ${isMe ? '<small>(Ty)</small>' : ''}
                    <span class="collaborator-role">${role}</span>
                </div>
                ${canRemove ? `<button class="btn btn-sm btn-outline" style="color: #c82333; padding: 2px 6px;" onclick="handleRemoveCollaborator('${escapeHTML(uid)}')">Usuń</button>` : ''}
            </div>
        `;
    }).join('');
}

async function handleAddCollaborator() {
    const emailInput = document.getElementById('newCollaboratorEmail');
    const inputVal = emailInput ? emailInput.value.trim() : '';
    if (!inputVal) return;

    if (!currentCloudSongbook) {
        alert("Najpierw zapisz śpiewnik w chmurze przed dodaniem współtwórców.");
        return;
    }

    const btn = document.getElementById('btnAddCollaborator');
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Szukanie...";
    }

    try {
        let targetUser = null;
        if (inputVal.includes('@')) {
            targetUser = await window.FirebaseSongbook.findUserByEmail(inputVal);
        } else {
            // Check if user entered a raw UID
            targetUser = (await window.FirebaseSongbook.findUserById(inputVal)) || { uid: inputVal, email: '', displayName: '' };
        }

        if (!targetUser || !targetUser.uid) {
            alert(`Nie znaleziono użytkownika dla adresu: "${inputVal}".\n\nWspółtwórca musi zalogować się przynajmniej raz na spiewaj.com przez Google, aby można go było wyszukać.`);
            return;
        }

        const currentOwners = currentCloudSongbook.ownerIds || [];
        if (currentOwners.includes(targetUser.uid)) {
            alert("Ten użytkownik jest już współtwórcą tego śpiewnika.");
            return;
        }

        const updatedOwners = [...currentOwners, targetUser.uid];
        const updatedMembers = { ...(currentCloudSongbook.members || {}) };
        updatedMembers[targetUser.uid] = {
            role: 'editor',
            email: targetUser.email || inputVal,
            displayName: targetUser.displayName || '',
            addedAt: new Date().toISOString()
        };

        await window.FirebaseSongbook.saveSongbook({
            id: currentCloudSongbook.id,
            title: currentCloudSongbook.title,
            subtitle: currentCloudSongbook.subtitle,
            publisher: currentCloudSongbook.publisher,
            place: currentCloudSongbook.place,
            isPublic: currentCloudSongbook.isPublic,
            yaml: currentCloudSongbook.yaml,
            additionalOwnerIds: updatedOwners,
            members: updatedMembers,
            allSongs: allSongs
        });

        currentCloudSongbook.ownerIds = updatedOwners;
        currentCloudSongbook.members = updatedMembers;
        if (emailInput) emailInput.value = '';
        renderCollaboratorsList();
        updateCollaboratorsUI();
        const successName = targetUser.displayName ? `${targetUser.displayName} (${targetUser.email || targetUser.uid})` : (targetUser.email || targetUser.uid);
        alert(`Dodano współtwórcę: ${successName}!`);
    } catch (e) {
        alert("Nie udało się dodać współtwórcy: " + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "+ Dodaj";
        }
    }
}

async function handleRemoveCollaborator(uidToRemove) {
    if (!confirm("Czy na pewno chcesz odebrać uprawnienia temu współtwórcy?")) return;

    try {
        const updatedOwners = (currentCloudSongbook.ownerIds || []).filter(u => u !== uidToRemove);
        const updatedMembers = { ...(currentCloudSongbook.members || {}) };
        delete updatedMembers[uidToRemove];

        await window.FirebaseSongbook.saveSongbook({
            id: currentCloudSongbook.id,
            title: currentCloudSongbook.title,
            subtitle: currentCloudSongbook.subtitle,
            publisher: currentCloudSongbook.publisher,
            place: currentCloudSongbook.place,
            isPublic: currentCloudSongbook.isPublic,
            yaml: currentCloudSongbook.yaml,
            additionalOwnerIds: updatedOwners,
            members: updatedMembers,
            allSongs: allSongs
        });

        currentCloudSongbook.ownerIds = updatedOwners;
        currentCloudSongbook.members = updatedMembers;
        renderCollaboratorsList();
        updateCollaboratorsUI();
        alert("Pomyślnie usunięto współtwórcę.");
    } catch (e) {
        alert("Błąd podczas usuwania współtwórcy: " + e.message);
    }
}

async function checkForUrlSongbook() {
    const params = new URLSearchParams(window.location.search);
    let sbId = params.get('songbook');
    if (!sbId && window.location.hash) {
        const hashMatch = window.location.hash.match(/#songbook=([^&]+)/);
        if (hashMatch) sbId = decodeURIComponent(hashMatch[1]);
    }

    if (sbId && window.FirebaseSongbook) {
        try {
            if (songsLoadedPromise) await songsLoadedPromise;
            const doc = await window.FirebaseSongbook.fetchSongbook(sbId);
            if (doc && doc.yaml) {
                loadFromYAMLString(doc.yaml, doc);
                setCloudStatusText(`Wczytano z chmury: ${doc.title}`);
            }
        } catch (e) {
            console.warn("Nie udało się załadować śpiewnika z URL:", e);
        }
    }
}

function initAuthUI() {
    const checkInterval = setInterval(() => {
        if (window.FirebaseSongbook) {
            clearInterval(checkInterval);
            window.FirebaseSongbook.onAuthChange((user) => {
                currentUser = user;
                const btnLogin = document.getElementById('btnLoginHeader');
                const profileArea = document.getElementById('userProfileArea');
                const nameEl = document.getElementById('userNameText');
                const avatarImg = document.getElementById('userAvatarImg');
                const avatarInitials = document.getElementById('userAvatarInitials');

                if (user) {
                    if (btnLogin) btnLogin.style.display = 'none';
                    if (profileArea) profileArea.style.display = 'flex';
                    if (nameEl) nameEl.textContent = user.displayName || user.email || 'Zalogowany';

                    if (user.photoURL) {
                        avatarImg.src = user.photoURL;
                        avatarImg.style.display = 'block';
                        avatarInitials.style.display = 'none';
                    } else {
                        avatarImg.style.display = 'none';
                        avatarInitials.style.display = 'inline-flex';
                        const initial = (user.displayName || user.email || 'U')[0].toUpperCase();
                        avatarInitials.textContent = initial;
                    }
                } else {
                    if (btnLogin) btnLogin.style.display = 'inline-flex';
                    if (profileArea) profileArea.style.display = 'none';
                }
            });
            checkForUrlSongbook();
        }
    }, 100);
}

// Expose handlers to window for onclick attributes
window.saveDraftCloud = saveDraftCloud;
window.saveAndPublishCloud = saveAndPublishCloud;
window.openPublishModal = openPublishModal;
window.closePublishModal = closePublishModal;
window.saveToCloud = saveDraftCloud; // backward compatibility
window.renderPDF = renderPDF;
window.startNewSongbook = startNewSongbook;
window.duplicateAsNewSongbook = duplicateAsNewSongbook;
window.deleteCurrentSongbook = deleteCurrentSongbook;
window.toggleCurrentSongbookVisibility = toggleCurrentSongbookVisibility;
window.toggleCloudSongbookVisibility = toggleCloudSongbookVisibility;
window.updateCloudStatusUI = updateCloudStatusUI;
window.openMySongbooksModal = openMySongbooksModal;
window.closeMySongbooksModal = closeMySongbooksModal;
window.loadCloudSongbookById = loadCloudSongbookById;
window.deleteCloudSongbookById = deleteCloudSongbookById;
window.openShareModal = openShareModal;
window.closeShareModal = closeShareModal;
window.copyShareUrl = copyShareUrl;
window.copyShareReaderUrl = copyShareReaderUrl;
window.openReaderPage = openReaderPage;
window.handleAddCollaborator = handleAddCollaborator;
window.handleRemoveCollaborator = handleRemoveCollaborator;
window.handleLoginCloud = handleLoginCloud;
window.handleLogoutCloud = handleLogoutCloud;



async function renderPDF() {
    const yaml = generateYAMLString();
    if (!yaml) return;

    // Estimate time: 3s per selected song, minimum 15s. If only dynamic filters, fallback to 60s.
    let songCount = selectedSongIds.size;
    let estimatedSeconds = Math.max(15, songCount * 3);
    if (songCount === 0 && dynamicFilters.length > 0) {
        estimatedSeconds = 60; // Just a rough guess if we only have filters
    }

    // Get branch from URL or default to main
    const urlParams = new URLSearchParams(window.location.search);
    const branch = urlParams.get('branch') || 'main';

    // Get paper size
    const paperSizeSelect = document.getElementById('paperSize');
    const paperSize = paperSizeSelect ? paperSizeSelect.value : 'a5';

    const payload = {
        yaml_content: yaml,
        branch: branch,
        papersize: paperSize
    };

    const btn = document.getElementById('btnRenderPdf');
    const originalBtnText = btn ? btn.textContent : "Generuj Śpiewnik (PDF)";
    const pdfOutputArea = document.getElementById('pdfOutputArea');
    const pdfStatusText = document.getElementById('pdfStatusText');
    const pdfDownloadLink = document.getElementById('pdfDownloadLink');

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Trwa generowanie...";
    }

    if (pdfOutputArea) pdfOutputArea.style.display = 'block';
    if (pdfStatusText) {
        pdfStatusText.style.display = 'block';
        pdfStatusText.textContent = `Trwa generowanie śpiewnika... Proszę czekać (szacowany czas: około ${estimatedSeconds} sekund).`;
    }
    if (pdfDownloadLink) pdfDownloadLink.style.display = 'none';

    renderPdfCloudRun(
        payload,
        "/api/render/songbook_yaml",
        () => {
            // Already handled above to make it strictly immediate
        },
        (url) => {
            if (btn) {
                btn.disabled = false;
                btn.textContent = originalBtnText;
            }
            if (pdfStatusText) pdfStatusText.style.display = 'none';
            if (pdfDownloadLink) {
                const songbookTitle = document.getElementById('songbookTitle').value.trim() || 'spiewnik';
                const dateStr = new Date().toISOString().split('T')[0];
                const filename = encodeURIComponent(`${songbookTitle}_${dateStr}.pdf`);
                pdfDownloadLink.href = `${url}?filename=${filename}&disposition=inline`;
                pdfDownloadLink.style.display = 'block';
            }
        },
        (err, errUrl) => {
            alert(err);
            if (btn) {
                btn.disabled = false;
                btn.textContent = originalBtnText;
            }
            if (pdfStatusText) pdfStatusText.textContent = err;
        }
    );
}

// Auto-generate songbook ID from title
let userEditedId = false; // Track if user manually edited the ID

function generateIdFromTitle(title) {
    return title
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/ą/g, 'a')
        .replace(/ć/g, 'c')
        .replace(/ę/g, 'e')
        .replace(/ł/g, 'l')
        .replace(/ń/g, 'n')
        .replace(/ó/g, 'o')
        .replace(/ś/g, 's')
        .replace(/ź/g, 'z')
        .replace(/ż/g, 'z')
        .replace(/[^a-z0-9]+/g, '_') // Replace non-alphanumeric with underscore
        .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
        .replace(/_+/g, '_'); // Replace multiple underscores with single
}

// Event listeners
document.getElementById('searchBox').addEventListener('input', renderSongList);

document.getElementById('songbookTitle').addEventListener('input', function() {
    // Never auto-generate ID if this is an established cloud songbook or if user edited the ID
    if (!userEditedId && !currentCloudSongbook) {
        const id = generateIdFromTitle(this.value);
        document.getElementById('songbookId').value = id;
    }
    updateFinishSummary();
});

document.getElementById('songbookId').addEventListener('input', function() {
    // If user manually edits the ID, stop auto-generation
    userEditedId = true;
    updateFinishSummary();
});

document.getElementById('songbookId').addEventListener('focus', function() {
    // When user focuses on ID field, assume they want to edit it manually
    userEditedId = true;
});

const isPublicCheckbox = document.getElementById('songbookIsPublic');
if (isPublicCheckbox) {
    isPublicCheckbox.addEventListener('change', updateFinishSummary);
}

// Initialize
const paperSizeSelect = document.getElementById('paperSize');
if (paperSizeSelect) paperSizeSelect.value = 'a5';
songsLoadedPromise = loadSongs();
initAuthUI();
updateFinishSummary();
window.addEventListener('hashchange', checkForUrlSongbook);

window.updateFinishSummary = updateFinishSummary;
