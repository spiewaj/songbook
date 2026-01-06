let allSongs = [];
let selectedSongIds = new Set();
let songById = new Map();
let dynamicFilters = [];
let filterCounter = 0;
let activeAggregatedFilters = new Map(); // Track which aggregated filters are active

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

function generateYAML() {
    const songbookId = document.getElementById('songbookId').value.trim();
    const songbookTitle = document.getElementById('songbookTitle').value.trim();
    const songbookSubtitle = document.getElementById('songbookSubtitle').value.trim();
    const songbookPublisher = document.getElementById('songbookPublisher').value.trim();
    const songbookPlace = document.getElementById('songbookPlace').value.trim();
    
    if (!songbookId) {
        alert('Proszę podać ID śpiewnika');
        return;
    }
    
    if (!songbookTitle) {
        alert('Proszę podać tytuł śpiewnika');
        return;
    }
    
    if (selectedSongIds.size === 0 && dynamicFilters.length === 0) {
        alert('Proszę wybrać przynajmniej jedną piosenkę lub dodać filtr');
        return;
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
    
    const yaml = JSON.stringify({ songbook }, null, 2);
    document.getElementById('yamlOutput').value = yaml;
    document.getElementById('outputArea').style.display = 'block';
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
    const songbookId = document.getElementById('songbookId').value.trim();
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
    if (!userEditedId) {
        const id = generateIdFromTitle(this.value);
        document.getElementById('songbookId').value = id;
    }
});

document.getElementById('songbookId').addEventListener('input', function() {
    // If user manually edits the ID, stop auto-generation
    userEditedId = true;
});

document.getElementById('songbookId').addEventListener('focus', function() {
    // When user focuses on ID field, assume they want to edit it manually
    userEditedId = true;
});

// Initialize
loadSongs();
