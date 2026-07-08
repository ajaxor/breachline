import { UNIT_TYPES } from '../data/gameConfig.js';
import { GameController } from './GameController.js';

export class FlowGameController extends GameController {
  initialize() {
    if (this.initialized) return;
    this.initialized = true;
    this.bindEvents();
    this.view.renderBuildInfo(this.buildInfo);
    this.view.showTitle();
  }

  bindEvents() {
    const { elements } = this.view;
    this.listen(elements.btnStartGame, 'click', () => this.view.openCampaignMenu());
    this.listen(elements.btnBeginCampaign, 'click', () => this.startCampaign());
    this.listen(elements.btnSandbox, 'click', () => this.startSandbox());
    this.listen(elements.btnCampaignBack, 'click', () => this.view.closeCampaignMenu());
    this.listen(elements.btnBack, 'click', () => this.activateTab('missions'));
    this.listen(elements.btnSurrender, 'click', () => this.surrenderCampaign());
    this.listen(elements.btnReinforce, 'click', () => this.openReinforcements());
    this.listen(elements.btnDraftBack, 'click', () => this.view.closeDraft());
    this.listen(elements.btnGoDeploy, 'click', () => this.activateTab('battle'));
    this.listen(elements.missionStrip, 'click', (event) => this.handleMissionClick(event));
    this.listen(elements.rosterList, 'click', (event) => this.handleRosterClick(event));
    this.listen(elements.rosterExpand, 'click', () => this.view.openRoster(this.model));
    this.listen(elements.rosterClose, 'click', () => this.view.closeRoster());
    this.listen(elements.rosterOverlay, 'click', (event) => this.handleExpandedRosterClick(event));
    this.listen(elements.draftChoices, 'click', (event) => this.handleDraftClick(event));
    this.listen(elements.field, 'click', (event) => this.handleFieldClick(event));
    this.listen(elements.clearLink, 'click', () => { this.model.clearPlacement(); this.clearUnitInspection(); this.refresh(); });
    this.listen(elements.btnLaunch, 'click', () => this.startBattle());
    this.listen(elements.btnOpenLog, 'click', () => this.view.openSheet(elements.logSheet));
    this.listen(elements.logClose, 'click', () => this.view.closeSheets());
    this.listen(elements.sheetBackdrop, 'click', () => this.view.closeSheets());
    this.listen(elements.bannerOverlay, 'click', (event) => this.handleResultAction(event));
    this.listen(this.browser, 'resize', () => this.resizeIfBattleVisible());
    this.listen(this.browser, 'orientationchange', () => {
      if (this.orientationTimer) this.scheduler.clearTimeout(this.orientationTimer);
      this.orientationTimer = this.scheduler.setTimeout(() => { this.orientationTimer = null; this.resizeIfBattleVisible(); }, 60);
    });
  }

  selectedValue(group) { return group.querySelector('input:checked')?.value; }

  startCampaign() {
    this.model.configureCampaign({
      difficulty: Number(this.selectedValue(this.view.elements.campaignDifficulty)),
      length: Number(this.selectedValue(this.view.elements.campaignLength)),
    });
    this.model.beginDrafts(3);
    this.view.closeCampaignMenu();
    this.view.enterGame();
    this.activateTab('battle');
    this.refresh();
    this.scheduler.requestAnimationFrame(() => this.renderer.resize(this.model));
  }

  startSandbox() {
    this.model.configureSandbox();
    this.view.closeCampaignMenu();
    this.view.enterGame();
    this.activateTab('battle');
    this.refresh();
    this.scheduler.requestAnimationFrame(() => this.renderer.resize(this.model));
  }

  surrenderCampaign() {
    this.stopTimer();
    this.stopAnimationLoop();
    this.view.clearBanner();
    this.view.showTitle();
  }

  openReinforcements() {
    if (this.model.pendingDrafts <= 0 || this.model.isSandbox) return;
    this.view.renderDraft(this.model);
    this.view.openDraft();
  }

  handleDraftClick(event) {
    const button = event.target.closest('[data-draft-choice]');
    if (!button || !this.model.chooseDraft(button.dataset.draftChoice)) return;
    this.view.renderRoster(this.model);
    this.view.renderSupply(this.model);
    if (this.model.pendingDrafts > 0) this.view.renderDraft(this.model);
    else this.view.closeDraft();
  }

  handleFieldClick(event) {
    const cell = this.renderer.cellFromPointer(event);
    if (!cell) return;
    if (this.model.isSandbox) {
      this.clearUnitInspection();
      if (this.model.togglePlacement(cell.row, cell.column)) this.refresh();
      return;
    }
    const enemy = this.model.enemyPlanAt(cell.row, cell.column);
    if (enemy) {
      const key = `${cell.row}:${cell.column}`;
      if (this.inspectedEnemyCell === key) this.clearUnitInspection();
      else { this.inspectedEnemyCell = key; this.view.showUnitInspector(UNIT_TYPES[enemy.type], 'Hostile unit', 'enemy'); }
      return;
    }
    this.clearUnitInspection();
    if (this.model.togglePlacement(cell.row, cell.column)) this.refresh();
  }

  handleResultAction(event) {
    const button = event.target.closest('[data-result-action]');
    if (!button) return;
    const action = button.dataset.resultAction;
    if (action === 'replay') {
      this.view.clearBanner();
      if (this.model.replayLastBattle()) { this.refresh(); this.startAnimationLoop(); this.scheduleBattleTick(0); }
      return;
    }
    if (action === 'surrender') { this.surrenderCampaign(); return; }
    if (action === 'retry') {
      if (this.model.canRetry) this.returnToDeployment(this.model.selectedMission);
      return;
    }
    if (action === 'continue') {
      const hasNextMission = this.model.selectedMission + 1 < this.model.campaign.length;
      if (!hasNextMission) { this.surrenderCampaign(); return; }
      const next = this.model.selectedMission + 1;
      this.returnToDeployment(next);
      this.model.beginDrafts(2);
      this.refresh();
    }
  }

  runBattleTick() {
    const effectStart = this.model.effects.length;
    const result = this.model.tick();
    const tickDuration = this.movementDuration();
    this.fitEffectsToTickWindow(effectStart, tickDuration);
    this.refresh(false);
    if (result) {
      this.view.showResult(result, { hasNextMission: this.model.selectedMission + 1 < this.model.campaign.length, canRetry: this.model.canRetry, sandbox: this.model.isSandbox });
      return;
    }
    this.scheduleBattleTick(tickDuration);
  }
}
