import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAM, UNIT_ROLE, UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../src/data/gameConfig.js';
import { ATTACK_ANIMATION } from '../src/data/gameTypes.js';
import { CombatActionResolver } from '../src/model/CombatActionResolver.js';
import { SpatialIndex } from '../src/model/SpatialIndex.js';
import { createBattleUnit } from './helpers/createBattleUnit.mjs';

function combatModel(units) {
  const spatialIndex = new SpatialIndex(units);
  return {
    units,
    spatialIndex,
    random: () => 0.5,
    emitCombatEvent: () => {},
    lineTargetFor: () => null,
    killUnit(unit) {
      unit.alive = false;
      spatialIndex.remove(unit);
    },
  };
}

test('pike is a durable low-attack formation unit with no extra mechanics', () => {
  const pike = UNIT_TYPES.pike;
  assert.equal(pike.role, UNIT_ROLE.MELEE);
  assert.deepEqual(pike.tags, [UNIT_TAG.FORMATION]);
  assert.ok(pike.hp > UNIT_TYPES.phalanx.hp);
  assert.ok(pike.attack < UNIT_TYPES.phalanx.attack);
});

test('reaper cleaves enemies directly beside its melee target', () => {
  const reaper = createBattleUnit({ id: 1, team: TEAM.PLAYER, type: 'reaper', row: 3, column: 3 });
  const target = createBattleUnit({ id: 2, team: TEAM.ENEMY, type: 'grunt', row: 3, column: 4 });
  const upper = createBattleUnit({ id: 3, team: TEAM.ENEMY, type: 'grunt', row: 2, column: 4 });
  const lower = createBattleUnit({ id: 4, team: TEAM.ENEMY, type: 'grunt', row: 4, column: 4 });
  const behind = createBattleUnit({ id: 5, team: TEAM.ENEMY, type: 'grunt', row: 3, column: 5 });
  const units = [reaper, target, upper, lower, behind];
  const model = combatModel(units);

  new CombatActionResolver().attackUnit(model, reaper, target, 0, 100);

  assert.equal(target.hp, target.maxHp - UNIT_TYPES.reaper.attack);
  assert.equal(upper.hp, upper.maxHp - UNIT_TYPES.reaper.attack);
  assert.equal(lower.hp, lower.maxHp - UNIT_TYPES.reaper.attack);
  assert.equal(behind.hp, behind.maxHp);
});

test('hostile-only additions preserve their intended niches', () => {
  assert.equal(UNIT_TYPES.mine.role, UNIT_ROLE.STRUCTURE);
  assert.equal(hasUnitTag(UNIT_TYPES.mine, UNIT_TAG.AI_ONLY), true);
  assert.equal(hasUnitTag(UNIT_TYPES.mine, UNIT_TAG.STATIONARY), true);
  assert.equal(hasUnitTag(UNIT_TYPES.mine, UNIT_TAG.BOMB), true);
  assert.equal(hasUnitTag(UNIT_TYPES.mine, UNIT_TAG.AOE), true);
  assert.equal(UNIT_TYPES.hangar.production.type, 'midge');
  assert.equal(UNIT_TYPES.teslaCoil.role, UNIT_ROLE.STRUCTURE);
  assert.equal(hasUnitTag(UNIT_TYPES.teslaCoil, UNIT_TAG.STUN), true);
  assert.equal(hasUnitTag(UNIT_TYPES.teslaCoil, UNIT_TAG.SALVO), false);
  assert.equal(hasUnitTag(UNIT_TYPES.teslaCoil, UNIT_TAG.ANTI_AIR), true);
  assert.equal(UNIT_TYPES.teslaCoil.animation.attack, ATTACK_ANIMATION.LIGHTNING);
});

test('stun salvo attacks apply a two-turn stun to every hit target', () => {
  const resolver = new CombatActionResolver();
  const disruptor = createBattleUnit({ id: 1, team: TEAM.PLAYER, type: 'disruptor', row: 3, column: 3 });
  const first = createBattleUnit({ id: 2, team: TEAM.ENEMY, type: 'grunt', row: 3, column: 5 });
  const second = createBattleUnit({ id: 3, team: TEAM.ENEMY, type: 'grunt', row: 4, column: 4 });
  const units = [disruptor, first, second];
  const model = combatModel(units);

  resolver.processQueue(model, units, 0, 100);

  assert.equal(first.hp, first.maxHp - UNIT_TYPES.disruptor.attack);
  assert.equal(second.hp, second.maxHp - UNIT_TYPES.disruptor.attack);
  assert.equal(first.stunTurnsRemaining, 1);
  assert.equal(second.stunTurnsRemaining, 1);
});
