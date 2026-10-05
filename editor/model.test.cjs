const assert = require('node:assert/strict');
const test = require('node:test');
const model = require('./model.js');

test('Unicode song and slot text round-trips without changing amp image IDs', () => {
  const original = model.emptySong(3);
  original.songName = '¿Qué tal? 🎸 日本語';
  original.slots[0] = { name: '후렴', subName: 'Città', ampImage: 42 };
  const banks = model.parseDocument([original]);
  const exported = model.exportDocument(banks);
  assert.deepEqual(exported, {
    format: 'stajpilot-songs', version: 1, songs: [original],
  });
  assert.deepEqual(model.parseDocument(exported), banks);
});

test('empty banks are not exported', () => {
  const banks = model.emptyBanks();
  banks[0] = model.emptySong(1);
  assert.equal(model.exportDocument(banks).songs.length, 0);
});

test('rejects duplicate banks, invalid slots and unknown formats', () => {
  const song = model.emptySong(1);
  song.songName = 'Test';
  assert.throws(() => model.parseDocument([song, song]), /more than once/);
  assert.throws(() => model.parseDocument([{ ...song, slots: [] }]), /five slots/);
  assert.throws(() => model.parseDocument([{ ...song, slots: [
    { ...song.slots[0], ampImage: 101 }, ...song.slots.slice(1),
  ] }]), /amp image/);
  assert.throws(() => model.parseDocument({ format: 'other', songs: [song] }), /not a StajPilot/);
});

test('move shifts intervening banks and leaves the source data intact', () => {
  const first = model.emptySong(1);
  first.songName = 'First';
  const second = model.emptySong(2);
  second.songName = 'Second';
  const banks = model.parseDocument([first, second]);
  const moved = model.moveBank(banks, 1, 3);
  assert.equal(moved[0].songName, 'Second');
  assert.equal(moved[0].bank, 1);
  assert.equal(moved[2].songName, 'First');
  assert.equal(moved[2].bank, 3);
  assert.equal(banks[0].songName, 'First');
  assert.equal(banks[0].bank, 1);
});

test('moving across an empty bank does not duplicate or lose a song', () => {
  const first = model.emptySong(1);
  first.songName = 'First';
  const third = model.emptySong(3);
  third.songName = 'Third';
  const moved = model.moveBank(model.parseDocument([first, third]), 3, 1);
  assert.deepEqual(model.exportDocument(moved).songs.map((song) => [song.bank, song.songName]), [
    [1, 'Third'], [2, 'First'],
  ]);
});

test('slot limits match the app while song titles have no fixed limit', () => {
  const song = model.emptySong(9);
  song.songName = 'Long title '.repeat(30);
  song.slots[0].name = 'N'.repeat(25);
  song.slots[0].subName = 'S'.repeat(13);
  assert.equal(model.parseDocument([song])[8].songName, song.songName);
  assert.throws(() => model.parseDocument([{ ...song, slots: [
    { ...song.slots[0], name: 'N'.repeat(26) }, ...song.slots.slice(1),
  ] }]), /name exceeds 25/);
  assert.throws(() => model.parseDocument([{ ...song, slots: [
    { ...song.slots[0], subName: 'S'.repeat(14) }, ...song.slots.slice(1),
  ] }]), /sub name exceeds 13/);
  assert.equal(model.graphemeLength('👨‍👩‍👧‍👦'), 1);
  assert.equal(model.truncateGraphemes('A👨‍👩‍👧‍👦B', 2), 'A👨‍👩‍👧‍👦');
});

test('a previously saved long draft can still be loaded and backed up', () => {
  const song = model.emptySong(1);
  song.slots[0].name = 'L'.repeat(26);
  const draft = model.parseDocument([song], { allowLong: true });
  assert.match(model.firstLengthError(draft), /name exceeds 25/);
  assert.equal(model.exportDocument(draft).songs[0].slots[0].name.length, 26);
});
