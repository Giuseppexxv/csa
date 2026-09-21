/**
 * PLAYER VIDEO STANDALONE CON HLS.JS
 * Pagina dedicata per la riproduzione di stream video
 */

// ============================================
// CONFIGURAZIONE
// ============================================

const API_BASE = '/api';
let hls = null;
let currentStreamUrl = null;

// ============================================
// INIZIALIZZAZIONE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    setupPlayerControls();
    checkUrlParams();
});

// ============================================
// CONTROLLO PARAMETRI URL
// ============================================

function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const streamUrl = urlParams.get('url');
    const title = urlParams.get('title');

    if (streamUrl) {
        currentStreamUrl = decodeURIComponent(streamUrl);
        document.getElementById('stream-url-input').value = currentStreamUrl;
        
        if (title) {
            document.getElementById('player-title').textContent = title;
        }

        playVideo(currentStreamUrl, currentStreamUrl);
    }
}

// ============================================
// SETUP CONTROLLI PLAYER
// ============================================

function setupPlayerControls() {
    const video = document.getElementById('main-player');
    
    // Play/Pause
    document.getElementById('play-pause-btn')?.addEventListener('click', () => {
        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    });

    // Fullscreen
    document.getElementById('fullscreen-btn')?.addEventListener('click', () => {
        toggleFullscreen();
    });

    // Copia URL
    document.getElementById('copy-url-btn')?.addEventListener('click', () => {
        const urlInput = document.getElementById('stream-url-input');
        urlInput.select();
        document.execCommand('copy');
        showNotification('URL copiato negli appunti', 'success');
    });

    // Aggiorna lista qualità quando i livelli sono disponibili
    video.addEventListener('loadedmetadata', () => {
        updateQualityOptions(video);
    });
}

// ============================================
// RIPRODUZIONE VIDEO CON HLS.JS
// ============================================

function playVideo(proxyUrl, originalUrl) {
    const video = document.getElementById('main-player');
    const streamDetails = document.getElementById('stream-details');
    const urlInput = document.getElementById('stream-url-input');

    urlInput.value = originalUrl;

    // Mostra informazioni stream
    if (streamDetails) {
        streamDetails.innerHTML = `
            <div><strong>URL Originale:</strong> ${originalUrl}</div>
            <div><strong>URL Proxy:</strong> ${proxyUrl}</div>
            <div><strong>Tipo:</strong> ${proxyUrl.includes('.m3u8') ? 'HLS Stream' : 'MP4 Direct'}</div>
            <div><strong>Stato:</strong> <span id="stream-status">Caricamento...</span></div>
        `;
    }

    // Distruggi istanza HLS precedente se esiste
    if (hls) {
        hls.destroy();
        hls = null;
    }

    // Riproduci in base al tipo di stream
    if (Hls.isSupported() && proxyUrl.includes('.m3u8')) {
        initHLSPlayer(video, proxyUrl);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Supporto nativo HLS (Safari)
        video.src = proxyUrl;
        video.addEventListener('loadedmetadata', () => {
            updateStreamStatus('Pronto per la riproduzione');
            video.play().catch(e => console.log('Autoplay bloccato:', e));
        });
    } else {
        // MP4 o altro formato diretto
        video.src = proxyUrl;
        video.addEventListener('loadedmetadata', () => {
            updateStreamStatus('Pronto per la riproduzione');
            video.play().catch(e => console.log('Autoplay bloccato:', e));
        });
    }
}

function initHLSPlayer(video, url) {
    hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
        maxBufferSize: 60 * 1000 * 1000, // 60MB
        maxBufferHole: 0.5,
        startLevel: -1, // Selezione automatica della qualità iniziale
        abrEwmaDefaultEstimate: 500000, // Stima bandwidth iniziale
        abrBandWidthFactor: 0.95,
        abrBandWidthUpFactor: 0.7
    });

    hls.loadSource(url);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        updateStreamStatus(`Manifesto caricato - ${data.levels.length} livelli di qualità disponibili`);
        updateQualityOptions(video, data.levels);
        
        // Avvia la riproduzione automaticamente
        video.play().catch(e => {
            console.log('Autoplay bloccato dal browser:', e);
            updateStreamStatus('Clicca Play per avviare');
        });
    });

    hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
        updateStreamStatus(`Livello ${data.details.targetduration}s caricato`);
    });

    hls.on(Hls.Events.FRAG_CHANGED, (event, data) => {
        const frag = data.frag;
        if (frag && frag.level !== undefined) {
            // Aggiorna selettore qualità
            const qualitySelect = document.getElementById('quality-select');
            if (qualitySelect && qualitySelect.value === 'auto') {
                // La qualità è in automatico
            }
        }
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS Error:', data);
        
        if (data.fatal) {
            updateStreamStatus(`Errore: ${data.type}`);
            
            switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                    updateStreamStatus('Errore di rete - Tentativo di recupero...');
                    hls.startLoad();
                    break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                    updateStreamStatus('Errore media - Tentativo di recupero...');
                    hls.recoverMediaError();
                    break;
                default:
                    updateStreamStatus('Errore irrecoverabile');
                    hls.destroy();
                    break;
            }
        } else {
            // Errori non fatali
            console.warn('HLS Non-fatal error:', data);
        }
    });
}

// ============================================
// GESTIONE QUALITÀ VIDEO
// ============================================

function updateQualityOptions(video, levels = null) {
    const qualitySelect = document.getElementById('quality-select');
    if (!qualitySelect) return;

    // Ottieni i livelli da HLS o dal video
    const availableLevels = levels || (hls ? hls.levels : []);

    if (availableLevels.length > 0) {
        // Opzione automatica
        let options = '<option value="auto">Automatico</option>';
        
        // Aggiungi ogni livello di qualità
        availableLevels.forEach((level, index) => {
            const height = level.height || 'Unknown';
            const bitrate = Math.round(level.bitrate / 1000);
            options += `<option value="${index}">${height}p @ ${bitrate}kbps</option>`;
        });

        qualitySelect.innerHTML = options;

        // Gestisci cambio qualità
        qualitySelect.addEventListener('change', (e) => {
            const selectedValue = e.target.value;
            
            if (selectedValue === 'auto') {
                hls.currentLevel = -1; // Torna ad automatico
                updateStreamStatus('Qualità automatica selezionata');
            } else {
                hls.currentLevel = parseInt(selectedValue);
                const level = availableLevels[parseInt(selectedValue)];
                updateStreamStatus(`Qualità manuale: ${level.height}p`);
            }
        });
    }
}

// ============================================
// FULLSCREEN
// ============================================

function toggleFullscreen() {
    const container = document.querySelector('.video-container') || document.documentElement;

    if (!document.fullscreenElement) {
        if (container.requestFullscreen) {
            container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
            container.webkitRequestFullscreen();
        } else if (container.msRequestFullscreen) {
            container.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

// ============================================
// UTILITIES
// ============================================

function updateStreamStatus(message) {
    const statusElement = document.getElementById('stream-status');
    if (statusElement) {
        statusElement.textContent = message;
    }
    console.log('[Stream Status]', message);
}

function showNotification(message, type = 'info') {
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

// Aggiungi animazioni per le notifiche se non esistono già
if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
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
}

// Listener per errori globali
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    updateStreamStatus('Si è verificato un errore');
});

// Pulizia quando si lascia la pagina
window.addEventListener('beforeunload', () => {
    if (hls) {
        hls.destroy();
    }
});
