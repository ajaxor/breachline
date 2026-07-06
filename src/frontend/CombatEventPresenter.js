import { GAME_CONFIG, TEAM, UNIT_TYPES } from '../data/gameConfig.js';
import { COMBAT_EVENT, EFFECT_TYPE, LOG_TYPE } from '../data/gameTypes.js';

const point = (unit) => ({ row: unit.row, column: unit.column });
const teamColor = (team) => team === TEAM.PLAYER ? '#38bdf8' : '#ff5d5d';

function addDeathEffect(model, unit, at, duration) {
  const definition = UNIT_TYPES[unit.type];
  model.effects.push({
    type: EFFECT_TYPE.DEATH,
    ...point(unit),
    shape: definition.shape,
    graphic: definition.graphic,
    color: teamColor(unit.team),
    seed: unit.id * 2.399963229728653,
    start: at,
    duration: Math.max(duration * 1.25, 450),
  });
}

export class CombatEventPresenter {
  present(model, event) {
    const duration = Math.max(110, Math.min(480, GAME_CONFIG.tickIntervalMs * 0.85));
    const at = event.at ?? 0;

    switch (event.type) {
      case COMBAT_EVENT.BATTLE_STARTED:
        model.addLog(`${event.label} begins. Your force: ${event.playerCount} units. Hostile force: ${event.enemyCount} units.`, LOG_TYPE.SYSTEM);
        break;
      case COMBAT_EVENT.UNIT_HEALED:
        model.effects.push(
          { type: EFFECT_TYPE.HEAL, from: point(event.source), to: point(event.target), start: at, duration },
          { type: EFFECT_TYPE.TEXT, ...point(event.target), text: `+${event.amount}`, color: '#4ade80', start: at, duration: duration * 1.3 },
        );
        model.addLog(`${UNIT_TYPES[event.source.type].name} #${event.source.id} restores ${event.amount} HP to ${UNIT_TYPES[event.target.type].name} #${event.target.id}.`, LOG_TYPE.HIT);
        break;
      case COMBAT_EVENT.UNIT_ATTACKED:
        model.effects.push(
          { type: event.range > 1 ? EFFECT_TYPE.RANGED : EFFECT_TYPE.MELEE, attackerId: event.attacker.id, team: event.attacker.team, from: point(event.attacker), to: point(event.target), start: at, duration },
          { type: EFFECT_TYPE.TEXT, ...point(event.target), text: `-${event.damage}`, color: '#ff5d5d', start: at, duration: duration * 1.3 },
        );
        model.addLog(`${UNIT_TYPES[event.attacker.type].name} #${event.attacker.id} hits ${UNIT_TYPES[event.target.type].name} #${event.target.id} for ${event.damage}.`, LOG_TYPE.HIT);
        break;
      case COMBAT_EVENT.SPLASH_HIT:
        model.effects.push({ type: EFFECT_TYPE.TEXT, ...point(event.target), text: `-${event.damage}`, color: '#ff5d5d', start: at, duration: duration * 1.3 });
        model.addLog(`Splash blast hits ${UNIT_TYPES[event.target.type].name} #${event.target.id} for ${event.damage}.`, LOG_TYPE.HIT);
        break;
      case COMBAT_EVENT.UNIT_DETONATED:
        model.effects.push({ type: EFFECT_TYPE.EXPLOSION, ...point(event.unit), start: at, duration: Math.max(duration, 320) });
        addDeathEffect(model, event.unit, at, duration);
        model.addLog(`${UNIT_TYPES[event.unit.type].name} #${event.unit.id} detonates and is destroyed.`, event.unit.team === TEAM.PLAYER ? LOG_TYPE.PLAYER_LOSS : LOG_TYPE.KILL);
        break;
      case COMBAT_EVENT.UNIT_BREACHED:
        model.effects.push({ type: EFFECT_TYPE.TEXT, ...point(event.unit), text: 'BREACH!', color: '#fbbf24', start: at, duration: Math.max(duration * 1.6, 400) });
        model.addLog(`${UNIT_TYPES[event.unit.type].name} #${event.unit.id} breaks through and begins sieging the ${event.targetBase} base!`, LOG_TYPE.SYSTEM);
        break;
      case COMBAT_EVENT.BASE_ATTACKED:
        model.effects.push({ type: EFFECT_TYPE.TEXT, ...point(event.unit), text: `-${event.damage}`, color: '#fbbf24', start: at, duration: duration * 1.2 });
        model.addLog(`${UNIT_TYPES[event.unit.type].name} #${event.unit.id} strikes the ${event.targetBase} base for ${event.damage}.`, event.unit.team === TEAM.PLAYER ? LOG_TYPE.KILL : LOG_TYPE.PLAYER_LOSS);
        break;
      case COMBAT_EVENT.UNIT_DESTROYED: {
        const definition = UNIT_TYPES[event.unit.type];
        addDeathEffect(model, event.unit, at, duration);
        if (!event.silent) model.addLog(`${definition.name} #${event.unit.id} destroyed.`, event.unit.team === TEAM.PLAYER ? LOG_TYPE.PLAYER_LOSS : LOG_TYPE.KILL);
        break;
      }
      case COMBAT_EVENT.BATTLE_FINISHED:
        model.addLog(event.result.text, LOG_TYPE.SYSTEM);
        break;
      default:
        throw new Error(`Unsupported combat event: ${event.type}`);
    }
  }
}
