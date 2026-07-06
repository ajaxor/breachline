import { GAME_CONFIG, MODE } from '../data/gameConfig.js';
import { MISSION_STATUS } from '../data/gameTypes.js';
import { OverlayController } from './OverlayController.js';
import { UnitPresentation } from './UnitPresentation.js';

const REQUIRED_ELEMENT_IDS = [
  'screenTitle', 'gameShell', 'btnStartGame', 'buildInfo', 'field', 'fieldWrap',
  'missionStrip', 'missionInfo', 'btnGoDeploy', 'budgetSpent', 'btnLaunch',
  'deployTopbar', 'resolveTopbar', 'deployHint', 'battleStatus', 'btnOpenLog',
  'phaseLabel', 'log', 'bannerOverlay', 'logSheet', 'sheetBackdrop', 'rosterList',
  'rosterExpand', 'rosterOverlay', 'rosterFullList', 'rosterClose', 'playerHpText',
  'enemyHpText', 'playerHpFill', 'enemyHpFill', 'draftOverlay', 'draftChoices',
  'draftProgress', 'unitInspector', 'clearLink', 'btnRedesign', 'logClose',
  'screenMissions', 'screenBattle',
];

function collectRequiredElements(documentRef) {
  const entries = REQUIRED_ELEMENT_IDS.map((id) => [id, documentRef.getElementById(id)]);
  const missing = entries.filter(([, element]) => !element).map(([id]) => id);
  if (missing.length) throw new Error(`GameView is missing required DOM elements: ${missing.join(', ')}`);
  return Object.fromEntries(entries);
}

export class GameView {
  constructor(documentRef = document) {
    this.document = documentRef;
    this.elements = collectRequiredElements(documentRef);
    this.unitPresentation = new UnitPresentation(documentRef);
    this.overlays = new OverlayController(documentRef);
  }

  createElement(tagName, { className = '', text = '', attributes = {} } = {}) {
    const element = this.document.createElement(tagName);
    if (className) element.className = className;
    if (text) element.textContent = text;
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
    return element;
  }

  render(model) {
    this.renderCampaign(model);
    this.renderSupply(model);
    this.renderBattleChrome(model);
    this.renderBases(model);
    this.renderLog(model);
  }

  renderBuildInfo(buildInfo) {
    this.elements.buildInfo.textContent = `v${buildInfo?.version || 'dev'} · ${buildInfo?.commit || 'local'}`;
  }

  enterGame() {
    this.elements.screenTitle.hidden = true;
    this.elements.gameShell.hidden = false;
  }

  renderCampaign(model) {
    this.elements.missionStrip.replaceChildren(...model.campaign.map((mission, index) => this.createMissionChip(mission, index, model.selectedMission)));
    this.elements.missionInfo.textContent = `Mission ${model.selectedMission + 1} of ${GAME_CONFIG.missionCount} — ${model.totalSupply} units in supply · hostile force budget ${model.mission.enemyBudget} pts.`;
    this.elements.btnGoDeploy.textContent = `Deploy Mission ${model.selectedMission + 1}`;
  }

  createMissionChip(mission, index, selectedMission) {
    const chip = this.createElement('button', { className: `mission-chip ${mission.status}${index === selectedMission ? ' selected' : ''}` });
    chip.disabled = mission.status === MISSION_STATUS.LOCKED;
    chip.dataset.mission = String(index);
    const number = this.createElement('span', { className: 'mc-num', text: String(index + 1) });
    const status = mission.status === MISSION_STATUS.CLEARED ? '✓ done' : mission.status;
    chip.append(number, this.createElement('span', { text: status }));
    return chip;
  }

  renderRoster(model) {
    const rows = model.rosterTypes.map((type) => this.unitPresentation.createRosterRow(type, type.key === model.selectedUnitType, model.availableCount(type.key)));
    if (!rows.length) rows.push(this.createElement('div', { className: 'empty-roster', text: 'Complete a reinforcement draft to add units to your supply.' }));
    this.elements.rosterList.replaceChildren(...rows);
  }

  renderExpandedRoster(model) {
    const cards = model.rosterTypes.map((type) => {
      const card = this.createElement('button', { className: `roster-full-card${type.key === model.selectedUnitType ? ' selected' : ''}` });
      card.dataset.fullRosterUnit = type.key;
      card.appendChild(this.unitPresentation.createDescription(type, { label: `${model.availableCount(type.key)} available · ${model.supply[type.key]} total`, includeCost: false }));
      return card;
    });
    this.elements.rosterFullList.replaceChildren(...cards);
  }

  openRoster(model) {
    this.renderExpandedRoster(model);
    this.overlays.open(this.elements.rosterOverlay, {
      close: () => this.closeRoster(),
      initialFocus: () => this.elements.rosterFullList.querySelector('button'),
    });
  }

  closeRoster() {
    if (this.overlays.active?.element === this.elements.rosterOverlay) this.overlays.close();
    else {
      this.elements.rosterOverlay.classList.remove('open');
      this.elements.rosterOverlay.hidden = true;
    }
  }

