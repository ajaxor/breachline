import { GAME_CONFIG, MODE } from '../data/gameConfig.js';
import { CanvasRenderer } from './CanvasRenderer.js';

export class GameView {
  constructor(documentRef = document) {
    this.document = documentRef;
    this.elements = Object.fromEntries(['screenTitle','gameShell','btnStartGame','buildInfo','field','fieldWrap','missionStrip','missionInfo','btnGoDeploy','budgetSpent','budgetFill','btnLaunch','deployTopbar','resolveTopbar','deployHint','battleStatus','btnOpenLog','phaseLabel','log','bannerOverlay','logSheet','sheetBackdrop','rosterList','playerHpText','enemyHpText','playerHpFill','enemyHpFill','draftOverlay','draftChoices','draftProgress','unitInspector'].map((id) => [id, documentRef.getElementById(id)]));
  }

  render(model) { this.renderCampaign(model); this.renderBudget(model); this.renderBattleChrome(model); this.renderBases(model); this.renderLog(model); }
  renderBuildInfo(buildInfo) { this.elements.buildInfo.textContent = `v${buildInfo?.version || 'dev'} · ${buildInfo?.commit || 'local'}`; }
  enterGame() { this.elements.screenTitle.hidden = true; this.elements.gameShell.hidden = false; }

  renderCampaign(model) {
    const strip = this.elements.missionStrip;
    strip.innerHTML = '';
    model.campaign.forEach((mission, index) => {
      const chip = this.document.createElement('button');
      chip.className = `mission-chip ${mission.status}${index === model.selectedMission ? ' selected' : ''}`;
      chip.disabled = mission.status === 'locked';
      chip.dataset.mission = String(index);
      chip.innerHTML = `<span class="mc-num">${index + 1}</span><span>${mission.status === 'cleared' ? '✓ done' : mission.status === 'locked' ? 'locked' : `${mission.playerBudget}pt`}</span>`;
      strip.appendChild(chip);
    });
    this.elements.missionInfo.textContent = `Mission ${model.selectedMission + 1} of ${GAME_CONFIG.missionCount} — your budget ${model.mission.playerBudget} pts · hostile force budget ${model.mission.enemyBudget} pts.`;
    this.elements.btnGoDeploy.textContent = `Deploy Mission ${model.selectedMission + 1}`;
  }

  renderRoster(model) {
    const list = this.elements.rosterList;
    list.innerHTML = '';
    model.rosterTypes.forEach((type) => {
      const available = model.availableCount(type.key);
      const card = this.document.createElement('button');
      card.className = `roster-card${type.key === model.selectedUnitType ? ' selected' : ''}${available === 0 ? ' exhausted' : ''}`;
      card.dataset.unitType = type.key;
      const actionStat = type.action === 'heal' ? `HEAL ${type.healAmount}` : `ATK ${type.attack}`;
      const rangeStat = type.range > 1 ? ` · RNG ${type.range}` : '';
      const tags = type.tags.length ? `<span class="rc-tags">${type.tags.join(' · ')}</span>` : '';
      card.innerHTML = `<span class="rc-info"><span class="rc-name">${type.name}</span><span class="rc-stats">HP ${type.hp} · ${actionStat}${rangeStat}</span>${tags}<span class="rc-behavior">${type.behavior}</span></span><span class="rc-cost">${type.cost}<small>${available}/${model.roster[type.key]}</small></span>`;
      card.prepend(this.createUnitGraphic(type));
      list.appendChild(card);
    });
    if (!model.rosterTypes.length) list.innerHTML = '<div class="empty-roster">Complete your opening drafts to assemble a roster.</div>';
  }

  renderDraft(model) {
    this.elements.draftProgress.textContent = model.pendingDrafts > 1 ? `${model.pendingDrafts} selections remaining` : 'Final selection';
    this.elements.draftChoices.innerHTML = '';
    model.draftChoices.forEach((type) => {
      const card = this.document.createElement('button');
      card.className = 'draft-card';
      card.dataset.draftUnit = type.key;
      const actionStat = type.action === 'heal' ? `HEAL ${type.healAmount}` : `ATK ${type.attack}`;
      const rangeStat = type.range > 1 ? ` · RNG ${type.range}` : '';
      card.innerHTML = `<span class="draft-name">${type.name}</span><span class="draft-stats">${type.cost} pts · HP ${type.hp} · ${actionStat}${rangeStat}</span><span class="draft-behavior">${type.behavior}</span>`;
      card.prepend(this.createUnitGraphic(type));
      this.elements.draftChoices.appendChild(card);
    });
  }

