import test from 'node:test';
import assert from 'node:assert/strict';
import { CampaignProgression } from '../src/model/CampaignProgression.js';
import { CombatEventPresenter } from '../src/frontend/CombatEventPresenter.js';
import { COMBAT_EVENT } from '../src/data/gameTypes.js';


test('battle-finished presentation stays on the active combat timeline', () => {
  const now = 123_456;
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
  const result = { playerWon: false, text: 'DEFEAT — LINE BREACHED' };

  new CampaignProgression().finishBattle(model, result);

  const finished = events.find((event) => event.type === COMBAT_EVENT.BATTLE_FINISHED);
  assert.ok(finished, 'Expected a battle-finished event');
  assert.equal(finished.at, now, 'Battle-finished event must use the model clock');
  assert.equal(model.battleOver, true);
  assert.ok(model.effects.length > 0, 'Expected finale effects');
  assert.ok(
    model.effects.every((effect) => effect.start >= now),
    'Finale effects must not be scheduled near time zero',
  );
});
