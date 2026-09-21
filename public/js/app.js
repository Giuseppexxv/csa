/**
 * MEDIA AGGREGATOR & READER - FRONTEND CLIENT
 * Gestione interfaccia utente, chiamate API e player video
 */

// ============================================
// CONFIGURAZIONE E STATO GLOBALE
// ============================================

const API_BASE = '/api';
const PROXY_PORT = 3001;

let currentSources = [];
let selectedMedia = null;

// ============================================
// INIZIALIZZAZIONE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    loadSources();
    setupEventListeners();
});

// ============================================
// NAVIGAZIONE TRA TAB
// ============================================

function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Rimuovi active da tutti i bottoni e tab
            navButtons.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            
            // Aggiungi active al bottone e tab selezionati
            btn.classList.add('active');
            const tabId = `${btn.dataset.tab}-tab`;
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// ============================================
// GESTIONE EVENTI
// ============================================

function setupEventListeners() {
    // Ricerca TMDB
    document.getElementById('tmdb-search-btn')?.addEventListener('click', searchTMDB);
    document.getElementById('tmdb-search-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchTMDB();
    });

    // Aggiunta sorgente
    document.getElementById('add-source-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        addSource();
    });

    // Importa URL
    document.getElementById('import-btn')?.addEventListener('click', importUrls);

    // Ricerca contenuti
    document.getElementById('content-search-btn')?.addEventListener('click', searchContent);
    document.getElementById('content-search-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchContent();
    });

    // Chiusura modali
    document.querySelectorAll('.modal-close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            closeBtn.closest('.modal').classList.remove('active');
        });
    });

    // Chiudi modale cliccando fuori
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });
}

// ============================================
// API TMDB - CATALOGO
// ============================================

