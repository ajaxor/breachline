import { GAME_CONFIG, TEAM, UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../data/gameConfig.js';

export class MovementPolicy {
  directionFor(unit) {
    return unit.team === TEAM.PLAYER ? 1 : -1;
  }

  maxSteps(model, unit) {
    const type = UNIT_TYPES[unit.type];
    if (hasUnitTag(type, UNIT_TAG.FAST)) return 2;
    if (!hasUnitTag(type, UNIT_TAG.CHARGE) || type.range !== 1) return 1;
    const direction = this.directionFor(unit);
    const distances = model.units
      .filter((enemy) => enemy.alive && !enemy.breached && enemy.team !== unit.team && enemy.row === unit.row)
      .map((enemy) => (enemy.column - unit.column) * direction)
      .filter((distance) => distance > type.range);
    const nearest = distances.length ? Math.min(...distances) : Infinity;
    return nearest === 3 ? 2 : 1;
  }

  move(model, unit, now, duration, forcedSteps = null) {
    const type = UNIT_TYPES[unit.type];
    if (hasUnitTag(type, UNIT_TAG.STATIONARY)) return false;
    const direction = this.directionFor(unit);
    const steps = forcedSteps ?? this.maxSteps(model, unit);
    const previousRow = unit.row;
    const previousColumn = unit.column;
    let moved = false;

    for (let step = 0; step < steps; step += 1) {
      const nextColumn = unit.column + direction;
      if (nextColumn < 0 || nextColumn >= GAME_CONFIG.columns) {
        model.breach(unit, direction, now, duration);
        return true;
      }
      if (!hasUnitTag(type, UNIT_TAG.FLYING) && model.occupantAt(unit.row, nextColumn)) break;
      unit.column = nextColumn;
      moved = true;
    }

    if (!moved) return false;
    model.spatialIndex.move(unit, previousRow, previousColumn);
    return true;
  }

  moveFormation(model, units, now, duration) {
    if (units.length === 0) return false;
    const direction = this.directionFor(units[0]);
    const formationIds = new Set(units.map((unit) => unit.id));
    const moves = [];

    for (const unit of units) {
      const type = UNIT_TYPES[unit.type];
      if (hasUnitTag(type, UNIT_TAG.STATIONARY)) return false;
      const nextColumn = unit.column + direction;
      if (nextColumn < 0 || nextColumn >= GAME_CONFIG.columns) {
        moves.push({ unit, breach: true, previousRow: unit.row, previousColumn: unit.column });
        continue;
      }
      const occupant = model.occupantAt(unit.row, nextColumn);
      if (occupant && !formationIds.has(occupant.id)) return false;
      moves.push({ unit, nextColumn, previousRow: unit.row, previousColumn: unit.column });
    }

    for (const move of moves) model.spatialIndex.remove(move.unit);
    for (const move of moves) {
      if (move.breach) model.breach(move.unit, direction, now, duration);
      else {
        move.unit.column = move.nextColumn;
        model.spatialIndex.add(move.unit);
      }
    }
    return true;
  }
}