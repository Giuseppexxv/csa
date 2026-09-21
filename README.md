# Media Aggregator & Reader - MVP

Un'applicazione "Media Aggregator & Reader" ispirata ai moderni media center personalizzabili (client-side reader).

## 🎯 Caratteristiche Principali

### 1. Catalogo e Gestione Sorgenti (Frontend Client)
- **Integrazione API TMDB v3**: Cerca titoli, ottieni dettagli, elenco stagioni/episodi
- **Gestione Sorgenti Web**: Inserisci o importa da file .txt un elenco di URL base di domini web
- **Persistenza Locale**: Le sorgenti vengono salvate in file JSON locale

### 2. Motore Generico di Parsing HTML/DOM (Node.js + Cheerio)
- **Configurazione JSON**: Regole mappabili per selettori CSS/XPath
- **Estrazione Automatica**: Navigazione automatica e estrazione URL media (.m3u8, .mp4, embed)
- **Supporto Multi-Sorgente**: Configurazione indipendente per ogni sorgente

### 3. Middleware Reverse Proxy & Streaming HLS (Node.js + Express)
- **Reverse Proxy**: Intercetta richieste per file .m3u8 e segmenti .ts
- **Header HTTP Corretti**: Imposta Referer, User-Agent, Origin, CORS
- **Streaming Trasparente**: Forwarding dei flussi verso il client

### 4. Integrazione con Player Video Client (hls.js)
- **Player Web**: Configurazione completa basata su hls.js
- **Supporto HLS**: Riproduzione di stream .m3u8
- **Qualità Adattiva**: Selezione automatica/manuale della qualità

## 📁 Struttura del Progetto

```
media-aggregator-reader/
├── src/
│   ├── config/
│   │   ├── config.json       # Configurazione server e API
│   │   └── rules.json        # Regole di parsing per le sorgenti
│   ├── services/
│   │   ├── tmdbService.js    # Servizio API TMDB
│   │   ├── sourceManager.js  # Gestione sorgenti utente
│   │   └── htmlParserEngine.js # Motore parsing HTML
│   ├── middleware/
│   │   └── hlsProxy.js       # Reverse proxy HLS
│   ├── routes/
│   │   └── api.js            # Rotte API REST
│   └── server.js             # Server principale
├── public/
│   ├── css/
│   │   └── styles.css        # Stili frontend
│   ├── js/
│   │   ├── app.js            # Logica frontend principale
│   │   └── player.js         # Player video standalone
│   ├── index.html            # Pagina principale
│   └── player.html           # Pagina player dedicato
├── data/
│   └── sources.json          # Persistenza sorgenti (generato)
├── package.json
└── README.md
```

## 🚀 Installazione

```bash
# Installa le dipendenze
npm install

# Configura la chiave API TMDB in src/config/config.json
# Sostituisci "YOUR_TMDB_API_KEY" con la tua chiave reale
```

## ▶️ Avvio

```bash
# Avvio normale
npm start

# Avvio in modalità sviluppo (con nodemon)
npm run dev
```

Il server sarà disponibile su:
- **Frontend/API**: http://localhost:3000
- **Proxy HLS**: http://localhost:3001

## 📡 Endpoint API

### TMDB - Catalogo
- `GET /api/tmdb/search?query=<titolo>&year=<anno>` - Cerca film/serie
- `GET /api/tmdb/movie/:id` - Dettagli film
- `GET /api/tmdb/tv/:id` - Dettagli serie TV
- `GET /api/tmdb/tv/:id/seasons` - Stagioni serie TV
- `GET /api/tmdb/tv/:id/season/:seasonNumber` - Episodi stagione

### Gestione Sorgenti
- `GET /api/sources` - Lista tutte le sorgenti
- `GET /api/sources/:id` - Dettagli sorgente
- `POST /api/sources` - Aggiungi sorgente
- `PUT /api/sources/:id` - Aggiorna sorgente
- `DELETE /api/sources/:id` - Elimina sorgente
- `POST /api/sources/import/txt` - Importa da lista URL
- `POST /api/sources/export/json` - Esporta in JSON

### Ricerca e Estrazione
- `POST /api/search/content` - Cerca su tutte le sorgenti
- `POST /api/media/extract` - Estrai URL streaming da pagina

## 🔧 Configurazione Sorgenti

### Esempio rules.json

```json
{
  "sources": [
    {
      "id": "example-source",
      "name": "Example Streaming",
      "baseUrl": "https://example.com",
      "enabled": true,
      "rules": {
        "search": {
          "urlPattern": "/search?q={query}",
          "method": "GET",
          "resultsContainer": ".search-results .item",
          "titleSelector": ".title",
          "linkSelector": "a.href",
          "thumbnailSelector": "img.src"
        },
        "content": {
          "videoContainer": ".video-player",
          "iframeSelector": "iframe[src]",
          "directVideoSelector": "video source[src]",
          "hlsManifestPattern": "\\.m3u8",
          "mp4Pattern": "\\.mp4"
        },
        "headers": {
          "Referer": "https://example.com",
          "User-Agent": "Mozilla/5.0..."
        }
      }
    }
  ]
}
```

## 🎮 Utilizzo Frontend

1. **Catalogo TMDB**: Cerca film o serie TV usando la barra di ricerca
2. **Gestione Sorgenti**: 
   - Aggiungi manualmente URL di siti streaming
   - Importa liste da file .txt (un URL per riga)
   - Attiva/disattiva o elimina sorgenti
3. **Ricerca Contenuti**: Cerca titoli su tutte le sorgenti abilitate
4. **Riproduzione**: Clicca "Riproduci" per avviare il player video

## ⚙️ Configurazione

### config.json

```json
{
  "tmdb": {
    "apiKey": "LA_TUA_CHIAVE_TMDB",
    "baseUrl": "https://api.themoviedb.org/3",
    "imageBaseUrl": "https://image.tmdb.org/t/p/w500"
  },
  "server": {
    "port": 3000,
    "proxyPort": 3001
  }
}
```

## 📝 Note Importanti

- **API Key TMDB**: È necessario registrarsi su [TMDB](https://www.themoviedb.org/settings/api) per ottenere una chiave API gratuita
- **Legalità**: Assicurati di utilizzare solo sorgenti legittime e di rispettare i diritti d'autore
- **CORS**: Il proxy gestisce automaticamente gli header CORS per permettere la riproduzione cross-origin
- **Performance**: Per produzioni reali, considerare caching e ottimizzazioni aggiuntive

## 🛠️ Tecnologie Utilizzate

- **Backend**: Node.js, Express
- **Parsing HTML**: Cheerio
- **Proxy**: http-proxy-middleware
- **Frontend**: HTML5, CSS3, JavaScript Vanilla
- **Player Video**: hls.js
- **API Esterne**: TMDB API v3

## 📄 Licenza

ISC