async function searchTMDB() {
    const query = document.getElementById('tmdb-search-input').value.trim();
    const year = document.getElementById('tmdb-year-input').value;

    if (!query) {
        showNotification('Inserisci un titolo da cercare', 'error');
        return;
    }

    const resultsContainer = document.getElementById('catalog-results');
    resultsContainer.innerHTML = '<div class="empty-state"><span class="loading"></span></div>';

    try {
        const url = new URL(`${API_BASE}/tmdb/search`);
        url.searchParams.append('query', query);
        if (year) url.searchParams.append('year', year);

        const response = await fetch(url);
        const data = await response.json();

        if (data.success && data.data.length > 0) {
            renderCatalogResults(data.data);
        } else {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <div class="empty-state-text">Nessun risultato trovato</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('TMDB Search Error:', error);
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <div class="empty-state-text">Errore nella ricerca</div>
            </div>
        `;
    }
}

function renderCatalogResults(results) {
    const container = document.getElementById('catalog-results');
    
    container.innerHTML = results.map(item => `
        <div class="result-card" onclick="showMediaDetails('${item.mediaType}', ${item.id})">
            <img src="${item.posterPath || '/images/placeholder.png'}" 
                 alt="${item.title}" 
                 onerror="this.src='/images/placeholder.png'">
            <div class="result-card-info">
                <div class="result-card-title">${item.title}</div>
                <div class="result-card-meta">
                    <span>${item.releaseDate ? item.releaseDate.split('-')[0] : 'N/A'}</span>
                    <span class="result-card-rating">⭐ ${item.voteAverage?.toFixed(1) || 'N/A'}</span>
                </div>
            </div>
        </div>
    `).join('');
}

async function showMediaDetails(mediaType, id) {
    const modal = document.getElementById('details-modal');
    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = '<div class="empty-state"><span class="loading"></span></div>';
    modal.classList.add('active');

    try {
        const endpoint = mediaType === 'movie' ? `movie/${id}` : `tv/${id}`;
        const response = await fetch(`${API_BASE}/tmdb/${endpoint}`);
        const data = await response.json();

        if (data.success) {
            renderMediaDetails(data.data, mediaType);
        }
    } catch (error) {
        console.error('Details Error:', error);
        modalBody.innerHTML = '<div class="empty-state">Errore nel caricamento dei dettagli</div>';
    }
}

function renderMediaDetails(details, mediaType) {
    const modalBody = document.getElementById('modal-body');
    
    let seasonsHtml = '';
    if (mediaType === 'tv' && details.seasons) {
        seasonsHtml = `
            <div class="seasons-section">
                <h3>Stagioni</h3>
                <div class="seasons-list">
                    ${details.seasons.map(season => `
                        <button class="season-btn" onclick="loadSeasonEpisodes(${details.id}, ${season.season_number})">
                            ${season.name}
                        </button>
                    `).join('')}
                </div>
                <div id="episodes-container"></div>
            </div>
        `;
    }

    modalBody.innerHTML = `
        <div class="media-details">
            <div class="media-header">
                <img src="${details.backdropPath || details.posterPath}" alt="${details.title}" class="media-backdrop">
                <div class="media-info">
                    <h2>${details.title}</h2>
                    <p class="media-meta">
                        ${details.releaseDate || 'N/A'} • 
                        ⭐ ${details.voteAverage?.toFixed(1) || 'N/A'} • 
                        ${details.genres.map(g => g.name).join(', ')}
                    </p>
                    <p class="media-overview">${details.overview || 'Nessuna descrizione disponibile'}</p>
                </div>
            </div>
            ${seasonsHtml}
            <div class="action-buttons">
                <button class="btn-primary" onclick="searchContentOnSources('${details.title}')">
                    🔍 Cerca sulle Sorgenti
                </button>
            </div>
        </div>
    `;
}

async function loadSeasonEpisodes(tvId, seasonNumber) {
    const episodesContainer = document.getElementById('episodes-container');
    episodesContainer.innerHTML = '<span class="loading"></span>';

    try {
        const response = await fetch(`${API_BASE}/tmdb/tv/${tvId}/season/${seasonNumber}`);
        const data = await response.json();

        if (data.success) {
            episodesContainer.innerHTML = `
                <div class="episodes-list">
                    ${data.data.map(ep => `
                        <div class="episode-item">
                            <img src="${ep.stillPath || '/images/placeholder.png'}" alt="${ep.name}">
                            <div class="episode-info">
                                <h4>Episodio ${ep.episodeNumber}: ${ep.name}</h4>
                                <p>${ep.overview || 'Nessuna descrizione'}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    } catch (error) {
        console.error('Episodes Error:', error);
        episodesContainer.innerHTML = 'Errore nel caricamento episodi';
    }
}

// ============================================
// GESTIONE SORGENTI
// ============================================

async function loadSources() {
    try {
        const response = await fetch(`${API_BASE}/sources`);
        const data = await response.json();

        if (data.success) {
            currentSources = data.data;
            renderSourcesList(currentSources);
        }
    } catch (error) {
        console.error('Load Sources Error:', error);
    }
}

function renderSourcesList(sources) {
    const container = document.getElementById('sources-container');
    
    if (sources.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <div class="empty-state-text">Nessuna sorgente configurata</div>
            </div>
        `;
        return;
    }

    container.innerHTML = sources.map(source => `
        <div class="source-item ${source.enabled ? 'enabled' : ''}" data-id="${source.id}">
            <div class="source-item-info">
                <div class="source-item-name">${source.name}</div>
                <div class="source-item-url">${source.baseUrl}</div>
            </div>
            <div class="source-item-actions">
                <button class="btn-toggle" onclick="toggleSource('${source.id}')">
                    ${source.enabled ? 'Attiva' : 'Disattiva'}
                </button>
                <button class="btn-delete" onclick="deleteSource('${source.id}')">Elimina</button>
            </div>
        </div>
    `).join('');
}

async function addSource() {
    const nameInput = document.getElementById('source-name');
    const urlInput = document.getElementById('source-url');

    const name = nameInput.value.trim();
    const baseUrl = urlInput.value.trim();

    if (!baseUrl) {
        showNotification('Inserisci un URL base valido', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/sources`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, baseUrl })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Sorgente aggiunta con successo', 'success');
            nameInput.value = '';
            urlInput.value = '';
            loadSources();
        } else {
            showNotification(data.error || 'Errore nell\'aggiunta', 'error');
        }
    } catch (error) {
        console.error('Add Source Error:', error);
        showNotification('Errore di connessione', 'error');
    }
}

async function toggleSource(sourceId) {
    const source = currentSources.find(s => s.id === sourceId);
    if (!source) return;

    try {
        const response = await fetch(`${API_BASE}/sources/${sourceId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: !source.enabled })
        });

        const data = await response.json();

        if (data.success) {
            loadSources();
        }
    } catch (error) {
        console.error('Toggle Source Error:', error);
    }
}

async function deleteSource(sourceId) {
    if (!confirm('Sei sicuro di voler eliminare questa sorgente?')) return;

    try {
        const response = await fetch(`${API_BASE}/sources/${sourceId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Sorgente eliminata', 'success');
            loadSources();
        }
    } catch (error) {
        console.error('Delete Source Error:', error);
    }
}

async function importUrls() {
    const textarea = document.getElementById('import-urls');
    const urlsText = textarea.value.trim();

    if (!urlsText) {
        showNotification('Incolla almeno un URL', 'error');
        return;
    }

    const urls = urlsText.split('\n').map(line => line.trim()).filter(line => line);

    try {
        const response = await fetch(`${API_BASE}/sources/import/txt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls })
        });

        const data = await response.json();

        if (data.success) {
            showNotification(`${data.data.length} sorgenti importate`, 'success');
            textarea.value = '';
            loadSources();
        }
    } catch (error) {
        console.error('Import Error:', error);
    }
}

