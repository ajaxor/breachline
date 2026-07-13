import assert from 'node:assert/strict';
import test from 'node:test';

import { COMBAT_EVENT } from '../src/data/gameTypes.js';
import { CombatEventPresenter } from '../src/frontend/CombatEventPresenter.js';

test('combat presenter staggers every attack in the same tick including melee actions', () => {
  const presenter = new CombatEventPresenter();

  assert.equal(presenter.actionTime({ type: COMBAT_EVENT.UNIT_ATTACKED, at: 1000 }), 1000);
  assert.equal(presenter.actionTime({ type: COMBAT_EVENT.UNIT_ATTACKED, at: 1000 }), 1180);
  assert.equal(presenter.actionTime({ type: COMBAT_EVENT.UNIT_DODGED, at: 1000 }), 1360);
});

test('combat presenter resets the attack stagger sequence on a new tick', () => {
  const presenter = new CombatEventPresenter();

  presenter.actionTime({ type: COMBAT_EVENT.UNIT_ATTACKED, at: 1000 });
  presenter.actionTime({ type: COMBAT_EVENT.UNIT_ATTACKED, at: 1000 });

  assert.equal(presenter.actionTime({ type: COMBAT_EVENT.UNIT_ATTACKED, at: 2000 }), 2000);
});
