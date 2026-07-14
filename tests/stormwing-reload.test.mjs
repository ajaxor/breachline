import assert from 'node:assert/strict';
import test from 'node:test';

import { TEAM, UNIT_TAG, UNIT_TYPES } from '../src/data/gameConfig.js';
import { GameModel } from '../src/model/GameModel.js';

const formationUnit = (type, row, column) => ({ type, row, column });

test('Stormwing reloads after firing its stun salvo', () => {
  assert.ok(UNIT_TYPES.stormwing.tags.includes(UNIT_TAG.RELOAD));

  const model = new GameModel({ random: () => 0, now: () => 0 });
  model.setupBattle({
    playerFormation: [formationUnit('stormwing', 2, 2)],
    enemyFormation: [formationUnit('grunt', 2, 4), formationUnit('grunt', 3, 4)],
  });
  const stormwing = model.units.find((unit) => unit.team === TEAM.PLAYER);

  model.processUnit(stormwing, 0, 100);

  assert.equal(stormwing.reloadTurnsRemaining, 2);

  model.processUnit(stormwing, 100, 100);

  assert.equal(stormwing.reloadTurnsRemaining, 1);
});
