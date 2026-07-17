const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  resolveSoundPath,
  volumeToMpg123Scale,
  volumeToUnitInterval
} = require('../dist/sound.js');

test('uses the bundled sound when no custom path is configured', () => {
  assert.equal(resolveSoundPath('  ', 'bundled.mp3', 'workspace', 'home'), 'bundled.mp3');
});

test('resolves workspace-relative and home-relative custom paths', () => {
  assert.equal(
    resolveSoundPath(path.join('sounds', 'done.wav'), 'bundled.mp3', path.resolve('workspace'), path.resolve('home')),
    path.resolve('workspace', 'sounds', 'done.wav')
  );
  assert.equal(
    resolveSoundPath('~/done.wav', 'bundled.mp3', path.resolve('workspace'), path.resolve('home')),
    path.resolve('home', 'done.wav')
  );
});

test('accepts file URLs selected by VS Code', () => {
  const audioPath = path.resolve('sounds', 'done.mp3');
  assert.equal(resolveSoundPath(pathToFileURL(audioPath).href, 'bundled.mp3', undefined, path.resolve('home')), audioPath);
});

test('maps and clamps volume for native players', () => {
  assert.equal(volumeToUnitInterval(50), '0.50');
  assert.equal(volumeToUnitInterval(150), '1.00');
  assert.equal(volumeToUnitInterval(-1), '0.00');
  assert.equal(volumeToMpg123Scale(50), '16384');
});
