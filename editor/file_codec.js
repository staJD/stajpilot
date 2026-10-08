(function (root) {
  'use strict';

  const HEADER = 'STAJPLT1\n';
  const MAX_FILE_SIZE = 2_000_000;
  const MAX_DOCUMENT_SIZE = 2_000_000;
  const compression = typeof module !== 'undefined' && module.exports
    ? require('./vendor/pako.umd.min.js') : root.pako;

  function bytesToBase64(bytes) {
    let binary = '';
    for (let index = 0; index < bytes.length; index += 8192) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
    }
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  function encode(document) {
    const bytes = new TextEncoder().encode(JSON.stringify(document));
    if (bytes.length > MAX_DOCUMENT_SIZE) {
      throw new Error('The Song library is too large.');
    }
    const compressed = compression.gzip(bytes);
    const encoded = HEADER + bytesToBase64(compressed);
    if (encoded.length > MAX_FILE_SIZE) {
      throw new Error('The Song file is too large.');
    }
    return encoded;
  }

  function decode(text) {
    if (!text.startsWith(HEADER)) {
      throw new Error('This is not a valid StajPilot Song file.');
    }
    if (text.length > MAX_FILE_SIZE) {
      throw new Error('The Song file is too large.');
    }
    try {
      const compressed = base64ToBytes(text.slice(HEADER.length).trim());
      const bytes = compression.ungzip(compressed);
      if (bytes.length > MAX_DOCUMENT_SIZE) {
        throw new Error('The Song file is too large.');
      }
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch (error) {
      if (error.message === 'The Song file is too large.') throw error;
      throw new Error('This is not a valid StajPilot Song file.');
    }
  }

  const api = { HEADER, encode, decode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StajPilotSongFile = api;
})(typeof window !== 'undefined' ? window : globalThis);
