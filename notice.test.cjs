const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const notice = fs.readFileSync(path.join(__dirname, 'compatibility-notice.txt'), 'utf8')
  .trim().split(/\n\s*\n/);

for (const page of ['index.html', 'ios/index.html', 'android/index.html', 'support/index.html']) {
  test(`${page} preserves the complete compatibility notice`, () => {
    const html = fs.readFileSync(path.join(__dirname, page), 'utf8');
    const legal = html.match(/<(div|section) class="legal"[^>]*>([\s\S]*?)<\/\1>/);
    assert.ok(legal, 'Missing legal footer');
    const paragraphs = [...legal[2].matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/g)]
      .map(match => match[1].trim());
    let previous = -1;
    for (const sentence of notice) {
      assert.equal(paragraphs.filter(text => text === sentence).length, 1);
      const current = paragraphs.indexOf(sentence);
      assert.ok(current > previous, 'Notice order changed');
      previous = current;
    }
    assert.equal(notice.length, 4);
    assert.equal(notice.at(-1), 'Continued updates and support for StajPilot are not guaranteed.');
  });
}

test('home update preview includes Wi-Fi precautions and the in-app notice', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const update = html.match(/<section class="update-notice"[^>]*>([\s\S]*?)<\/section>/);
  assert.ok(update, 'Missing update preview');
  for (const text of [
    'StajPilot 2.0.7',
    'Preparing for release',
    'Wi-Fi PILOT editing with real-time bidirectional updates',
    'Existing USB MIDI connectivity remains available.',
    'A/B Morph, effect copy and paste, and user presets.',
    'Do not connect a USB cable to the KEMPER while using Wi-Fi mode.',
    'Connecting multiple devices to the KEMPER over Wi-Fi is not recommended.',
    'Experimental connection. Kemper does not provide official support for this connection.',
    'Operation may stop at any time, including due to firmware changes.',
    'Hardware stability and compatibility have not been verified.',
    'Please use this connection only if you agree to do so with these limitations in mind.',
  ]) {
    assert.ok(update[1].includes(text), `Missing announcement text: ${text}`);
  }
  assert.doesNotMatch(update[1], /now available|released|within 24 hours|under review/i);
  assert.ok(html.indexOf('class="update-notice"') < html.indexOf('class="product-photo intro-photo"'));
});
