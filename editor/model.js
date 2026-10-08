(function (root) {
  'use strict';

  const FORMAT = 'stajpilot-songs';
  const VERSION = 1;
  const BANK_COUNT = 125;
  const SLOT_COUNT = 5;
  const SLOT_NAME_LIMIT = 25;
  const SLOT_SUBNAME_LIMIT = 13;
  const segmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

  function graphemes(value) {
    return segmenter
      ? Array.from(segmenter.segment(value), (entry) => entry.segment)
      : Array.from(value);
  }

  function graphemeLength(value) {
    return graphemes(value).length;
  }

  function truncateGraphemes(value, limit) {
    return graphemes(value).slice(0, limit).join('');
  }

  function emptyBanks() {
    return Array(BANK_COUNT).fill(null);
  }

  function emptySong(bank) {
    return {
      bank,
      songName: '',
      slots: Array.from({ length: SLOT_COUNT }, () => ({
        name: '', subName: '', ampImage: 1,
      })),
    };
  }

  function isPopulated(song) {
    return Boolean(song && (
      song.songName.trim() ||
      song.slots.some((slot) => slot.name.trim() || slot.subName.trim())
    ));
  }

  function normalizeSong(value, { allowLong = false } = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Every song must be an object.');
    }
    if (!Number.isInteger(value.bank) || value.bank < 1 || value.bank > BANK_COUNT) {
      throw new Error(`Bank must be between 1 and ${BANK_COUNT}.`);
    }
    if (typeof value.songName !== 'string') {
      throw new Error(`Bank ${value.bank}: songName must be text.`);
    }
    if (!Array.isArray(value.slots) || value.slots.length !== SLOT_COUNT) {
      throw new Error(`Bank ${value.bank}: exactly five slots are required.`);
    }
    const slots = value.slots.map((slot, index) => {
      if (!slot || typeof slot !== 'object' || Array.isArray(slot) ||
          typeof slot.name !== 'string' || typeof slot.subName !== 'string') {
        throw new Error(`Bank ${value.bank}, slot ${index + 1}: invalid name.`);
      }
      if (!allowLong && graphemeLength(slot.name) > SLOT_NAME_LIMIT) {
        throw new Error(`Bank ${value.bank}, slot ${index + 1}: name exceeds ${SLOT_NAME_LIMIT} characters.`);
      }
      if (!allowLong && graphemeLength(slot.subName) > SLOT_SUBNAME_LIMIT) {
        throw new Error(`Bank ${value.bank}, slot ${index + 1}: sub name exceeds ${SLOT_SUBNAME_LIMIT} characters.`);
      }
      const ampImage = slot.ampImage === undefined ? 1 : slot.ampImage;
      if (!Number.isInteger(ampImage) || ampImage < 1 || ampImage > 100) {
        throw new Error(`Bank ${value.bank}, slot ${index + 1}: amp image must be 1-100.`);
      }
      return { name: slot.name, subName: slot.subName, ampImage };
    });
    return { bank: value.bank, songName: value.songName, slots };
  }

  function parseDocument(input, { allowLong = false } = {}) {
    let songs;
    if (Array.isArray(input)) {
      songs = input;
    } else if (input && typeof input === 'object' && !Array.isArray(input)) {
      if (input.format !== undefined && input.format !== FORMAT) {
        throw new Error('This is not a StajPilot song file.');
      }
      if (input.format === FORMAT && input.version !== VERSION) {
        throw new Error('This song file version is not supported.');
      }
      songs = input.songs;
    }
    if (!Array.isArray(songs) || songs.length > BANK_COUNT) {
      throw new Error('The file must contain up to 125 songs.');
    }
    const banks = emptyBanks();
    const seen = new Set();
    for (const entry of songs) {
      const song = normalizeSong(entry, { allowLong });
      if (seen.has(song.bank)) {
        throw new Error(`Bank ${song.bank} appears more than once.`);
      }
      seen.add(song.bank);
      if (isPopulated(song)) banks[song.bank - 1] = song;
    }
    return banks;
  }

  function parseImageAssignments(value, kind) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${kind} image assignments are invalid.`);
    }
    return Object.fromEntries(Object.entries(value).map(([key, image]) => {
      const position = Number(key);
      if ((kind === 'Slot' && (!/^\d+$/.test(key) ||
          !Number.isInteger(position) || position < 1 || position > 625)) ||
          (kind === 'Rig' && !key.trim()) ||
          !Number.isInteger(image) || image < 1 || image > 100) {
        throw new Error(`A ${kind.toLowerCase()} image assignment is invalid.`);
      }
      return [kind === 'Slot' ? String(position) : key, image];
    }));
  }

  function parseLibrary(input, options = {}) {
    const banks = parseDocument(input, options);
    const document = input && !Array.isArray(input) ? input : {};
    return {
      banks,
      slotAmpImages: Object.prototype.hasOwnProperty.call(document, 'slotAmpImages')
        ? parseImageAssignments(document.slotAmpImages, 'Slot') : null,
      rigAmpImages: Object.prototype.hasOwnProperty.call(document, 'rigAmpImages')
        ? parseImageAssignments(document.rigAmpImages, 'Rig') : null,
    };
  }

  function exportDocument(banks) {
    if (!Array.isArray(banks) || banks.length !== BANK_COUNT) {
      throw new Error('The bank list is incomplete.');
    }
    return {
      format: FORMAT,
      version: VERSION,
      songs: banks.flatMap((song, index) => {
        if (!song || !isPopulated(song)) return [];
        return [normalizeSong({ ...song, bank: index + 1 }, { allowLong: true })];
      }),
    };
  }

  function exportLibrary({ banks, slotAmpImages = null, rigAmpImages = null }) {
    const document = exportDocument(banks);
    if (slotAmpImages !== null) {
      document.slotAmpImages = Object.fromEntries(
        Object.entries(parseImageAssignments(slotAmpImages, 'Slot'))
          .sort(([a], [b]) => Number(a) - Number(b))
      );
    }
    if (rigAmpImages !== null) {
      document.rigAmpImages = Object.fromEntries(
        Object.entries(parseImageAssignments(rigAmpImages, 'Rig'))
          .sort(([a], [b]) => a.localeCompare(b))
      );
    }
    return document;
  }

  function slotPosition(bank, slotIndex) {
    if (!Number.isInteger(bank) || bank < 1 || bank > BANK_COUNT ||
        !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= SLOT_COUNT) {
      throw new Error('Invalid bank or slot.');
    }
    return (bank - 1) * SLOT_COUNT + slotIndex + 1;
  }

  function moveSlotImages(images, from, to) {
    if (![from, to].every((bank) => Number.isInteger(bank) && bank >= 1 && bank <= BANK_COUNT)) {
      throw new Error('Invalid bank number.');
    }
    if (images === null) return null;
    const groups = Array.from({ length: BANK_COUNT }, (_, index) =>
      Array.from({ length: SLOT_COUNT }, (_, slot) =>
        images[slotPosition(index + 1, slot)] || 0));
    groups.splice(to - 1, 0, groups.splice(from - 1, 1)[0]);
    return Object.fromEntries(groups.flatMap((group, bank) =>
      group.flatMap((image, slot) => image
        ? [[String(slotPosition(bank + 1, slot)), image]] : [])));
  }

  function copySlotImages(images, from, to) {
    if (images === null) return null;
    const result = { ...images };
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const source = images[slotPosition(from, slot)];
      const destination = slotPosition(to, slot);
      if (source) result[destination] = source;
      else delete result[destination];
    }
    return result;
  }

  function clearSlotImages(images, bank) {
    if (images === null) return null;
    const result = { ...images };
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      delete result[slotPosition(bank, slot)];
    }
    return result;
  }

  function firstLengthError(banks) {
    for (const song of banks) {
      if (!song) continue;
      try {
        normalizeSong(song);
      } catch (error) {
        return error.message;
      }
    }
    return null;
  }

  function moveBank(banks, from, to) {
    if (![from, to].every((bank) => Number.isInteger(bank) && bank >= 1 && bank <= BANK_COUNT)) {
      throw new Error('Invalid bank number.');
    }
    if (!banks[from - 1]) throw new Error('The source bank is empty.');
    const moved = banks.map((song) => song && normalizeSong(song, { allowLong: true }));
    moved.splice(to - 1, 0, moved.splice(from - 1, 1)[0]);
    moved.forEach((song, index) => { if (song) song.bank = index + 1; });
    return moved;
  }

  const api = {
    BANK_COUNT, FORMAT, VERSION, SLOT_NAME_LIMIT, SLOT_SUBNAME_LIMIT,
    emptyBanks, emptySong, isPopulated, graphemeLength, truncateGraphemes,
    parseDocument, exportDocument, parseLibrary, exportLibrary,
    slotPosition, moveSlotImages, copySlotImages, clearSlotImages,
    firstLengthError, moveBank,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StajPilotSongs = api;
})(typeof window !== 'undefined' ? window : globalThis);