// ============================================
// RICERCA CONTENUTI SULLE SORGENTI
// ============================================

async function searchContent() {
    const query = document.getElementById('content-search-input').value.trim();

    if (!query) {
        showNotification('Inserisci un titolo da cercare', 'error');
        return;
    }

    const resultsContainer = document.getElementById('content-results');
    resultsContainer.innerHTML = '<div class="empty-state"><span class="loading"></span></div>';

    try {
        const response = await fetch(`${API_BASE}/search/content`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        const data = await response.json();

        if (data.success && data.data.length > 0) {
            renderContentResults(data.data);
        } else {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <div class="empty-state-text">Nessun risultato trovato sulle sorgenti</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Content Search Error:', error);
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <div class="empty-state-text">Errore nella ricerca</div>
            </div>
        `;
    }
}

async function searchContentOnSources(title) {
    // Chiudi il modal dei dettagli e vai alla tab ricerca
    document.getElementById('details-modal').classList.remove('active');
    document.querySelector('[data-tab="search"]').click();
    
    // Imposta il titolo e cerca
    document.getElementById('content-search-input').value = title;
    searchContent();
}

function renderContentResults(results) {
    const container = document.getElementById('content-results');
    
    container.innerHTML = results.map(item => `
        <div class="result-item">
            <div>
                <div class="result-item-title">${item.title}</div>
                <div class="result-item-source">Fonte: ${item.sourceName}</div>
            </div>
            <div class="result-item-actions">
                <button onclick="extractAndPlay('${item.link}', '${item.sourceId}')">
                    ▶️ Riproduci
                </button>
            </div>
        </div>
    `).join('');
}

async function extractAndPlay(url, sourceId) {
    const playerModal = document.getElementById('player-modal');
    playerModal.classList.add('active');

    try {
        const response = await fetch(`${API_BASE}/media/extract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, sourceId })
        });

        const data = await response.json();

        if (data.success && (data.data.streams.hls.length > 0 || data.data.streams.mp4.length > 0)) {
            const firstStream = data.data.streams.hls[0] || data.data.streams.mp4[0];
            playVideo(firstStream.proxy, firstStream.original);
        } else {
            showNotification('Nessuno stream trovato', 'error');
        }
    } catch (error) {
        console.error('Extract Error:', error);
        showNotification('Errore nell\'estrazione dello stream', 'error');
    }
}

// ============================================
// PLAYER VIDEO CON HLS.JS
// ============================================

let hls = null;

function playVideo(proxyUrl, originalUrl) {
    const video = document.getElementById('video-player');
    const streamInfo = document.getElementById('stream-info');
    const urlInput = document.getElementById('stream-url-input');

    urlInput.value = originalUrl;

    streamInfo.innerHTML = `
        <div><strong>URL Originale:</strong> ${originalUrl}</div>
        <div><strong>URL Proxy:</strong> ${proxyUrl}</div>
        <div><strong>Tipo:</strong> ${proxyUrl.includes('.m3u8') ? 'HLS Stream' : 'MP4 Direct'}</div>
    `;

    if (Hls.isSupported() && proxyUrl.includes('.m3u8')) {
        if (hls) {
            hls.destroy();
        }

        hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 90
        });

        hls.loadSource(proxyUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(e => console.log('Autoplay bloccato:', e));
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                console.error('HLS Error:', data);
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        hls.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        hls.recoverMediaError();
                        break;
                    default:
                        hls.destroy();
                        break;
                }
            }
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Supporto nativo HLS (Safari)
        video.src = proxyUrl;
        video.addEventListener('loadedmetadata', () => {
            video.play();
        });
    } else {
        // MP4 o altro formato diretto
        video.src = proxyUrl;
        video.addEventListener('loadedmetadata', () => {
            video.play();
        });
    }
}

// ============================================
// UTILITIES
// ============================================

function showNotification(message, type = 'info') {
    // Implementazione base - può essere estesa con toast reali
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background-color: ${type === 'error' ? '#ea4335' : type === 'success' ? '#34a853' : '#1a73e8'};
        color: white;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 2000;
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Aggiungi animazioni per le notifiche
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);
