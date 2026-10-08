const test = require('node:test');
const assert = require('node:assert/strict');
const codec = require('./file_codec.js');

test('Song file hides JSON structure and restores Unicode data', async () => {
  const library = {
    format: 'stajpilot-songs',
    version: 1,
    songs: [{ bank: 1, songName: '태양 🎸', slots: [] }],
    slotAmpImages: { 1: 5 },
  };
  const file = await codec.encode(library);
  assert.ok(file.startsWith(codec.HEADER));
  assert.ok(!file.includes('songName'));
  assert.ok(!file.includes('태양'));
  assert.deepEqual(await codec.decode(file), library);
});

test('raw JSON is not a StajPilot Song file', async () => {
  const library = { format: 'stajpilot-songs', version: 1, songs: [] };
  assert.throws(() => codec.decode(JSON.stringify(library)), /valid StajPilot Song file/);
});

test('damaged Song files are rejected', () => {
  assert.throws(() => codec.decode(`${codec.HEADER}not-base64`), /valid StajPilot Song file/);
});
