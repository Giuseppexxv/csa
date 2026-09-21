const axios = require('axios');
const cheerio = require('cheerio');

/**
 * HTMLParserEngine - Motore generico di parsing HTML/DOM
 * Utilizza Cheerio per navigare e estrarre dati da pagine web secondo regole configurabili
 */
class HTMLParserEngine {
  constructor() {
    this.defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    };
  }

  /**
   * Esegue una ricerca su una sorgente utilizzando le regole configurate
   * @param {string} query - Titolo da cercare
   * @param {Object} source - Configurazione della sorgente
   * @returns {Promise<Array>} Lista dei risultati trovati
   */
  async search(query, source) {
    try {
      const rules = source.rules.search;
      if (!rules) {
        throw new Error('Regole di ricerca non configurate per questa sorgente');
      }

      // Costruisce l'URL di ricerca sostituendo il placeholder {query}
      const searchUrl = rules.urlPattern.replace('{query}', encodeURIComponent(query));
      const fullUrl = source.baseUrl + searchUrl;

      // Esegue la richiesta HTTP
      const headers = { ...this.defaultHeaders, ...(source.rules.headers || {}) };
      const response = await axios.get(fullUrl, { 
        headers,
        maxRedirects: 5,
        timeout: 10000
      });

      // Parse dell'HTML con Cheerio
      const $ = cheerio.load(response.data);

      // Estrae i risultati usando i selettori configurati
      const results = [];
      $(rules.resultsContainer).each((index, element) => {
        const title = $(element).find(rules.titleSelector).first().text().trim();
        const link = $(element).find(rules.linkSelector).first().attr('href');
        const thumbnail = $(element).find(rules.thumbnailSelector).first().attr('src');

        if (title && link) {
          // Risolve URL relativi in assoluti
          const absoluteLink = this._resolveUrl(link, source.baseUrl);
          const absoluteThumbnail = thumbnail ? this._resolveUrl(thumbnail, source.baseUrl) : null;

          results.push({
            title,
            link: absoluteLink,
            thumbnail: absoluteThumbnail,
            sourceId: source.id,
            sourceName: source.name
          });
        }
      });

      return results;
    } catch (error) {
      console.error(`Search error on ${source.name}:`, error.message);
      throw new Error(`Errore nella ricerca su ${source.name}: ${error.message}`);
    }
  }

  /**
   * Analizza una pagina di contenuto per estrarre URL di streaming
   * @param {string} url - URL della pagina da analizzare
   * @param {Object} source - Configurazione della sorgente
   * @returns {Promise<Object>} Oggetto con URL dei media trovati
   */
  async extractMediaUrls(url, source) {
    try {
      const rules = source.rules.content;
      if (!rules) {
        throw new Error('Regole di contenuto non configurate per questa sorgente');
      }

      // Esegue la richiesta HTTP
      const headers = { ...this.defaultHeaders, ...(source.rules.headers || {}) };
      const response = await axios.get(url, { 
        headers,
        maxRedirects: 5,
        timeout: 10000
      });

      // Parse dell'HTML con Cheerio
      const $ = cheerio.load(response.data);

      const mediaUrls = {
        hls: [],
        mp4: [],
        embeds: [],
        rawHtml: response.data
      };

      // Cerca iframe embedded
      if (rules.iframeSelector) {
        $(rules.iframeSelector).each((index, element) => {
          const src = $(element).attr('src');
          if (src) {
            mediaUrls.embeds.push(this._resolveUrl(src, url));
          }
        });
      }

      // Cerca tag video diretti
      if (rules.directVideoSelector) {
        $(rules.directVideoSelector).each((index, element) => {
          const src = $(element).attr('src');
          if (src) {
            const resolvedSrc = this._resolveUrl(src, url);
            if (resolvedSrc.match(/\.m3u8(\?.*)?$/i)) {
              mediaUrls.hls.push(resolvedSrc);
            } else if (resolvedSrc.match(/\.mp4(\?.*)?$/i)) {
              mediaUrls.mp4.push(resolvedSrc);
            }
          }
        });
      }

      // Cerca pattern HLS (.m3u8) nell'intero HTML
      if (rules.hlsManifestPattern) {
        const hlsPattern = new RegExp(rules.hlsManifestPattern, 'gi');
        const hlsMatches = response.data.match(hlsPattern);
        if (hlsMatches) {
          hlsMatches.forEach(match => {
            // Rimuove eventuali caratteri di escape o quote
            const cleanMatch = match.replace(/['"]/g, '').trim();
            if (cleanMatch.startsWith('http')) {
              mediaUrls.hls.push(cleanMatch);
            } else {
              mediaUrls.hls.push(this._resolveUrl(cleanMatch, url));
            }
          });
        }
      }

      // Cerca pattern MP4 nell'intero HTML
      if (rules.mp4Pattern) {
        const mp4Pattern = new RegExp(rules.mp4Pattern, 'gi');
        const mp4Matches = response.data.match(mp4Pattern);
        if (mp4Matches) {
          mp4Matches.forEach(match => {
            const cleanMatch = match.replace(/['"]/g, '').trim();
            if (cleanMatch.startsWith('http')) {
              mediaUrls.mp4.push(cleanMatch);
            } else {
              mediaUrls.mp4.push(this._resolveUrl(cleanMatch, url));
            }
          });
        }
      }

      // Cerca script che potrebbero contenere URL di streaming
      $('script').each((index, element) => {
        const scriptContent = $(element).html();
        if (scriptContent) {
          // Pattern per URL m3u8
          const m3u8Regex = /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/gi;
          const m3u8Matches = scriptContent.match(m3u8Regex);
          if (m3u8Matches) {
            mediaUrls.hls.push(...m3u8Matches);
          }

          // Pattern per URL mp4
          const mp4Regex = /https?:\/\/[^"'\s]+\.mp4[^"'\s]*/gi;
          const mp4Matches = scriptContent.match(mp4Regex);
          if (mp4Matches) {
            mediaUrls.mp4.push(...mp4Matches);
          }
        }
      });

      // Rimuovi duplicati
      mediaUrls.hls = [...new Set(mediaUrls.hls)];
      mediaUrls.mp4 = [...new Set(mediaUrls.mp4)];
      mediaUrls.embeds = [...new Set(mediaUrls.embeds)];

      return mediaUrls;
    } catch (error) {
      console.error(`Media extraction error on ${source.name}:`, error.message);
      throw new Error(`Errore nell'estrazione media da ${source.name}: ${error.message}`);
    }
  }

  /**
   * Analizza una pagina di dettaglio per estrarre informazioni aggiuntive
   * @param {string} url - URL della pagina da analizzare
   * @param {Object} source - Configurazione della sorgente
   * @returns {Promise<Object>} Informazioni estratte
   */
  async extractDetails(url, source) {
    try {
      const rules = source.rules.details || {};
      
      const headers = { ...this.defaultHeaders, ...(source.rules.headers || {}) };
      const response = await axios.get(url, { headers, timeout: 10000 });
      const $ = cheerio.load(response.data);

      const details = {
        title: null,
        description: null,
        year: null,
        rating: null,
        genres: [],
        cast: []
      };

      if (rules.titleSelector) {
        details.title = $(rules.titleSelector).first().text().trim();
      }

      if (rules.descriptionSelector) {
        details.description = $(rules.descriptionSelector).first().text().trim();
      }

      if (rules.yearSelector) {
        details.year = $(rules.yearSelector).first().text().trim();
      }

      if (rules.ratingSelector) {
        details.rating = $(rules.ratingSelector).first().text().trim();
      }

      if (rules.genreSelector) {
        $(rules.genreSelector).each((index, element) => {
          const genre = $(element).text().trim();
          if (genre) {
            details.genres.push(genre);
          }
        });
      }

      if (rules.castSelector) {
        $(rules.castSelector).each((index, element) => {
          const actor = $(element).text().trim();
          if (actor) {
            details.cast.push(actor);
          }
        });
      }

      return details;
    } catch (error) {
      console.error(`Details extraction error:`, error.message);
      return null;
    }
  }

  /**
   * Risolve un URL relativo in assoluto
   * @private
   */
  _resolveUrl(url, baseUrl) {
    if (!url) return null;
    
    try {
      // Se è già un URL assoluto, lo restituisce così com'è
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }

      // Altrimenti, lo risolve rispetto al baseUrl
      const base = new URL(baseUrl);
      const resolved = new URL(url, base);
      return resolved.toString();
    } catch (error) {
      console.warn('Error resolving URL:', url, error.message);
      return url;
    }
  }
}

module.exports = new HTMLParserEngine();
