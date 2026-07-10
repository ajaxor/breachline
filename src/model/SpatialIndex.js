const keyFor = (row, column) => `${row}:${column}`;

export class SpatialIndex {
  constructor(units = []) {
    this.cells = new Map();
    units.forEach((unit) => this.add(unit));
  }

  add(unit) {
    if ((!unit.alive && !unit.blocksCell) || unit.breached) return;
    const key = keyFor(unit.row, unit.column);
    const occupants = this.cells.get(key) ?? [];
    occupants.push(unit);
    this.cells.set(key, occupants);
  }

  remove(unit, row = unit.row, column = unit.column) {
    const key = keyFor(row, column);
    const occupants = this.cells.get(key);
    if (!occupants) return;
    const index = occupants.indexOf(unit);
    if (index >= 0) occupants.splice(index, 1);
    if (!occupants.length) this.cells.delete(key);
  }

  move(unit, previousRow, previousColumn) {
    this.remove(unit, previousRow, previousColumn);
    this.add(unit);
  }

  occupantsAt(row, column) {
    return this.cells.get(keyFor(row, column))?.filter((unit) => (unit.alive || unit.blocksCell) && !unit.breached) ?? [];
  }

  occupantAt(row, column) {
    return this.occupantsAt(row, column)[0] ?? null;
  }

  nearby(row, column, range) {
    const results = [];
    for (let targetRow = row - range; targetRow <= row + range; targetRow += 1) {
      for (let targetColumn = column - range; targetColumn <= column + range; targetColumn += 1) {
        const occupants = this.cells.get(keyFor(targetRow, targetColumn));
        if (occupants) results.push(...occupants);
      }
    }
    return results;
  }
}
