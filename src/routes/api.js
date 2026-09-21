const express = require('express');
const tmdbService = require('../services/tmdbService');
const sourceManager = require('../services/sourceManager');
const htmlParserEngine = require('../services/htmlParserEngine');
const hlsProxyMiddleware = require('../middleware/hlsProxy');

const router = express.Router();

/**
 * ROUTE TMDB - Catalogo e Ricerca
 */

/**
 * GET /api/tmdb/search?query=<titolo>&year=<anno>
 * Cerca film o serie TV per titolo
 */
router.get('/tmdb/search', async (req, res) => {
  try {
    const { query, year } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Il parametro "query" è richiesto' });
    }

    const results = await tmdbService.searchMulti(query, year ? parseInt(year) : null);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Search API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tmdb/movie/:id
 * Ottiene i dettagli di un film
 */
router.get('/tmdb/movie/:id', async (req, res) => {
  try {
    const movieId = req.params.id;
    const details = await tmdbService.getMovieDetails(movieId);
    res.json({ success: true, data: details });
  } catch (error) {
    console.error('Movie Details API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tmdb/tv/:id
 * Ottiene i dettagli di una serie TV
 */
router.get('/tmdb/tv/:id', async (req, res) => {
  try {
    const tvId = req.params.id;
    const details = await tmdbService.getTVDetails(tvId);
    res.json({ success: true, data: details });
  } catch (error) {
    console.error('TV Details API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tmdb/tv/:id/seasons
 * Ottiene le stagioni di una serie TV
 */
router.get('/tmdb/tv/:id/seasons', async (req, res) => {
  try {
    const tvId = req.params.id;
    const seasons = await tmdbService.getTVSeasons(tvId);
    res.json({ success: true, data: seasons });
  } catch (error) {
    console.error('TV Seasons API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tmdb/tv/:id/season/:seasonNumber
 * Ottiene gli episodi di una stagione
 */
router.get('/tmdb/tv/:id/season/:seasonNumber', async (req, res) => {
  try {
    const tvId = req.params.id;
    const seasonNumber = req.params.seasonNumber;
    const episodes = await tmdbService.getTVSeasonEpisodes(tvId, parseInt(seasonNumber));
    res.json({ success: true, data: episodes });
  } catch (error) {
    console.error('TV Episodes API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ROUTE GESTIONE SORGENTI
 */

/**
 * GET /api/sources
 * Ottiene tutte le sorgenti
 */
router.get('/sources', (req, res) => {
  try {
    const enabledOnly = req.query.enabled === 'true';
    const sources = sourceManager.getAllSources(enabledOnly);
    res.json({ success: true, data: sources });
  } catch (error) {
    console.error('Get Sources API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/sources/:id
 * Ottiene una sorgente specifica
 */
router.get('/sources/:id', (req, res) => {
  try {
    const source = sourceManager.getSourceById(req.params.id);
    if (!source) {
      return res.status(404).json({ error: 'Sorgente non trovata' });
    }
    res.json({ success: true, data: source });
  } catch (error) {
    console.error('Get Source API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sources
 * Aggiunge una nuova sorgente
 */
router.post('/sources', (req, res) => {
  try {
    const { name, baseUrl, rules } = req.body;
    
    if (!baseUrl) {
      return res.status(400).json({ error: 'Il campo "baseUrl" è richiesto' });
    }

    const newSource = sourceManager.addSource({ name, baseUrl, rules });
    res.status(201).json({ success: true, data: newSource });
  } catch (error) {
    console.error('Add Source API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/sources/:id
 * Aggiorna una sorgente esistente
 */
router.put('/sources/:id', (req, res) => {
  try {
    const updates = req.body;
    const updatedSource = sourceManager.updateSource(req.params.id, updates);
    
    if (!updatedSource) {
      return res.status(404).json({ error: 'Sorgente non trovata' });
    }
    
    res.json({ success: true, data: updatedSource });
  } catch (error) {
    console.error('Update Source API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/sources/:id
 * Rimuove una sorgente
 */
router.delete('/sources/:id', (req, res) => {
  try {
    const removed = sourceManager.removeSource(req.params.id);
    
    if (!removed) {
      return res.status(404).json({ error: 'Sorgente non trovata' });
    }
    
    res.json({ success: true, message: 'Sorgente rimossa con successo' });
  } catch (error) {
    console.error('Delete Source API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sources/import/txt
 * Importa sorgenti da un file di testo
 */
router.post('/sources/import/txt', (req, res) => {
  try {
    const { filePath, urls } = req.body;
    
    let importedSources;
    
    if (filePath) {
      importedSources = sourceManager.importFromTxtFile(filePath);
    } else if (urls && Array.isArray(urls)) {
      importedSources = sourceManager.importFromUrlList(urls);
    } else {
      return res.status(400).json({ error: 'Fornire "filePath" o "urls"' });
    }
    
    res.json({ 
      success: true, 
      message: `${importedSources.length} sorgenti importate`,
      data: importedSources 
    });
  } catch (error) {
    console.error('Import Sources API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sources/export/json
 * Esporta le sorgenti in un file JSON
 */
router.post('/sources/export/json', (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'Il campo "filePath" è richiesto' });
    }
    
    const exported = sourceManager.exportToJsonFile(filePath);
    
    if (!exported) {
      return res.status(500).json({ error: 'Errore durante l\'esportazione' });
    }
    
    res.json({ success: true, message: 'Esportazione completata con successo' });
  } catch (error) {
    console.error('Export Sources API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ROUTE RICERCA E ESTRAZIONE MEDIA
 */

/**
 * POST /api/search/content
 * Cerca contenuti su tutte le sorgenti abilitate
 */
router.post('/search/content', async (req, res) => {
  try {
    const { query, sourceIds } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Il parametro "query" è richiesto' });
    }

    // Ottieni le sorgenti da usare
    let sources;
    if (sourceIds && sourceIds.length > 0) {
      sources = sourceIds.map(id => sourceManager.getSourceById(id)).filter(Boolean);
    } else {
      sources = sourceManager.getAllSources(true);
    }

    if (sources.length === 0) {
      return res.json({ success: true, data: [], message: 'Nessuna sorgente disponibile' });
    }

    // Esegue ricerche parallele su tutte le sorgenti
    const searchPromises = sources.map(source => 
      htmlParserEngine.search(query, source)
        .then(results => ({ sourceId: source.id, sourceName: source.name, results }))
        .catch(error => ({ sourceId: source.id, sourceName: source.name, error: error.message }))
    );

    const allResults = await Promise.all(searchPromises);
    
    // Combina tutti i risultati
    const combinedResults = allResults.flatMap(result => {
      if (result.error) {
        console.warn(`Search failed for ${result.sourceName}:`, result.error);
        return [];
      }
      return result.results;
    });

    res.json({ success: true, data: combinedResults });
  } catch (error) {
    console.error('Content Search API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/media/extract
 * Estrae URL di streaming da una pagina
 */
router.post('/media/extract', async (req, res) => {
  try {
    const { url, sourceId } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'Il parametro "url" è richiesto' });
    }

    const source = sourceManager.getSourceById(sourceId);
    if (!source) {
      return res.status(404).json({ error: 'Sorgente non trovata' });
    }

    const mediaUrls = await htmlParserEngine.extractMediaUrls(url, source);
    
    // Genera URL proxy per ogni stream trovato
    const proxiedStreams = {
      hls: mediaUrls.hls.map(hlsUrl => ({
        original: hlsUrl,
        proxy: hlsProxyMiddleware.generateProxyUrl(hlsUrl, sourceId)
      })),
      mp4: mediaUrls.mp4.map(mp4Url => ({
        original: mp4Url,
        proxy: hlsProxyMiddleware.generateProxyUrl(mp4Url, sourceId)
      })),
      embeds: mediaUrls.embeds
    };

    res.json({ 
      success: true, 
      data: {
        streams: proxiedStreams,
        count: {
          hls: proxiedStreams.hls.length,
          mp4: proxiedStreams.mp4.length,
          embeds: proxiedStreams.embeds.length
        }
      } 
    });
  } catch (error) {
    console.error('Media Extraction API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
