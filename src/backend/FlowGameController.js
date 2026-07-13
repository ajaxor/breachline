import { GAME_CONFIG, UNIT_TYPES } from '../data/gameConfig.js';
import { GameController } from './GameController.js';

export class FlowGameController extends GameController {
  constructor(model, view, renderer, buildInfo = {}, { audioDirector = null, ...options } = {}) {
    super(model, view, renderer, buildInfo, options);
    this.audioDirector = audioDirector;
  }

  initialize() {
    if (this.initialized) return;
    this.initialized = true;
    this.bindEvents();
    this.view.renderBuildInfo(this.buildInfo);
    this.view.renderAudioSettings(this.audioDirector?.settings);
    this.audioDirector?.setScene('title');
    this.view.showTitle();
  }

  bindEvents() {
    const { elements } = this.view;
    this.listen(this.view.document, 'click', (event) => this.handleUiSound(event));
    this.listen(elements.btnStartGame, 'click', () => { this.audioDirector?.unlock(); this.view.openCampaignMenu(); });
    this.view.document.querySelectorAll('[data-open-settings]').forEach((button) => this.listen(button, 'click', () => this.view.openSettings()));
    this.listen(elements.btnSettingsClose, 'click', () => this.view.closeSettings());
    this.listen(elements.btnMusicMute, 'click', () => this.toggleMusic());
    this.listen(elements.btnSfxMute, 'click', () => this.toggleSfx());
    this.listen(elements.btnBeginCampaign, 'click', () => this.startCampaign());
    this.listen(elements.btnSandbox, 'click', () => this.startSandbox());
    this.listen(elements.btnCampaignBack, 'click', () => this.view.closeCampaignMenu());
    this.listen(elements.btnBack, 'click', () => this.requestSurrender());
    this.listen(elements.btnSurrender, 'click', () => this.requestSurrender());
    this.listen(elements.btnConfirmSurrender, 'click', () => this.confirmSurrender());
    this.listen(elements.btnCancelSurrender, 'click', () => this.view.closeSurrenderConfirm());
    this.listen(elements.btnReinforce, 'click', () => this.openReinforcements());
    this.listen(elements.btnSandboxGenerate, 'click', () => this.generateSandboxDeployment());
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

  handleUiSound(event) {
    const button = event.target.closest?.('button');
    if (!button || button.disabled) return;
    let cue = 'tap';
    if (button === this.view.elements.btnLaunch) cue = 'launch';
    else if (button.matches('[data-draft-choice], [data-result-action]') || button.classList.contains('primary')) cue = 'select';
    this.audioDirector?.playUiSound(cue);
  }

  toggleMusic() {
    if (!this.audioDirector) return;
    this.audioDirector.unlock();
    this.audioDirector.setMusicMuted(!this.audioDirector.settings.musicMuted);
    this.view.renderAudioSettings(this.audioDirector.settings);
  }

  toggleSfx() {
    if (!this.audioDirector) return;
    this.audioDirector.unlock();
    this.audioDirector.setSfxMuted(!this.audioDirector.settings.sfxMuted);
    this.view.renderAudioSettings(this.audioDirector.settings);
  }

  selectedValue(group) { return group.querySelector('input:checked')?.value; }

  campaignSettings() {
    return {
      difficulty: Number(this.selectedValue(this.view.elements.campaignDifficulty)),
      length: GAME_CONFIG.missionCount,
    };
  }

  startCampaign() {
    this.model.clearPlacement();
    this.model.configureCampaign(this.campaignSettings());
    this.model.beginDrafts(3);
    this.view.closeCampaignMenu();
    this.view.enterGame();
    this.audioDirector?.setScene('deployment');
    this.activateTab('battle');
    this.refresh();
    this.scheduler.requestAnimationFrame(() => this.renderer.resize(this.model));
  }

  startSandbox() {
    this.model.configureSandbox(this.campaignSettings());
    this.view.closeCampaignMenu();
    this.view.enterGame();
    this.audioDirector?.setScene('deployment');
    this.activateTab('battle');
    this.refresh();
    this.scheduler.requestAnimationFrame(() => this.renderer.resize(this.model));
  }

  startBattle() {
    if (!this.model.startBattle()) return;
    this.audioDirector?.unlock();
    this.audioDirector?.setScene('battle');
    this.view.closeRoster();
    this.view.clearBanner();
    this.clearUnitInspection();
    this.refresh();
    this.startAnimationLoop();
    this.stopTimer();
    this.scheduler.requestAnimationFrame(() => this.renderer.resize(this.model));
    this.scheduleBattleTick(0);
  }

  generateSandboxDeployment() {
    if (!this.model.generateSandboxCampaignDeployment()) return;
    this.clearUnitInspection();
    this.refresh();
  }

  requestSurrender() {
    if (this.model.isSandbox) {
      this.surrenderCampaign();
      return;
    }
    this.view.openSurrenderConfirm();
  }

  confirmSurrender() {
    this.view.closeSurrenderConfirm();
    this.surrenderCampaign();
  }

  surrenderCampaign() {
    this.stopTimer();
    this.stopAnimationLoop();
    this.view.closeSurrenderConfirm();
    this.view.closeSheets();
    this.view.closeRoster();
    this.view.clearBanner();
    this.clearUnitInspection();
    this.audioDirector?.setScene('title');
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
      if (this.model.togglePlacement(cell.row, cell.column)) {
        this.audioDirector?.playUiSound('place');
        this.refresh();
      }
      return;
    }
    const enemy = this.model.enemyPlanAt(cell.row, cell.column);
    if (enemy) {
      const key = `${cell.row}:${cell.column}`;
      if (this.inspectedEnemyCell === key) this.clearUnitInspection();
      else {
        this.inspectedEnemyCell = key;
        this.renderer.setInspectedEnemyCell?.(cell);
        this.view.showUnitInspector(UNIT_TYPES[enemy.type], 'Hostile unit', 'enemy');
      }
      return;
    }
    this.clearUnitInspection();
    if (this.model.togglePlacement(cell.row, cell.column)) {
      this.audioDirector?.playUiSound('place');
      this.refresh();
    }
  }

