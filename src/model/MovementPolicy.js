import { GAME_CONFIG, TEAM, UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../data/gameConfig.js';

export class MovementPolicy {
  move(model, unit, now, duration) {
    const type = UNIT_TYPES[unit.type];
    if (hasUnitTag(type, UNIT_TAG.STATIONARY)) return false;
    const direction = unit.team === TEAM.PLAYER ? 1 : -1;
    const nextColumn = unit.column + direction;
    if (nextColumn < 0 || nextColumn >= GAME_CONFIG.columns) {
      model.breach(unit, direction, now, duration);
      return true;
    }

    const previousRow = unit.row;
    const previousColumn = unit.column;
    if (hasUnitTag(type, UNIT_TAG.FLYING)) unit.column = nextColumn;
    else if (!model.occupantAt(unit.row, nextColumn)) unit.column = nextColumn;
    else return false;

    model.spatialIndex.move(unit, previousRow, previousColumn);
    return true;
  }
}