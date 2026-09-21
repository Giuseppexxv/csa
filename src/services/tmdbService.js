const axios = require('axios');
const config = require('./config.json');

/**
 * TMDB Service - Gestisce le chiamate all'API v3 di The Movie Database
 */
class TMDBService {
  constructor() {
    this.apiKey = config.tmdb.apiKey;
    this.baseUrl = config.tmdb.baseUrl;
    this.imageBaseUrl = config.tmdb.imageBaseUrl;
  }

  /**
   * Cerca film o serie TV per titolo
   * @param {string} query - Titolo da cercare
   * @param {number} year - Anno opzionale per filtrare i risultati
   * @returns {Promise<Array>} Lista di risultati
   */
  async searchMulti(query, year = null) {
    try {
      const params = {
        api_key: this.apiKey,
        language: 'it-IT',
        query: encodeURIComponent(query),
        page: 1,
        include_adult: false
      };

      if (year) {
        params.year = year;
      }

      const response = await axios.get(`${this.baseUrl}/search/multi`, { params });
      
      return response.data.results
        .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
        .map(item => this._normalizeResult(item));
    } catch (error) {
      console.error('TMDB Search Error:', error.message);
      throw new Error(`Errore nella ricerca TMDB: ${error.message}`);
    }
  }

  /**
   * Ottiene i dettagli di un film
   * @param {number} movieId - ID del film
   * @returns {Promise<Object>} Dettagli del film
   */
  async getMovieDetails(movieId) {
    try {
      const params = {
        api_key: this.apiKey,
        language: 'it-IT',
        append_to_response: 'videos,images,credits'
      };

      const response = await axios.get(`${this.baseUrl}/movie/${movieId}`, { params });
      return this._normalizeResult(response.data, 'movie');
    } catch (error) {
      console.error('TMDB Movie Details Error:', error.message);
      throw new Error(`Errore nel recupero dettagli film: ${error.message}`);
    }
  }

  /**
   * Ottiene i dettagli di una serie TV
   * @param {number} tvId - ID della serie TV
   * @returns {Promise<Object>} Dettagli della serie TV
   */
  async getTVDetails(tvId) {
    try {
      const params = {
        api_key: this.apiKey,
        language: 'it-IT',
        append_to_response: 'videos,images,credits'
      };

      const response = await axios.get(`${this.baseUrl}/tv/${tvId}`, { params });
      return this._normalizeResult(response.data, 'tv');
    } catch (error) {
      console.error('TMDB TV Details Error:', error.message);
      throw new Error(`Errore nel recupero dettagli serie TV: ${error.message}`);
    }
  }

  /**
   * Ottiene le stagioni di una serie TV
   * @param {number} tvId - ID della serie TV
   * @returns {Promise<Array>} Lista delle stagioni
   */
  async getTVSeasons(tvId) {
    try {
      const details = await this.getTVDetails(tvId);
      return details.seasons || [];
    } catch (error) {
      console.error('TMDB Seasons Error:', error.message);
      throw new Error(`Errore nel recupero stagioni: ${error.message}`);
    }
  }

  /**
   * Ottiene gli episodi di una stagione
   * @param {number} tvId - ID della serie TV
   * @param {number} seasonNumber - Numero della stagione
   * @returns {Promise<Array>} Lista degli episodi
   */
  async getTVSeasonEpisodes(tvId, seasonNumber) {
    try {
      const params = {
        api_key: this.apiKey,
        language: 'it-IT'
      };

      const response = await axios.get(
        `${this.baseUrl}/tv/${tvId}/season/${seasonNumber}`,
        { params }
      );

      return response.data.episodes.map(episode => ({
        id: episode.id,
        episodeNumber: episode.episode_number,
        name: episode.name,
        overview: episode.overview,
        stillPath: episode.still_path ? `${this.imageBaseUrl}${episode.still_path}` : null,
        airDate: episode.air_date,
        runtime: episode.runtime
      }));
    } catch (error) {
      console.error('TMDB Episodes Error:', error.message);
      throw new Error(`Errore nel recupero episodi: ${error.message}`);
    }
  }

  /**
   * Normalizza i risultati TMDB in un formato coerente
   * @private
   */
  _normalizeResult(item, type = null) {
    const mediaType = type || item.media_type;
    
    return {
      id: item.id,
      mediaType: mediaType,
      title: item.title || item.name,
      originalTitle: item.original_title || item.original_name,
      overview: item.overview,
      posterPath: item.poster_path ? `${this.imageBaseUrl}${item.poster_path}` : null,
      backdropPath: item.backdrop_path ? `${this.imageBaseUrl}${item.backdrop_path}` : null,
      releaseDate: item.release_date || item.first_air_date,
      voteAverage: item.vote_average,
      voteCount: item.vote_count,
      genres: item.genres || [],
      seasons: mediaType === 'tv' ? item.seasons : null,
      numberOfSeasons: item.number_of_seasons || null,
      numberOfEpisodes: item.number_of_episodes || null
    };
  }
}

module.exports = new TMDBService();
