import test from 'node:test';
import assert from 'node:assert/strict';

import { TEAM, UNIT_ROLE, UNIT_TAG, UNIT_TYPES } from '../src/data/gameConfig.js';
import { TargetingPolicy } from '../src/model/TargetingPolicy.js';

const targeting = new TargetingPolicy();
const unit = (overrides) => ({
  id: 1,
  alive: true,
  team: TEAM.PLAYER,
  type: 'grunt',
  row: 3,
  column: 3,
  ...overrides,
});
const enemyWall = (overrides) => unit({ id: 2, team: TEAM.ENEMY, type: 'wall', ...overrides });

test('walls are only targetable when they directly block movement', () => {
  const attacker = unit({ type: 'sidestepper' });
  const sideWall = enemyWall({ row: 4, column: 4 });
  const blockingWall = enemyWall({ row: 3, column: 4 });

  assert.equal(targeting.canTarget(attacker, sideWall, UNIT_TYPES.sidestepper), false);
  assert.equal(targeting.canTarget(attacker, blockingWall, UNIT_TYPES.sidestepper), true);
});

test('wall ignoring applies to melee and support targeting checks too', () => {
  const meleeWithSwivel = {
    ...UNIT_TYPES.grunt,
    role: UNIT_ROLE.MELEE,
    range: 1,
    tags: [UNIT_TAG.SWIVEL],
  };
  const supportType = UNIT_TYPES.healer;
  const offLaneAdjacentWall = enemyWall({ row: 4, column: 3 });
  const supportWall = enemyWall({ row: 4, column: 4 });

  assert.equal(targeting.canTarget(unit({ type: 'grunt' }), offLaneAdjacentWall, meleeWithSwivel), false);
  assert.equal(targeting.canTarget(unit({ type: 'healer' }), supportWall, supportType), false);
});
