const test = require('node:test');
const assert = require('node:assert/strict');

const {
  centerBoundsInWorkArea
} = require('./pet_window_position');

test('centers pet bounds inside the target display work area', () => {
  const bounds = centerBoundsInWorkArea(
    { width: 260, height: 260 },
    { x: 1920, y: 0, width: 2560, height: 1440 }
  );

  assert.deepEqual(bounds, {
    x: 3070,
    y: 590,
    width: 260,
    height: 260
  });
});

test('keeps oversized pet bounds visible at the target display origin', () => {
  const bounds = centerBoundsInWorkArea(
    { width: 900, height: 700 },
    { x: -1280, y: 120, width: 800, height: 600 }
  );

  assert.deepEqual(bounds, {
    x: -1280,
    y: 120,
    width: 900,
    height: 700
  });
});
