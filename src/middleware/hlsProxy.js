const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * HLSProxyMiddleware - Reverse Proxy per streaming HLS
 * Gestisce il forwarding di file .m3u8 e segmenti .ts con header corretti
 */
class HLSProxyMiddleware {
  constructor() {
    this.proxies = new Map();
  }

  /**
   * Crea un proxy per una specifica sorgente
   * @param {string} sourceId - ID della sorgente
   * @param {Object} sourceConfig - Configurazione della sorgente (inclusi headers)
   * @returns {Function} Middleware Express
   */
  createProxy(sourceId, sourceConfig) {
    const headers = sourceConfig.rules?.headers || {};
    
    const defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Origin': sourceConfig.baseUrl,
      'Referer': sourceConfig.baseUrl
    };

    const mergedHeaders = { ...defaultHeaders, ...headers };

    // Configura il proxy middleware
    const proxyMiddleware = createProxyMiddleware({
      target: sourceConfig.baseUrl,
      changeOrigin: true,
      secure: false,
      followRedirects: true,
      maxSockets: 100,
      
      // Configura gli header per ogni richiesta
      onProxyReq: (proxyReq, req, res) => {
        // Imposta gli header personalizzati
        Object.entries(mergedHeaders).forEach(([key, value]) => {
          proxyReq.setHeader(key, value);
        });

        // Imposta header CORS per permettere l'accesso dal client
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, User-Agent');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');

        // Log per debug
        console.log(`[Proxy] ${req.method} ${req.url} -> ${sourceConfig.baseUrl}`);
      },

      // Gestisci la risposta
      onProxyRes: (proxyRes, req, res) => {
        // Imposta header CORS nella risposta
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Mantiene i content-type originali
        const contentType = proxyRes.headers['content-type'];
        if (contentType) {
          res.setHeader('Content-Type', contentType);
        }

        // Abilita range requests per seek nel video
        if (proxyRes.headers['content-range']) {
          res.setHeader('Content-Range', proxyRes.headers['content-range']);
        }
        if (proxyRes.headers['accept-ranges']) {
          res.setHeader('Accept-Ranges', proxyRes.headers['accept-ranges']);
        }

        // Log per debug
        console.log(`[Proxy] Response status: ${proxyRes.statusCode}`);
      },

      // Gestisci errori
      onError: (err, req, res) => {
        console.error('[Proxy] Error:', err.message);
        res.writeHead(502, { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ 
          error: 'Proxy Error', 
          message: err.message 
        }));
      }
    });

    this.proxies.set(sourceId, proxyMiddleware);
    return proxyMiddleware;
  }

  /**
   * Ottiene il proxy per una sorgente
   * @param {string} sourceId - ID della sorgente
   * @returns {Function|null} Il middleware proxy o null se non trovato
   */
  getProxy(sourceId) {
    return this.proxies.get(sourceId) || null;
  }

  /**
   * Rimuove un proxy
   * @param {string} sourceId - ID della sorgente
   * @returns {boolean} True se rimosso, false se non trovato
   */
  removeProxy(sourceId) {
    return this.proxies.delete(sourceId);
  }

  /**
   * Crea un proxy universale che estrae l'URL target dai parametri
   * Utile per proxyare qualsiasi URL senza configurazione preventiva
   * @returns {Function} Middleware Express
   */
  createUniversalProxy() {
    return createProxyMiddleware({
      router: async (req) => {
        // Estrae l'URL target dai parametri della query o dal path
        const targetUrl = req.query.target || req.params[0];
        if (!targetUrl) {
          throw new Error('Target URL not specified');
        }

        // Validazione base dell'URL
        try {
          new URL(targetUrl);
        } catch (error) {
          throw new Error('Invalid target URL');
        }

        console.log(`[Universal Proxy] Routing to: ${targetUrl}`);
        return targetUrl;
      },
      changeOrigin: true,
      secure: false,
      followRedirects: true,
      maxSockets: 100,

      onProxyReq: (proxyReq, req, res) => {
        // Imposta header standard
        proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        proxyReq.setHeader('Accept', '*/*');
        proxyReq.setHeader('Accept-Language', 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7');
        proxyReq.setHeader('Referer', req.query.referer || '');
        proxyReq.setHeader('Origin', req.query.origin || '');

        // Header CORS
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

        if (proxyRes.headers['content-range']) {
          res.setHeader('Content-Range', proxyRes.headers['content-range']);
        }
        if (proxyRes.headers['accept-ranges']) {
          res.setHeader('Accept-Ranges', proxyRes.headers['accept-ranges']);
        }
      },

      onError: (err, req, res) => {
        console.error('[Universal Proxy] Error:', err.message);
        res.writeHead(502, { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ 
          error: 'Proxy Error', 
          message: err.message 
        }));
      }
    });
  }

  /**
   * Genera un URL proxy per un dato URL di streaming
   * @param {string} streamUrl - URL originale dello stream
   * @param {string} sourceId - ID della sorgente (opzionale)
   * @param {number} port - Porta del server proxy
   * @returns {string} URL proxy da usare nel player
   */
  generateProxyUrl(streamUrl, sourceId = null, port = 3001) {
    const encodedUrl = encodeURIComponent(streamUrl);
    
    if (sourceId) {
      // Usa il proxy specifico per la sorgente
      return `http://localhost:${port}/proxy/${sourceId}/stream?url=${encodedUrl}`;
    } else {
      // Usa il proxy universale
      return `http://localhost:${port}/proxy/universal/stream?url=${encodedUrl}`;
    }
  }
}

module.exports = new HLSProxyMiddleware();
