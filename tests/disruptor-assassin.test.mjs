import assert from 'node:assert/strict';
import test from 'node:test';

import { TEAM, UNIT_TAG, UNIT_TYPES } from '../src/data/gameConfig.js';
import { GameModel } from '../src/model/GameModel.js';

const formationUnit = (type, row, column) => ({ type, row, column });

test('Disruptor reloads after firing its stun salvo', () => {
  assert.ok(UNIT_TYPES.disruptor.tags.includes(UNIT_TAG.RELOAD));

  const model = new GameModel({ random: () => 0, now: () => 0 });
  model.setupBattle({
    playerFormation: [formationUnit('disruptor', 2, 2)],
    enemyFormation: [formationUnit('grunt', 2, 4), formationUnit('grunt', 3, 4)],
  });
  const disruptor = model.units.find((unit) => unit.team === TEAM.PLAYER);

  model.processUnit(disruptor, 0, 100);
  assert.equal(disruptor.reloadTurnsRemaining, 2);

  model.processUnit(disruptor, 100, 100);
  assert.equal(disruptor.reloadTurnsRemaining, 1);
});

test('Assassin is a fragile stealth charger', () => {
  const assassin = UNIT_TYPES.assassin;

  assert.equal(assassin.role, 'specialist');
  assert.equal(assassin.hp, 16);
  assert.ok(assassin.tags.includes(UNIT_TAG.CHARGE));
  assert.ok(assassin.tags.includes(UNIT_TAG.STEALTH));
  assert.ok(assassin.hp < UNIT_TYPES.infiltrator.hp);
});

test('Assassin advances at charge speed while hidden', () => {
  const model = new GameModel({ random: () => 0, now: () => 0 });
  model.setupBattle({
    playerFormation: [formationUnit('assassin', 2, 1)],
    enemyFormation: [formationUnit('grunt', 2, 4)],
  });
  const assassin = model.units.find((unit) => unit.type === 'assassin');

  model.processUnit(assassin, 0, 100);

  assert.equal(assassin.column, 3);
  assert.equal(assassin.hasAttacked, false);
});
