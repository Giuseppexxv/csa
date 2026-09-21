const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * SourceManager - Gestisce le sorgenti web definite dall'utente
 * Persiste i dati in localStorage (frontend) o file JSON (backend)
 */
class SourceManager {
  constructor(dataFilePath = null) {
    this.dataFilePath = dataFilePath || path.join(__dirname, '../../data/sources.json');
    this.sources = [];
    this.loadSources();
  }

  /**
   * Carica le sorgenti dal file di persistenza
   */
  loadSources() {
    try {
      if (fs.existsSync(this.dataFilePath)) {
        const data = fs.readFileSync(this.dataFilePath, 'utf8');
        this.sources = JSON.parse(data);
      } else {
        this.sources = [];
      }
    } catch (error) {
      console.error('Error loading sources:', error.message);
      this.sources = [];
    }
  }

  /**
   * Salva le sorgenti nel file di persistenza
   */
  saveSources() {
    try {
      const dir = path.dirname(this.dataFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dataFilePath, JSON.stringify(this.sources, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('Error saving sources:', error.message);
      return false;
    }
  }

  /**
   * Aggiunge una nuova sorgente
   * @param {Object} source - Oggetto sorgente
   * @returns {Object} La sorgente aggiunta con ID
   */
  addSource(source) {
    const newSource = {
      id: `source-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: source.name || 'Sorgente Personalizzata',
      baseUrl: source.baseUrl,
      enabled: source.enabled !== undefined ? source.enabled : true,
      rules: source.rules || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.sources.push(newSource);
    this.saveSources();
    return newSource;
  }

  /**
   * Aggiorna una sorgente esistente
   * @param {string} sourceId - ID della sorgente
   * @param {Object} updates - Campi da aggiornare
   * @returns {Object|null} La sorgente aggiornata o null se non trovata
   */
  updateSource(sourceId, updates) {
    const index = this.sources.findIndex(s => s.id === sourceId);
    if (index === -1) {
      return null;
    }

    this.sources[index] = {
      ...this.sources[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.saveSources();
    return this.sources[index];
  }

  /**
   * Rimuove una sorgente
   * @param {string} sourceId - ID della sorgente
   * @returns {boolean} True se rimossa, false se non trovata
   */
  removeSource(sourceId) {
    const index = this.sources.findIndex(s => s.id === sourceId);
    if (index === -1) {
      return false;
    }

    this.sources.splice(index, 1);
    this.saveSources();
    return true;
  }

  /**
   * Ottiene tutte le sorgenti
   * @param {boolean} enabledOnly - Se true, restituisce solo le sorgenti abilitate
   * @returns {Array} Lista delle sorgenti
   */
  getAllSources(enabledOnly = false) {
    if (enabledOnly) {
      return this.sources.filter(s => s.enabled);
    }
    return this.sources;
  }

  /**
   * Ottiene una sorgente per ID
   * @param {string} sourceId - ID della sorgente
   * @returns {Object|null} La sorgente o null se non trovata
   */
  getSourceById(sourceId) {
    return this.sources.find(s => s.id === sourceId) || null;
  }

  /**
   * Importa sorgenti da un file di testo (.txt)
   * Ogni riga deve contenere un URL base
   * @param {string} filePath - Percorso del file .txt
   * @returns {Array} Lista delle sorgenti importate
   */
  importFromTxtFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const urls = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && this._isValidUrl(line));

      const importedSources = urls.map(url => 
        this.addSource({
          name: new URL(url).hostname,
          baseUrl: url
        })
      );

      return importedSources;
    } catch (error) {
      console.error('Error importing from TXT file:', error.message);
      throw new Error(`Errore nell'importazione: ${error.message}`);
    }
  }

  /**
   * Importa sorgenti da un array di URL
   * @param {Array<string>} urls - Lista di URL base
   * @returns {Array} Lista delle sorgenti importate
   */
  importFromUrlList(urls) {
    const validUrls = urls.filter(url => this._isValidUrl(url));
    
    const importedSources = validUrls.map(url => 
      this.addSource({
        name: new URL(url).hostname,
        baseUrl: url
      })
    );

    return importedSources;
  }

  /**
   * Esporta le sorgenti in un file JSON
   * @param {string} filePath - Percorso del file di esportazione
   * @returns {boolean} True se esportato con successo
   */
  exportToJsonFile(filePath) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(this.sources, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('Error exporting to JSON file:', error.message);
      return false;
    }
  }

  /**
   * Valida un URL
   * @private
   */
  _isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }
}

module.exports = SourceManager;