  openDraft() { this.elements.draftOverlay.hidden = false; }
  closeDraft() { this.elements.draftOverlay.hidden = true; }

  showUnitInspector(type, label) {
    const actionStat = type.action === 'heal' ? `HEAL ${type.healAmount}` : `ATK ${type.attack}`;
    const rangeStat = type.range > 1 ? ` · RNG ${type.range}` : '';
    this.elements.unitInspector.innerHTML = `<div class="inspector-label">${label}</div><div class="inspector-name">${type.name}</div><div class="inspector-stats">HP ${type.hp} · ${actionStat}${rangeStat}</div><div class="inspector-tags">${type.tags.join(' · ')}</div><div class="inspector-behavior">${type.behavior}</div>`;
    this.elements.unitInspector.hidden = false;
  }
  clearUnitInspector() { this.elements.unitInspector.hidden = true; this.elements.unitInspector.innerHTML = ''; }

  createUnitGraphic(type) {
    const symbol = this.document.createElement('span');
    symbol.className = 'unit-symbol';
    const canvas = this.document.createElement('canvas');
    const size = 48;
    canvas.width = size; canvas.height = size; canvas.setAttribute('aria-hidden', 'true');
    const renderer = new CanvasRenderer(canvas, { clientWidth: size, clientHeight: size });
    renderer.drawUnitGraphic(type.graphic ?? type.shape, size / 2, size / 2, size * 0.3, '#38bdf8');
    symbol.appendChild(canvas);
    return symbol;
  }

  renderBudget(model) { this.elements.budgetSpent.textContent = `${model.spentBudget} / ${model.budget}`; this.elements.budgetFill.style.width = `${Math.min(100, model.spentBudget / model.budget * 100)}%`; this.elements.budgetFill.classList.toggle('over', model.spentBudget > model.budget); this.elements.btnLaunch.disabled = !model.canLaunch; }
  renderBattleChrome(model) { const battling = model.mode === MODE.BATTLE; this.elements.deployTopbar.hidden = battling; this.elements.resolveTopbar.hidden = !battling; this.elements.deployHint.hidden = battling; this.elements.battleStatus.hidden = !battling; this.elements.btnOpenLog.hidden = !battling; this.elements.phaseLabel.textContent = `PHASE: ${battling ? 'BATTLE' : 'DEPLOYMENT'} — MISSION ${model.selectedMission + 1}/${GAME_CONFIG.missionCount}`; this.elements.battleStatus.textContent = `TICK ${model.tickCount} · YOU ${model.livingPlayerCount} · HOSTILE ${model.livingEnemyCount}`; }
  renderBases(model) { this.elements.playerHpText.textContent = `${model.playerBaseHp}/${GAME_CONFIG.baseHp}`; this.elements.enemyHpText.textContent = `${model.enemyBaseHp}/${GAME_CONFIG.baseHp}`; this.elements.playerHpFill.style.width = `${model.playerBaseHp / GAME_CONFIG.baseHp * 100}%`; this.elements.enemyHpFill.style.width = `${model.enemyBaseHp / GAME_CONFIG.baseHp * 100}%`; }
  renderLog(model) { this.elements.log.innerHTML = ''; model.logEntries.forEach((entry) => { const row = this.document.createElement('div'); row.className = entry.cssClass; row.textContent = entry.message; this.elements.log.appendChild(row); }); this.elements.log.scrollTop = this.elements.log.scrollHeight; }
  setActiveTab(tab) { this.document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active')); this.document.getElementById(tab === 'missions' ? 'screenMissions' : 'screenBattle').classList.add('active'); this.document.querySelectorAll('.tab-btn').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab)); }
  openSheet(element) { this.document.querySelectorAll('.sheet').forEach((sheet) => sheet.classList.remove('open')); element.classList.add('open'); this.elements.sheetBackdrop.classList.add('open'); }
  closeSheets() { this.document.querySelectorAll('.sheet').forEach((sheet) => sheet.classList.remove('open')); this.elements.sheetBackdrop.classList.remove('open'); }
  clearBanner() { this.elements.bannerOverlay.className = 'banner-overlay'; this.elements.bannerOverlay.innerHTML = ''; }
  showResult(result, hasNextMission) { this.clearBanner(); const banner = this.elements.bannerOverlay; banner.className = `banner-overlay show ${result.cssClass}`; banner.innerHTML = `<div class="banner-text">${result.text}</div><button class="primary" data-result-action>${result.playerWon ? 'Draft Reinforcement' : 'Retry Mission'}</button>${result.playerWon && !hasNextMission ? '<div class="helptext">Campaign complete — claim your final reinforcement.</div>' : ''}`; }
}