  renderDraft(model) {
    this.elements.draftProgress.textContent = model.pendingDrafts > 1 ? `${model.pendingDrafts} selections remaining` : 'Final selection';
    const cards = model.draftChoices.map((type, index) => {
      const card = this.createElement('button', { className: 'draft-card' });
      card.dataset.draftUnit = type.key;
      card.style.setProperty('--draft-index', String(index));
      card.appendChild(this.unitPresentation.createDescription(type, { label: 'Draft option', includeCost: false, quantity: type.draftCount }));
      return card;
    });
    this.elements.draftChoices.replaceChildren(...cards);
    this.elements.draftChoices.classList.remove('refreshing');
    void this.elements.draftChoices.offsetWidth;
    this.elements.draftChoices.classList.add('refreshing');
  }

  openDraft() {
    this.overlays.open(this.elements.draftOverlay, {
      initialFocus: () => this.elements.draftChoices.querySelector('button'),
    });
  }

  closeDraft() {
    if (this.overlays.active?.element === this.elements.draftOverlay) this.overlays.close();
    else {
      this.elements.draftOverlay.classList.remove('open');
      this.elements.draftOverlay.hidden = true;
    }
  }

  showUnitInspector(type, label, tone = 'enemy') {
    this.elements.unitInspector.className = `unit-inspector ${tone}`;
    this.elements.unitInspector.replaceChildren(this.unitPresentation.createDescription(type, { label, tone }));
    this.elements.unitInspector.hidden = false;
  }

  clearUnitInspector() {
    this.elements.unitInspector.hidden = true;
    this.elements.unitInspector.replaceChildren();
    this.elements.unitInspector.className = 'unit-inspector';
  }

  renderSupply(model) {
    this.elements.budgetSpent.textContent = `${model.deployedSupply} deployed · ${model.totalSupply - model.deployedSupply} reserve`;
    this.elements.btnLaunch.disabled = !model.canLaunch;
  }

  renderBattleChrome(model) {
    const battling = model.mode === MODE.BATTLE;
    this.elements.deployTopbar.hidden = battling;
    this.elements.resolveTopbar.hidden = !battling;
    this.elements.deployHint.hidden = battling;
    this.elements.battleStatus.hidden = !battling;
    this.elements.btnOpenLog.hidden = !battling;
    this.elements.rosterExpand.disabled = battling;
    this.elements.phaseLabel.textContent = `PHASE: ${battling ? 'BATTLE' : 'DEPLOYMENT'} — MISSION ${model.selectedMission + 1}/${GAME_CONFIG.missionCount}`;
    this.elements.battleStatus.textContent = `TICK ${model.tickCount} · YOU ${model.livingPlayerCount} · HOSTILE ${model.livingEnemyCount}`;
  }

  renderBases(model) {
    this.elements.playerHpText.textContent = `${model.playerBaseHp}/${GAME_CONFIG.baseHp}`;
    this.elements.enemyHpText.textContent = `${model.enemyBaseHp}/${GAME_CONFIG.baseHp}`;
    this.elements.playerHpFill.style.width = `${model.playerBaseHp / GAME_CONFIG.baseHp * 100}%`;
    this.elements.enemyHpFill.style.width = `${model.enemyBaseHp / GAME_CONFIG.baseHp * 100}%`;
  }

  renderLog(model) {
    const rows = model.logEntries.map((entry) => this.createElement('div', { className: entry.cssClass, text: entry.message }));
    this.elements.log.replaceChildren(...rows);
    this.elements.log.scrollTop = this.elements.log.scrollHeight;
  }

  setActiveTab(tab) {
    this.document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
    const screen = tab === 'missions' ? this.elements.screenMissions : this.elements.screenBattle;
    screen.classList.add('active');
    this.document.querySelectorAll('.tab-btn').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
  }

  openSheet(element) {
    this.document.querySelectorAll('.sheet').forEach((sheet) => sheet.classList.remove('open'));
    element.classList.add('open');
    this.elements.sheetBackdrop.classList.add('open');
    this.overlays.open(element, { close: () => this.closeSheets(), initialFocus: () => element.querySelector('button') });
  }

  closeSheets() {
    this.document.querySelectorAll('.sheet').forEach((sheet) => sheet.classList.remove('open'));
    this.elements.sheetBackdrop.classList.remove('open');
    if (this.overlays.active?.element?.classList.contains('sheet')) this.overlays.close();
  }

  clearBanner() {
    if (this.overlays.active?.element === this.elements.bannerOverlay) this.overlays.close({ restoreFocus: false });
    this.elements.bannerOverlay.className = 'banner-overlay';
    this.elements.bannerOverlay.replaceChildren();
  }

  showResult(result, hasNextMission) {
    this.clearBanner();
    const banner = this.elements.bannerOverlay;
    banner.className = `banner-overlay show ${result.cssClass}`;
    const text = this.createElement('div', { className: 'banner-text', text: result.text });
    const action = this.createElement('button', { className: 'primary', text: result.playerWon ? 'Draft Reinforcement' : 'Retry Mission' });
    action.dataset.resultAction = '';
    banner.append(text, action);
    if (result.playerWon && !hasNextMission) banner.appendChild(this.createElement('div', { className: 'helptext', text: 'Campaign complete — claim your final reinforcement.' }));
    this.overlays.open(banner, { initialFocus: () => action });
  }

  dispose() {
    this.overlays.dispose();
  }
}
