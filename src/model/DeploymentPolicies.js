import { GAME_CONFIG, MODE, UNIT_TAG, UNIT_TYPES, hasUnitTag } from '../data/gameConfig.js';

function placementIndex(model, row, column) {
  return model.placement.findIndex((unit) => unit.row === row && unit.column === column);
}

function selectedDeployableType(model) {
  const type = UNIT_TYPES[model.selectedUnitType];
  if (!type || hasUnitTag(type, UNIT_TAG.AI_ONLY) || !model.roster[type.key]) return null;
  return type;
}

export class BudgetDeploymentPolicy {
  get canLaunch() {
    return this.model.placement.length > 0 && this.model.spentBudget <= this.model.budget;
  }

  constructor(model) {
    this.model = model;
  }

  availableCount(typeKey) {
    return this.model.roster[typeKey] ? Number.POSITIVE_INFINITY : 0;
  }

  togglePlacement(row, column) {
    if (this.model.mode !== MODE.DEPLOY || !GAME_CONFIG.playerZone.includes(column)) return false;
    const existing = placementIndex(this.model, row, column);
    if (existing >= 0) {
      this.model.placement.splice(existing, 1);
      return true;
    }
    const type = selectedDeployableType(this.model);
    if (!type || this.model.spentBudget + type.cost > this.model.budget) return false;
    this.model.placement.push({ row, column, type: type.key });
    return true;
  }

  commitBattle() {}
}

export class SupplyDeploymentPolicy {
  get canLaunch() {
    return this.model.placement.length > 0;
  }

  constructor(model) {
    this.model = model;
  }

  availableCount(typeKey) {
    return Math.max(0, (this.model.supply[typeKey] ?? 0) - this.model.deployedCount(typeKey));
  }

  togglePlacement(row, column) {
    if (this.model.mode !== MODE.DEPLOY || !GAME_CONFIG.playerZone.includes(column)) return false;
    const existing = placementIndex(this.model, row, column);
    if (existing >= 0) {
      this.model.placement.splice(existing, 1);
      return true;
    }
    const type = selectedDeployableType(this.model);
    if (!type || this.availableCount(type.key) <= 0) return false;
    this.model.placement.push({ row, column, type: type.key });
    return true;
  }

  commitBattle(formation) {
    const committed = formation.reduce((counts, unit) => {
      counts[unit.type] = (counts[unit.type] ?? 0) + 1;
      return counts;
    }, {});
    for (const [typeKey, count] of Object.entries(committed)) {
      this.model.supply[typeKey] = Math.max(0, (this.model.supply[typeKey] ?? 0) - count);
    }
  }
}
