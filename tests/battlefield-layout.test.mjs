import test from 'node:test';
import assert from 'node:assert/strict';

import { GAME_CONFIG } from '../src/data/gameConfig.js';
import { DeploymentBattlefieldRenderer } from '../src/frontend/DeploymentBattlefieldRenderer.js';

const context = {
  clearRect() {},
  save() {},
  restore() {},
  translate() {},
};

const createRenderer = (width, height) => {
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    getBoundingClientRect() {
      return { left: 0, top: 0, width: this.width, height: this.height };
    },
  };
  const renderer = new DeploymentBattlefieldRenderer(canvas, { clientWidth: width, clientHeight: height });
  renderer.render = () => {};
  return { renderer, canvas };
};

test('landscape battlefield includes equal wall gutters outside the grid', () => {
  const { renderer, canvas } = createRenderer(1200, 700);
  renderer.resize({});

  assert.equal(renderer.isPortrait, false);
  assert.equal(canvas.width, (GAME_CONFIG.columns + 1) * renderer.cellSize);
  assert.equal(canvas.height, GAME_CONFIG.rows * renderer.cellSize);

  const walls = [];
  renderer.drawPerspectiveWall = (...args) => walls.push(args);
  renderer.drawEndWalls(GAME_CONFIG.columns * renderer.cellSize, GAME_CONFIG.rows * renderer.cellSize);
  assert.equal(walls[0][3], -1);
  assert.equal(walls[1][3], 1);
});

test('portrait battlefield includes equal wall gutters above and below the rotated grid', () => {
  const { renderer, canvas } = createRenderer(700, 1200);
  renderer.resize({});

  assert.equal(renderer.isPortrait, true);
  assert.equal(canvas.width, GAME_CONFIG.rows * renderer.cellSize);
  assert.equal(canvas.height, (GAME_CONFIG.columns + 1) * renderer.cellSize);
});

test('wall gutters are not selectable and grid pointer mapping remains centered', () => {
  const { renderer, canvas } = createRenderer(1200, 700);
  renderer.resize({});
  const gutter = renderer.cellSize / 2;

  assert.equal(renderer.cellFromPointer({ clientX: gutter / 2, clientY: renderer.cellSize / 2 }), null);
  assert.deepEqual(renderer.cellFromPointer({ clientX: gutter + renderer.cellSize / 2, clientY: renderer.cellSize / 2 }), { row: 0, column: 0 });
  assert.equal(renderer.cellFromPointer({ clientX: canvas.width - gutter / 2, clientY: renderer.cellSize / 2 }), null);
});
