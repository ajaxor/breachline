import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAM } from '../src/data/gameConfig.js';
import { CampaignProgression } from '../src/model/CampaignProgression.js';
import { CombatEventPresenter } from '../src/frontend/CombatEventPresenter.js';
import { COMBAT_EVENT, EFFECT_TYPE } from '../src/data/gameTypes.js';

function createModel(now, result) {
  const events = [];
  const presenter = new CombatEventPresenter();
  const mission = { status: 'available' };
  const model = {
    battleOver: false,
    mission,
    campaign: [mission],
    selectedMission: 0,
    effects: [],
    units: [],
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

test('battle finale uses one fast grid fade from the losing side without explosions', () => {
  const now = 98_000;
  const { model } = createModel(now, { playerWon: true, text: 'VICTORY' });
  const fadeEffects = model.effects.filter((effect) => effect.type === EFFECT_TYPE.GRID_FADE);

  assert.equal(fadeEffects.length, 1, 'Expected one grid fade finale effect');
  assert.equal(fadeEffects[0].losingTeam, TEAM.ENEMY, 'Victory fade must start from the enemy side');
  assert.ok(fadeEffects[0].duration <= 1200, 'Grid fade should be faster than the old explosion sequence');
  assert.equal(model.effects.some((effect) => effect.type === EFFECT_TYPE.EXPLOSION), false, 'Finale must not create explosion effects');
});