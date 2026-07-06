import { CanvasRenderer } from './CanvasRenderer.js';

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
    const renderer = new CanvasRenderer(canvas, { clientWidth: size, clientHeight: size });
    renderer.drawUnitGraphic(type.graphic ?? type.shape, size / 2, size / 2, size * 0.3, color);
    symbol.appendChild(canvas);
    return symbol;
  }

  createDescription(type, { label = '', tone = 'player', includeCost = true } = {}) {
    const description = this.document.createElement('div');
    description.className = `unit-description ${tone}`;

    const header = this.document.createElement('div');
    header.className = 'unit-description-header';
    header.appendChild(this.createGraphic(type, { size: 56, color: tone === 'enemy' ? '#ff5d5d' : '#38bdf8' }));

    const identity = this.document.createElement('div');
    identity.className = 'unit-description-identity';
    if (label) {
      const eyebrow = this.document.createElement('div');
      eyebrow.className = 'unit-description-label';
      eyebrow.textContent = label;
      identity.appendChild(eyebrow);
    }
    const name = this.document.createElement('div');
    name.className = 'unit-description-name';
    name.textContent = type.name;
    identity.appendChild(name);
    header.appendChild(identity);

    if (includeCost) {
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