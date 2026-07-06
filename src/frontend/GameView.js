import { GAME_CONFIG, MODE } from '../data/gameConfig.js';
import { UnitPresentation } from './UnitPresentation.js';

export class GameView {
  constructor(documentRef = document) {
    this.document = documentRef;
    this.unitPresentation = new UnitPresentation(documentRef);
    this.elements = Object.fromEntries(['screenTitle','gameShell','btnStartGame','buildInfo','field','fieldWrap','missionStrip','missionInfo','btnGoDeploy','budgetSpent','btnLaunch','deployTopbar','resolveTopbar','deployHint','battleStatus','btnOpenLog','phaseLabel','log','bannerOverlay','logSheet','sheetBackdrop','rosterList','rosterExpand','rosterOverlay','rosterFullList','rosterClose','playerHpText','enemyHpText','playerHpFill','enemyHpFill','draftOverlay','draftChoices','draftProgress','unitInspector'].map((id) => [id, documentRef.getElementById(id)]));
  }

  render(model) { this.renderCampaign(model); this.renderSupply(model); this.renderBattleChrome(model); this.renderBases(model); this.renderLog(model); }
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
      chip.innerHTML = `<span class="mc-num">${index + 1}</span><span>${mission.status === 'cleared' ? '✓ done' : mission.status === 'locked' ? 'locked' : 'available'}</span>`;
      strip.appendChild(chip);
    });
    this.elements.missionInfo.textContent = `Mission ${model.selectedMission + 1} of ${GAME_CONFIG.missionCount} — ${model.totalSupply} units in supply · hostile force budget ${model.mission.enemyBudget} pts.`;
    this.elements.btnGoDeploy.textContent = `Deploy Mission ${model.selectedMission + 1}`;
  }

  renderRoster(model) {
    const list = this.elements.rosterList;
    list.innerHTML = '';
    model.rosterTypes.forEach((type) => list.appendChild(this.unitPresentation.createRosterRow(type, type.key === model.selectedUnitType, model.availableCount(type.key))));
    if (!model.rosterTypes.length) list.innerHTML = '<div class="empty-roster">Complete your opening drafts to assemble a roster.</div>';
    requestAnimationFrame(() => this.fitRosterNames());
  }

  fitRosterNames() {
    this.elements.rosterList.querySelectorAll('.rc-name').forEach((name) => {
      let size = 16;
      name.style.fontSize = `${size}px`;
      while (size > 10 && name.scrollWidth > name.clientWidth) {
        size -= 1;
        name.style.fontSize = `${size}px`;
      }
    });
  }

  renderExpandedRoster(model) {
    const list = this.elements.rosterFullList;
    list.innerHTML = '';
    model.rosterTypes.forEach((type) => {
      const card = this.document.createElement('button');
      card.className = `roster-full-card${type.key === model.selectedUnitType ? ' selected' : ''}`;
      card.dataset.fullRosterUnit = type.key;
      card.appendChild(this.unitPresentation.createDescription(type, { label: `${model.availableCount(type.key)} available · ${model.supply[type.key]} total`, includeCost: false }));
      list.appendChild(card);
    });
  }

  openRoster(model) {
    this.renderExpandedRoster(model);
    this.elements.rosterOverlay.hidden = false;
    requestAnimationFrame(() => this.elements.rosterOverlay.classList.add('open'));
  }

  closeRoster() {
    this.elements.rosterOverlay.classList.remove('open');
    this.elements.rosterOverlay.hidden = true;
  }

  renderDraft(model) {
    this.elements.draftProgress.textContent = model.pendingDrafts > 1 ? `${model.pendingDrafts} selections remaining` : 'Final selection';
    this.elements.draftChoices.innerHTML = '';
    model.draftChoices.forEach((type, index) => {
      const card = this.document.createElement('button');
      card.className = 'draft-card';
      card.dataset.draftUnit = type.key;
      card.style.setProperty('--draft-index', String(index));
      card.appendChild(this.unitPresentation.createDescription(type, { label: `Draft ${type.draftCount} units`, includeCost: false }));
      this.elements.draftChoices.appendChild(card);
    });
    this.elements.draftChoices.classList.remove('refreshing');
    void this.elements.draftChoices.offsetWidth;
    this.elements.draftChoices.classList.add('refreshing');
  }

  openDraft() {
    this.elements.draftOverlay.hidden = false;
    requestAnimationFrame(() => this.elements.draftOverlay.classList.add('open'));
  }

  closeDraft() {
    this.elements.draftOverlay.classList.remove('open');
    this.elements.draftOverlay.hidden = true;
  }

  showUnitInspector(type, label, tone = 'enemy') {
    this.elements.unitInspector.innerHTML = '';
    this.elements.unitInspector.className = `unit-inspector ${tone}`;
    this.elements.unitInspector.appendChild(this.unitPresentation.createDescription(type, { label, tone }));
    this.elements.unitInspector.hidden = false;
  }

  clearUnitInspector() {
    this.elements.unitInspector.hidden = true;
    this.elements.unitInspector.innerHTML = '';
    this.elements.unitInspector.className = 'unit-inspector';
  }

  renderSupply(model) { this.elements.budgetSpent.textContent = `${model.deployedSupply} deployed · ${model.totalSupply - model.deployedSupply} reserve`; this.elements.btnLaunch.disabled = !model.canLaunch; }
  renderBattleChrome(model) { const battling = model.mode === MODE.BATTLE; this.elements.deployTopbar.hidden = battling; this.elements.resolveTopbar.hidden = !battling; this.elements.deployHint.hidden = battling; this.elements.battleStatus.hidden = !battling; this.elements.btnOpenLog.hidden = !battling; this.elements.rosterExpand.disabled = battling; this.elements.phaseLabel.textContent = `PHASE: ${battling ? 'BATTLE' : 'DEPLOYMENT'} — MISSION ${model.selectedMission + 1}/${GAME_CONFIG.missionCount}`; this.elements.battleStatus.textContent = `TICK ${model.tickCount} · YOU ${model.livingPlayerCount} · HOSTILE ${model.livingEnemyCount}`; }
  renderBases(model) { this.elements.playerHpText.textContent = `${model.playerBaseHp}/${GAME_CONFIG.baseHp}`; this.elements.enemyHpText.textContent = `${model.enemyBaseHp}/${GAME_CONFIG.baseHp}`; this.elements.playerHpFill.style.width = `${model.playerBaseHp / GAME_CONFIG.baseHp * 100}%`; this.elements.enemyHpFill.style.width = `${model.enemyBaseHp / GAME_CONFIG.baseHp * 100}%`; }
  renderLog(model) { this.elements.log.innerHTML = ''; model.logEntries.forEach((entry) => { const row = this.document.createElement('div'); row.className = entry.cssClass; row.textContent = entry.message; this.elements.log.appendChild(row); }); this.elements.log.scrollTop = this.elements.log.scrollHeight; }
  setActiveTab(tab) { this.document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active')); this.document.getElementById(tab === 'missions' ? 'screenMissions' : 'screenBattle').classList.add('active'); this.document.querySelectorAll('.tab-btn').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab)); }
  openSheet(element) { this.document.querySelectorAll('.sheet').forEach((sheet) => sheet.classList.remove('open')); element.classList.add('open'); this.elements.sheetBackdrop.classList.add('open'); }
  closeSheets() { this.document.querySelectorAll('.sheet').forEach((sheet) => sheet.classList.remove('open')); this.elements.sheetBackdrop.classList.remove('open'); }
  clearBanner() { this.elements.bannerOverlay.className = 'banner-overlay'; this.elements.bannerOverlay.innerHTML = ''; }
  showResult(result, hasNextMission) { this.clearBanner(); const banner = this.elements.bannerOverlay; banner.className = `banner-overlay show ${result.cssClass}`; banner.innerHTML = `<div class="banner-text">${result.text}</div><button class="primary" data-result-action>${result.playerWon ? 'Draft Reinforcement' : 'Retry Mission'}</button>${result.playerWon && !hasNextMission ? '<div class="helptext">Campaign complete — claim your final reinforcement.</div>' : ''}`; }
}