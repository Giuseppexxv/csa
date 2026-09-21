const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./src/config/config.json');
const apiRoutes = require('./src/routes/api');
const hlsProxyMiddleware = require('./src/middleware/hlsProxy');
const sourceManager = require('./src/services/sourceManager');

// Crea due istanze Express: una per l'API e una per il proxy HLS
const app = express();
const proxyApp = express();

const PORT = config.server.port;
const PROXY_PORT = config.server.proxyPort;

/**
 * CONFIGURAZIONE SERVER API PRINCIPALE
 */

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve i file statici del frontend
app.use(express.static(path.join(__dirname, 'public')));

// Monta le rotte API
app.use('/api', apiRoutes);

// Rotta per la pagina principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rotta per il player video
app.get('/player', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player.html'));
});

/**
 * CONFIGURAZIONE SERVER PROXY HLS
 */

// Abilita CORS sul server proxy
proxyApp.use(cors({
  origin: '*',
  methods: ['GET', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Range', 'User-Agent', 'Referer'],
  exposedHeaders: ['Content-Length', 'Content-Range']
}));

// Inizializza i proxy per tutte le sorgenti esistenti
const sources = sourceManager.getAllSources(true);
sources.forEach(source => {
  hlsProxyMiddleware.createProxy(source.id, source);
  console.log(`[Proxy] Initialized proxy for source: ${source.name}`);
});

// Crea il proxy universale
const universalProxy = hlsProxyMiddleware.createUniversalProxy();

// Rotta per proxy specifico per sorgente
proxyApp.use('/proxy/:sourceId/stream', (req, res, next) => {
  const { sourceId } = req.params;
  const proxy = hlsProxyMiddleware.getProxy(sourceId);
  
  if (!proxy) {
    return res.status(404).json({ error: 'Proxy non trovato per questa sorgente' });
  }
  
  // Se l'URL target è specificato nei parametri query, usa il routing dinamico
  if (req.query.url) {
    const targetUrl = decodeURIComponent(req.query.url);
    
    // Configura il proxy dinamicamente per questo URL
    const { createProxyMiddleware } = require('http-proxy-middleware');
    const dynamicProxy = createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
      secure: false,
      followRedirects: true,
      onProxyReq: (proxyReq, req, res) => {
        const source = sourceManager.getSourceById(sourceId);
        const headers = source?.rules?.headers || {};
        
        Object.entries(headers).forEach(([key, value]) => {
          proxyReq.setHeader(key, value);
        });
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, User-Agent');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
      },
      onProxyRes: (proxyRes, req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        const contentType = proxyRes.headers['content-type'];
        if (contentType) {
          res.setHeader('Content-Type', contentType);
        }
      },
      onError: (err, req, res) => {
        console.error('[Dynamic Proxy] Error:', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy Error', message: err.message }));
      }
    });
    
    return dynamicProxy(req, res, next);
  }
  
  next();
});

// Rotta per proxy universale
proxyApp.use('/proxy/universal/stream', (req, res, next) => {
  if (req.query.url) {
    const targetUrl = decodeURIComponent(req.query.url);
    
    const { createProxyMiddleware } = require('http-proxy-middleware');
    const dynamicProxy = createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
      secure: false,
      followRedirects: true,
      onProxyReq: (proxyReq, req, res) => {
        proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        proxyReq.setHeader('Accept', '*/*');
        proxyReq.setHeader('Referer', req.query.referer || '');
        proxyReq.setHeader('Origin', req.query.origin || '');
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, User-Agent, Referer');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
      },
      onProxyRes: (proxyRes, req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        const contentType = proxyRes.headers['content-type'];
        if (contentType) {
          res.setHeader('Content-Type', contentType);
        }
      },
      onError: (err, req, res) => {
        console.error('[Universal Proxy] Error:', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy Error', message: err.message }));
      }
    });
    
    return dynamicProxy(req, res, next);
  }
  
  next();
});

// Health check per il server proxy
proxyApp.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'hls-proxy' });
});

/**
 * AVVIO DEI SERVER
 */

// Avvia il server API principale
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  Media Aggregator & Reader - MVP`);
  console.log(`========================================`);
  console.log(`  Server API attivo su:`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  `);
  console.log(`  Endpoint disponibili:`);
  console.log(`  - Catalogo TMDB: /api/tmdb/search`);
  console.log(`  - Gestione Sorgenti: /api/sources`);
  console.log(`  - Ricerca Contenuti: /api/search/content`);
  console.log(`  - Estrazione Media: /api/media/extract`);
  console.log(`========================================\n`);
});

// Avvia il server proxy HLS
proxyApp.listen(PROXY_PORT, () => {
  console.log(`  Server Proxy HLS attivo su:`);
  console.log(`  http://localhost:${PROXY_PORT}`);
  console.log(`========================================\n`);
});

module.exports = { app, proxyApp };
