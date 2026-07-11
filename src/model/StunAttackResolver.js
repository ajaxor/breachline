import { UNIT_TAG, hasUnitTag } from '../data/gameConfig.js';
import { COMBAT_EVENT } from '../data/gameTypes.js';
import { CombatActionResolver } from './CombatActionResolver.js';

const STUN_TURNS = 2;

export class StunAttackResolver extends CombatActionResolver {
  applyStunFields() {}

  applyDamage(model, source, target, rawDamage, eventType, now, duration) {
    const damage = super.applyDamage(model, source, target, rawDamage, eventType, now, duration);
    if (eventType === COMBAT_EVENT.UNIT_ATTACKED
      && !target.lineObjective
      && target.alive
      && hasUnitTag(source.type, UNIT_TAG.STUN)) {
      target.stunTurnsRemaining = Math.max(target.stunTurnsRemaining ?? 0, STUN_TURNS);
    }
    return damage;
  }
}
