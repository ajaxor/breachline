import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG, TEAM } from '../src/data/gameConfig.js';
import { CampaignProgression } from '../src/model/CampaignProgression.js';
import { CombatEventPresenter } from '../src/frontend/CombatEventPresenter.js';
import { COMBAT_EVENT, EFFECT_TYPE } from '../src/data/gameTypes.js';

function createModel(now, result, { playerLineHp = GAME_CONFIG.baseHp, enemyLineHp = GAME_CONFIG.baseHp, effects = [], units = [] } = {}) {
  const events = [];
  const presenter = new CombatEventPresenter();
  const mission = { status: 'available' };
  const model = {
    battleOver: false,
    mission,
    campaign: [mission],
    selectedMission: 0,
    playerLineHp,
    enemyLineHp,
    effects: [...effects],
    units: [...units],
    logEntries: [],
    now: () => now,
    addLog(message, cssClass = '') { this.logEntries.push({ message, cssClass }); },
    emitCombatEvent(event) {
      events.push(event);
      presenter.present(this, event);
    },
  };
  new CampaignProgression().finishBattle(model, result);
  return { model, events };
}

test('battle-finished presentation stays on the active combat timeline', () => {
  const now = 123_456;
  const result = { playerWon: false, text: 'DEFEAT — LINE BREACHED' };
  const { model, events } = createModel(now, result);

  const finished = events.find((event) => event.type === COMBAT_EVENT.BATTLE_FINISHED);
  assert.ok(finished, 'Expected a battle-finished event');
  assert.equal(finished.at, now, 'Battle-finished event must use the model clock');
  assert.equal(model.battleOver, true);
  assert.ok(model.effects.every((effect) => effect.start >= now), 'Finale effects must not be scheduled near time zero');
});

test('battle finale waits for combat, drains the losing wall, then starts sound and full fade', () => {
  const now = 98_000;
  const combatEffect = { type: EFFECT_TYPE.TEXT, start: now, duration: 600 };
  const movingUnit = { animationStartedAt: now, animationDuration: 400 };
  const { model } = createModel(now, { playerWon: true, text: 'VICTORY' }, {
    enemyLineHp: 7,
    effects: [combatEffect],
    units: [movingUnit],
  });
  const fadeEffects = model.effects.filter((effect) => effect.type === EFFECT_TYPE.GRID_FADE);
  const wallDrain = model.effects.filter((effect) => effect.type === EFFECT_TYPE.HEALTH_LOSS && String(effect.targetId).startsWith(`line:${TEAM.ENEMY}:`));

  assert.equal(fadeEffects.length, 1, 'Expected one battlefield fade finale effect');
  assert.equal(fadeEffects[0].losingTeam, TEAM.ENEMY, 'Victory fade must start from the enemy side');
  assert.equal(fadeEffects[0].audioBank, 'breach', 'Fade must play the breach sound bank');
  assert.ok(fadeEffects[0].duration <= 1200, 'Battlefield fade should remain faster than the old explosion sequence');
  assert.equal(wallDrain.length, GAME_CONFIG.rows, 'Every losing wall segment should share the final health drain');
  assert.ok(wallDrain.every((effect) => effect.hpBefore === 7 && effect.hpAfter === 0), 'Final wall drain must animate remaining health to zero');
  const combatEnd = Math.max(combatEffect.start + combatEffect.duration, movingUnit.animationStartedAt + movingUnit.animationDuration / 0.5);
  const wallDrainEnd = Math.max(...wallDrain.map((effect) => effect.start + effect.duration));
  assert.ok(wallDrain.every((effect) => effect.start >= combatEnd), 'Wall drain must wait for combat animations to finish');
  assert.ok(fadeEffects[0].start > wallDrainEnd, 'Fade and sound must wait until the wall reaches zero and the hold completes');
  assert.equal(model.effects.some((effect) => effect.type === EFFECT_TYPE.EXPLOSION), false, 'Finale must not create explosion effects');
});
