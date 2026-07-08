import { GAME_CONFIG, TEAM, UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../data/gameConfig.js';

export class MovementPolicy {
  directionFor(unit) {
    return unit.team === TEAM.PLAYER ? 1 : -1;
  }

  maxSteps(model, unit) {
    const type = UNIT_TYPES[unit.type];
    return hasUnitTag(type, UNIT_TAG.CHARGE) && !unit.chargeUsed ? 2 : 1;
  }

  openSideRows(model, unit) {
    return [unit.row - 1, unit.row + 1]
      .filter((row) => row >= 0 && row < GAME_CONFIG.rows && !model.occupantAt(row, unit.column));
  }

  scatterSideways(model, unit) {
    const openRows = this.openSideRows(model, unit);
    if (!openRows.length) return false;
    const previousRow = unit.row;
    const previousColumn = unit.column;
    unit.row = openRows[Math.floor(model.random() * openRows.length)];
    model.spatialIndex.move(unit, previousRow, previousColumn);
    return true;
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
      if (!hasUnitTag(type, UNIT_TAG.FLYING) && model.occupantAt(unit.row, nextColumn)) {
        if (!moved && hasUnitTag(type, UNIT_TAG.SCATTER)) return this.scatterSideways(model, unit);
        break;
      }
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
