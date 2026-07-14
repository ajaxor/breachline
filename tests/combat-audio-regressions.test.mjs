import assert from 'node:assert/strict';
import test from 'node:test';

import { TEAM, UNIT_TYPES } from '../src/data/gameConfig.js';
import { CombatRangeBattlefieldRenderer } from '../src/frontend/CombatRangeBattlefieldRenderer.js';
import { FileTrackAudioDirector } from '../src/frontend/FileTrackAudioDirector.js';
import { GameModel } from '../src/model/GameModel.js';

const formationUnit = (type, row, column) => ({ type, row, column });

class FakeAudio {
  constructor(src) {
    this.src = src;
    this.volume = 0;
    this.loop = false;
    this.preload = '';
  }

  play() { return Promise.resolve(); }
  pause() {}
}

function fakeAudioBrowser() {
  return {
    Audio: FakeAudio,
    clearInterval() {},
    localStorage: { getItem() { return null; }, setItem() {} },
  };
}

test('a rear flyer can advance into the cell of an allied flyer that will also move', () => {
  const model = new GameModel({ random: () => 0, now: () => 0 });
  model.setupBattle({
    playerFormation: [formationUnit('midge', 2, 0), formationUnit('midge', 2, 1)],
    enemyFormation: [formationUnit('grunt', 7, 12)],
  });
  const [rear, front] = model.units.filter((unit) => unit.team === TEAM.PLAYER);

  model.processActionQueue([rear, front], 0, 100);

  assert.equal(rear.column, 1);
  assert.equal(front.column, 2);
});

test('a reloading unit holds position while a target remains in range', () => {
  const model = new GameModel({ random: () => 0, now: () => 0 });
  model.setupBattle({
    playerFormation: [formationUnit('archer', 2, 2)],
    enemyFormation: [formationUnit('grunt', 2, 4)],
  });
  const archer = model.units.find((unit) => unit.team === TEAM.PLAYER);
  archer.reloadTurnsRemaining = 2;

  model.processUnit(archer, 0, 100);

  assert.equal(archer.column, 2);
  assert.equal(archer.reloadTurnsRemaining, 1);
});

test('range overlays include armed structures and non-swivel side lanes', () => {
  const renderer = Object.create(CombatRangeBattlefieldRenderer.prototype);
  const sniper = { type: 'sniper', team: TEAM.ENEMY, row: 3, column: 8 };

  assert.equal(renderer.canShowAttackRange(UNIT_TYPES.mine), true);
  assert.equal(renderer.isCellInAttackRange(sniper, UNIT_TYPES.sniper, 1, 8), true);
  assert.equal(renderer.isCellInAttackRange(sniper, UNIT_TYPES.sniper, 3, 9), false);
  assert.equal(renderer.isCellInAttackRange(sniper, UNIT_TYPES.sniper, 3, 5), true);
});

test('file music volume drives the Web Audio track gain when available', () => {
  const director = new FileTrackAudioDirector(fakeAudioBrowser());
  let appliedVolume = null;
  director.context = { currentTime: 7 };
  director.musicGain = { gain: { setTargetAtTime() {} } };
  director.trackGain = { gain: { setTargetAtTime(value) { appliedVolume = value; } } };

  director.setMusicVolume(0.5);

  assert.equal(director.musicElement.volume, 1);
  assert.equal(appliedVolume, 0.1);
});
