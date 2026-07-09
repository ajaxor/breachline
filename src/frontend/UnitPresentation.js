import { UNIT_ROLE, UNIT_TAG, hasUnitTag } from '../data/gameConfig.js';
import { drawUnitGraphic } from './UnitGraphics.js';

const ROLE_LABEL = Object.freeze({
  [UNIT_ROLE.MELEE]: 'Melee',
  [UNIT_ROLE.RANGED]: 'Ranged',
  [UNIT_ROLE.SUPPORT]: 'Support',
  [UNIT_ROLE.FLYING]: 'Flying',
  [UNIT_ROLE.SPECIALIST]: 'Specialist',
  [UNIT_ROLE.WALL]: 'Wall',
  [UNIT_ROLE.STRUCTURE]: 'Structure',
});

const TAG_DESCRIPTION = Object.freeze({
  [UNIT_TAG.AGILE]: 'Dodges the first attack in each battle by moving into an open lane to the left or right, when possible.',
  [UNIT_TAG.SCATTER]: 'When blocked from moving forward, moves sideways into an open adjacent lane when possible.',
  [UNIT_TAG.STATIONARY]: 'Cannot move from its deployed position.',
  [UNIT_TAG.SWIVEL]: 'Can target units in other lanes instead of being limited to its own lane.',
  [UNIT_TAG.FAST_ATTACK]: 'Can attack during the same turn that it moves.',
  [UNIT_TAG.STEALTH]: 'Cannot be targeted until an enemy unit is adjacent to it.',
  [UNIT_TAG.AI_ONLY]: 'Only hostile forces can deploy this unit.',
  [UNIT_TAG.PLAYER_ONLY]: 'Only the player can draft and deploy this unit.',
  [UNIT_TAG.FLYING]: 'Continuously advances over other units and can move and attack together. Only flying or anti-air units can target it.',
  [UNIT_TAG.ANTI_AIR]: 'Can target flying units as well as ground units.',
  [UNIT_TAG.BOMB]: 'Detonates at its own position when it attacks, breaches, or is destroyed, damaging every adjacent enemy and destroying itself.',
  [UNIT_TAG.AOE]: 'Deals full attack damage to enemies adjacent to the primary target or explosion.',
  [UNIT_TAG.HEAL]: 'Restores health to the nearest damaged allied unit in range instead of attacking enemies.',
  [UNIT_TAG.SALVO]: 'Attacks every valid enemy in range during the same combat action.',
  [UNIT_TAG.PUSH]: 'Pushes an adjacent enemy one cell backward and advances into the space it leaves. A blocked or edge push does nothing.',
  [UNIT_TAG.CHARGE]: 'Moves at double speed until its first attack. That first attack has double attack power, then Charge is spent.',
  [UNIT_TAG.RELOAD]: 'After attacking, must spend the next two turns reloading before it can attack again. It may still move while reloading.',
  [UNIT_TAG.FORMATION]: 'Advances only when every surviving allied Formation unit can move forward together.',
  [UNIT_TAG.SHIELD]: 'Reduces each hit against allied units within the aura by the listed shield value. Multiple shield auras do not stack.',
  [UNIT_TAG.ENHANCE]: 'Adds the listed damage bonus to attacks made by allied units within the aura. Multiple enhancement auras do not stack.',
  [UNIT_TAG.STUN_FIELD]: 'Stuns enemies aligned across the same battlefield row. The stun persists briefly after they leave the field.',
  [UNIT_TAG.JAMMER]: 'Cloaks allied units within the aura. Cloaked units remain targetable by adjacent enemies.',
  [UNIT_TAG.THORNS]: 'Reflects a portion of melee damage back at the attacker.',
  [UNIT_TAG.FACTORY]: 'Produces a weak unit into the lane ahead whenever production is ready and the space is clear.',
});

const HIDDEN_TAGS = new Set([UNIT_TAG.FLYING, UNIT_TAG.AI_ONLY, UNIT_TAG.PLAYER_ONLY]);

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

  createDescription(type, { tone = 'player', includeCost = true, includeTechLevel = false, quantity = null } = {}) {
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
    const actionLabel = heals ? 'HEAL' : 'ATK';
    const actionValue = heals ? type.healAmount : type.attack;
    details.innerHTML = `<span class="unit-description-stat">HP <strong>${type.hp}</strong></span><span class="unit-description-stat">${actionLabel} <strong>${actionValue}</strong></span>${type.range > 1 ? `<span class="unit-description-stat">RNG <strong>${type.range}</strong></span>` : ''}${includeTechLevel ? `<span class="unit-description-stat">TECH <strong>${type.techLevel}</strong></span>` : ''}`;

    const tooltip = this.document.createElement('div');
    tooltip.className = 'unit-ability-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.hidden = true;

    type.tags.filter((tag) => !HIDDEN_TAGS.has(tag)).forEach((tag) => {
      details.appendChild(this.createTagChip(tag, tooltip, description));
    });

    description.append(header, details, tooltip);
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