  clearUnitInspection() {
    super.clearUnitInspection();
    this.renderer.setInspectedEnemyCell?.(null);
  }

  handleResultAction(event) {
    const button = event.target.closest('[data-result-action]');
    if (!button) return;
    const action = button.dataset.resultAction;
    if (action === 'replay') {
      this.view.clearBanner();
      if (this.model.replayLastBattle()) { this.audioDirector?.setScene('battle'); this.refresh(); this.startAnimationLoop(); this.scheduleBattleTick(0); }
      return;
    }
    if (action === 'surrender') { this.requestSurrender(); return; }
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

  returnToDeployment(missionIndex) {
    this.audioDirector?.setScene('deployment');
    super.returnToDeployment(missionIndex);
  }

  runBattleTick() {
    const previousEffects = new Set(this.model.effects);
    const result = this.model.tick();
    const tickEffects = this.model.effects.filter((effect) => !previousEffects.has(effect));
    const effectStart = this.model.effects.length - tickEffects.length;
    const tickDuration = this.movementDuration();
    this.fitEffectsToTickWindow(effectStart, tickDuration);
    this.audioDirector?.playEffects(tickEffects);
    this.refresh(false);
    if (result) {
      this.audioDirector?.playBattleResult(Boolean(result.playerWon));
      this.view.showResult(result, { hasNextMission: this.model.selectedMission + 1 < this.model.campaign.length, canRetry: this.model.canRetry, sandbox: this.model.isSandbox });
      return;
    }
    this.scheduleBattleTick(tickDuration);
  }

  dispose() {
    this.audioDirector?.dispose();
    super.dispose();
  }
}
