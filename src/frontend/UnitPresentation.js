import { UNIT_ROLE } from '../data/gameConfig.js';
import { drawUnitGraphic } from './UnitGraphics.js';

const ROLE_PRESENTATION = Object.freeze({
  [UNIT_ROLE.GRUNT]: Object.freeze({ label: 'Grunt', shape: 'square' }),
  [UNIT_ROLE.RANGED]: Object.freeze({ label: 'Ranged', shape: 'triangle' }),
  [UNIT_ROLE.SUPPORT]: Object.freeze({ label: 'Support', shape: 'circle' }),
  [UNIT_ROLE.FLYING]: Object.freeze({ label: 'Flying', shape: 'wing' }),
  [UNIT_ROLE.SPECIALIST]: Object.freeze({ label: 'Specialist', shape: 'diamond' }),
  [UNIT_ROLE.STRUCTURE]: Object.freeze({ label: 'Structure', shape: 'hex' }),
});

export class UnitPresentation {
  constructor(documentRef) {
    this.document = documentRef;
  }

  createGraphic(type, { size = 48, color = '#38bdf8' } = {}) {
    const symbol = this.document.createElement('span');
    symbol.className = 'unit-symbol';
    const canvas = this.document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.setAttribute('aria-hidden', 'true');
    drawUnitGraphic(canvas.getContext('2d'), type.graphic ?? type.shape, size / 2, size / 2, size * 0.3, color);
    symbol.appendChild(canvas);
    return symbol;
  }

  createRole(type) {
    const presentation = ROLE_PRESENTATION[type.role] ?? { label: type.role, shape: 'square' };
    const role = this.document.createElement('div');
    role.className = 'unit-description-role';

    const icon = this.document.createElement('span');
    icon.className = `unit-role-icon ${presentation.shape}`;
    icon.setAttribute('aria-hidden', 'true');

    const label = this.document.createElement('span');
    label.textContent = presentation.label;
    role.append(icon, label);
    return role;
  }

  createDescription(type, { tone = 'player', includeCost = true, quantity = null, meta = '' } = {}) {
    const description = this.document.createElement('div');
    description.className = `unit-description ${tone}`;

    const header = this.document.createElement('div');
    header.className = 'unit-description-header';
    header.appendChild(this.createGraphic(type, { size: 56, color: tone === 'enemy' ? '#ff5d5d' : '#38bdf8' }));

    const identity = this.document.createElement('div');
    identity.className = 'unit-description-identity';
    const name = this.document.createElement('div');
    name.className = 'unit-description-name';
    name.textContent = type.name;
    identity.append(name, this.createRole(type));
    if (meta) {
      const detail = this.document.createElement('div');
      detail.className = 'unit-description-meta';
      detail.textContent = meta;
      identity.appendChild(detail);
    }
    header.appendChild(identity);

    if (quantity !== null) {
      const count = this.document.createElement('div');
      count.className = 'unit-description-quantity';
      count.textContent = `×${quantity}`;
      count.setAttribute('aria-label', `${quantity} units`);
      header.appendChild(count);
    } else if (includeCost) {
      const cost = this.document.createElement('div');
      cost.className = 'unit-description-cost';
      cost.innerHTML = `<strong>${type.cost}</strong><span>PTS</span>`;
      header.appendChild(cost);
    }

    const actionStat = type.action === 'heal' ? `HEAL ${type.healAmount}` : `ATK ${type.attack}`;
    const stats = this.document.createElement('div');
    stats.className = 'unit-description-stats';
    stats.innerHTML = `<span>HP <strong>${type.hp}</strong></span><span>${actionStat}</span>${type.range > 1 ? `<span>RNG <strong>${type.range}</strong></span>` : ''}`;

    const tags = this.document.createElement('div');
    tags.className = 'unit-description-tags';
    if (type.tags.length) {
      type.tags.forEach((tag) => {
        const chip = this.document.createElement('span');
        chip.textContent = tag;
        tags.appendChild(chip);
      });
    } else {
      tags.classList.add('empty');
      tags.textContent = 'No special abilities';
    }

    const behavior = this.document.createElement('div');
    behavior.className = 'unit-description-behavior';
    behavior.textContent = type.behavior;

    description.append(header, stats, tags, behavior);
    return description;
  }

  createRosterRow(type, selected, availableCount) {
    const select = this.document.createElement('button');
    select.className = `roster-card${selected ? ' selected' : ''}${availableCount <= 0 ? ' depleted' : ''}`;
    select.dataset.unitType = type.key;
    select.disabled = availableCount <= 0;
    select.setAttribute('aria-pressed', String(selected));
    select.setAttribute('aria-label', `${type.name}, ${availableCount} available`);
    select.appendChild(this.createGraphic(type, { size: 38 }));

    const name = this.document.createElement('span');
    name.className = 'rc-name';
    name.textContent = type.name;
    const count = this.document.createElement('span');
    count.className = 'rc-cost';
    count.textContent = `×${availableCount}`;
    count.setAttribute('aria-label', `${availableCount} available`);
    select.append(name, count);
    return select;
  }
}