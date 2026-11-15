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
