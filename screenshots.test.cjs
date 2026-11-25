const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const captures = {
  'wifi-staj-2-0-7.png': [2000, 1200],
  'wifi-pilot-2-0-7.png': [2000, 1200],
  'wifi-morph-2-0-7.png': [1920, 1080],
};

for (const [name, dimensions] of Object.entries(captures)) {
  test(`${name} retains its original PNG dimensions`, () => {
    const png = fs.readFileSync(path.join(__dirname, 'assets/images', name));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], dimensions);
  });
}

for (const page of ['index.html', 'ios/index.html', 'android/index.html']) {
  test(`${page} uses Wi-Fi captures with matching full-size links and dimensions`, () => {
    const html = fs.readFileSync(path.join(__dirname, page), 'utf8');
    for (const name of ['wifi-staj-2-0-7.png', 'wifi-pilot-2-0-7.png']) {
      assert.ok(html.includes(name), `Missing ${name}`);
    }
    for (const match of html.matchAll(/<a href="([^"]+)"[^>]*><img src="([^"]*wifi-[^"]+)"([^>]+)>/g)) {
      assert.equal(match[1], match[2], 'Full-size link must open the displayed capture');
      const dimensions = captures[path.basename(match[2])];
      assert.ok(dimensions);
      assert.ok(match[3].includes(`width="${dimensions[0]}" height="${dimensions[1]}"`));
      assert.ok(fs.existsSync(path.resolve(__dirname, path.dirname(page), match[2])));
    }
    assert.doesNotMatch(html, /stage2-pilot-photo\.png|(?:ios|android)-main-controller\.png|staj-mode-lenovo-20261023\.png/);
    assert.doesNotMatch(html, /PILOT editing is not available in Wi-Fi mode|does not intercept proprietary/);
    assert.match(html, /2\.0\.7/);
  });
}

test('the iOS USB connection diagram remains in the guide', () => {
  const html = fs.readFileSync(path.join(__dirname, 'ios/index.html'), 'utf8');
  assert.ok(html.includes('ios-usb-connections-v2.png'));
});
