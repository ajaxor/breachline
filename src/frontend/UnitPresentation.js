import { UNIT_ROLE, UNIT_TAG, hasUnitTag } from '../data/gameConfig.js';
import { drawUnitGraphic } from './UnitGraphics.js';

const ROLE_LABEL = Object.freeze({
  [UNIT_ROLE.MELEE]: 'Melee',
  [UNIT_ROLE.RANGED]: 'Ranged',
  [UNIT_ROLE.SUPPORT]: 'Support',
  [UNIT_ROLE.FLYING]: 'Flying',
  [UNIT_ROLE.SPECIALIST]: 'Specialist',
  [UNIT_ROLE.STRUCTURE]: 'Structure',
});

const TAG_DESCRIPTION = Object.freeze({
  [UNIT_TAG.AGILE]: 'Dodges the first attack in each battle by moving into an open lane to the left or right, when possible.',
  [UNIT_TAG.STATIONARY]: 'Cannot move from its deployed position.',
  [UNIT_TAG.SWIVEL]: 'Can target units in other lanes instead of being limited to its own lane.',
  [UNIT_TAG.FAST_ATTACK]: 'Can attack during the same turn that it moves.',
  [UNIT_TAG.STEALTH]: 'Cannot be targeted until an enemy unit is adjacent to it.',
  [UNIT_TAG.AI_ONLY]: 'Only hostile forces can deploy this unit.',
  [UNIT_TAG.FLYING]: 'Continuously advances over other units and can move and attack together. Only flying or anti-air units can target it.',
  [UNIT_TAG.ANTI_AIR]: 'Can target flying units as well as ground units.',
  [UNIT_TAG.BOMB]: 'Explodes when it attacks, dealing increased damage and destroying itself.',
  [UNIT_TAG.AOE]: 'Also damages enemies in the lanes immediately beside the target.',
  [UNIT_TAG.HEAL]: 'Restores health to damaged allied units instead of attacking enemies.',
  [UNIT_TAG.SALVO]: 'Attacks every valid enemy in range at the same time.',
  [UNIT_TAG.PUSH]: 'Deals no attack damage, but shoves an adjacent enemy one cell backward when the space is open.',
  [UNIT_TAG.CHARGE]: 'Moves two cells when that movement closes the final distance into melee range.',
  [UNIT_TAG.FAST]: 'Permanently moves up to two cells each battle tick.',
  [UNIT_TAG.FORMATION]: 'Moves only when every allied Formation unit can advance in lock step.',
  [UNIT_TAG.SHIELD]: 'Reduces damage taken by nearby allied units.',
  [UNIT_TAG.ENHANCE]: 'Increases damage dealt by nearby allied units.',
  [UNIT_TAG.STUN_FIELD]: 'Stuns enemies aligned with this unit.',
  [UNIT_TAG.JAMMER]: 'Cloaks nearby allied units.',
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
    drawUnitGraphic(canvas.getContext('2d'), type.graphic ?? type.shape, size / 2, size / 2, size * 0.3, color, type.role);
    symbol.appendChild(canvas);
    return symbol;
  }

  createRole(type) {
    const role = this.document.createElement('div');
    role.className = 'unit-description-role';
    role.textContent = ROLE_LABEL[type.role] ?? type.role;
    return role;
  }

  createTagChip(tag, tooltip, description) {
    const chip = this.document.createElement('span');
    chip.className = 'unit-description-tag';
    chip.textContent = tag;
    chip.tabIndex = 0;
    chip.setAttribute('role', 'button');
    chip.setAttribute('aria-expanded', 'false');
    chip.setAttribute('aria-label', `${tag} ability: show explanation`);

    const toggleTooltip = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const opening = tooltip.hidden || tooltip.dataset.tag !== tag;
      description.querySelectorAll('.unit-description-tag[aria-expanded="true"]').forEach((other) => other.setAttribute('aria-expanded', 'false'));
      if (!opening) {
        tooltip.hidden = true;
        delete tooltip.dataset.tag;
        return;
      }
      tooltip.dataset.tag = tag;
      tooltip.replaceChildren();
      const title = this.document.createElement('strong');
      title.textContent = tag;
      const text = this.document.createElement('span');
      text.textContent = TAG_DESCRIPTION[tag] ?? 'This unit has a special combat ability.';
      tooltip.append(title, text);
      tooltip.hidden = false;
      chip.setAttribute('aria-expanded', 'true');
    };

    chip.addEventListener('click', toggleTooltip);
    chip.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') toggleTooltip(event);
      if (event.key === 'Escape' && !tooltip.hidden) {
        event.preventDefault();
        event.stopPropagation();
        tooltip.hidden = true;
        delete tooltip.dataset.tag;
        chip.setAttribute('aria-expanded', 'false');
      }
    });
    return chip;
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

    const details = this.document.createElement('div');
    details.className = 'unit-description-details';
    const heals = hasUnitTag(type, UNIT_TAG.HEAL);
    const pushes = hasUnitTag(type, UNIT_TAG.PUSH);
    const actionLabel = heals ? 'HEAL' : pushes ? 'PUSH' : 'ATK';
    const actionValue = heals ? type.healAmount : pushes ? '1' : type.attack;
    details.innerHTML = `<span class="unit-description-stat">HP <strong>${type.hp}</strong></span><span class="unit-description-stat">${actionLabel} <strong>${actionValue}</strong></span>${type.range > 1 ? `<span class="unit-description-stat">RNG <strong>${type.range}</strong></span>` : ''}`;

    const tooltip = this.document.createElement('div');
    tooltip.className = 'unit-ability-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.hidden = true;

    type.tags.filter((tag) => tag !== UNIT_TAG.FLYING).forEach((tag) => {
      details.appendChild(this.createTagChip(tag, tooltip, description));
    });

    const behavior = this.document.createElement('div');
    behavior.className = 'unit-description-behavior';
    behavior.textContent = type.behavior;

    description.append(header, details, tooltip, behavior);
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