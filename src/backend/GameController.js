import { GAME_CONFIG, MODE, UNIT_TYPES } from '../data/gameConfig.js';

export class GameController {
  constructor(model, view, renderer, buildInfo = {}) {
    this.model = model;
    this.view = view;
    this.renderer = renderer;
    this.buildInfo = buildInfo;
    this.timer = null;
    this.animationFrame = null;
    this.afterDraft = null;
    this.inspectedEnemyCell = null;
  }

  initialize() {
    this.bindEvents();
    this.view.renderBuildInfo(this.buildInfo);
    this.model.beginDrafts(3);
    this.view.renderDraft(this.model);
    this.view.renderRoster(this.model);
    this.refresh();
  }

  bindEvents() {
    const { document } = this.view;
    this.view.elements.btnStartGame.addEventListener('click', () => {
      this.view.enterGame();
      this.afterDraft = () => {
        this.activateTab('battle');
        requestAnimationFrame(() => this.renderer.resize(this.model));
      };
      this.view.renderDraft(this.model);
      this.view.openDraft();
    });
    document.querySelectorAll('.tab-btn').forEach((button) => button.addEventListener('click', () => this.activateTab(button.dataset.tab)));
    this.view.elements.btnGoDeploy.addEventListener('click', () => this.activateTab('battle'));
    this.view.elements.missionStrip.addEventListener('click', (event) => {
      const button = event.target.closest('[data-mission]');
      if (button && this.model.selectMission(Number(button.dataset.mission))) this.refresh();
    });
    this.view.elements.rosterList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-unit-type]');
      if (!button) return;
      this.model.setSelectedUnitType(button.dataset.unitType);
      this.view.renderRoster(this.model);
      this.clearEnemyInspection();
    });
    this.view.elements.draftChoices.addEventListener('click', (event) => {
      const button = event.target.closest('[data-draft-unit]');
      if (!button || !this.model.chooseDraft(button.dataset.draftUnit)) return;
      this.view.renderRoster(this.model);
      if (this.model.pendingDrafts > 0) {
        this.view.renderDraft(this.model);
        return;
      }
      this.view.closeDraft();
      const continuation = this.afterDraft;
      this.afterDraft = null;
      continuation?.();
    });
    this.view.elements.field.addEventListener('click', (event) => {
      const cell = this.renderer.cellFromPointer(event);
      if (!cell) return;
      const enemy = this.model.enemyPlanAt(cell.row, cell.column);
      if (enemy) {
        const key = `${cell.row}:${cell.column}`;
        if (this.inspectedEnemyCell === key) {
          this.clearEnemyInspection();
        } else {
          this.inspectedEnemyCell = key;
          this.view.showUnitInspector(UNIT_TYPES[enemy.type], 'Hostile unit');
        }
        return;
      }
      this.clearEnemyInspection();
      if (this.model.togglePlacement(cell.row, cell.column)) this.refresh();
    });
    document.getElementById('clearLink').addEventListener('click', () => { this.model.clearPlacement(); this.clearEnemyInspection(); this.refresh(); });
    this.view.elements.btnLaunch.addEventListener('click', () => this.startBattle());
    document.getElementById('btnRedesign').addEventListener('click', () => this.returnToDeployment(this.model.selectedMission));
    this.view.elements.btnOpenLog.addEventListener('click', () => this.view.openSheet(this.view.elements.logSheet));
    document.getElementById('logClose').addEventListener('click', () => this.view.closeSheets());
    this.view.elements.sheetBackdrop.addEventListener('click', () => this.view.closeSheets());
    this.view.elements.bannerOverlay.addEventListener('click', (event) => {
      if (!event.target.closest('[data-result-action]')) return;
      const won = Boolean(this.model.result?.playerWon);
      const next = won ? Math.min(this.model.selectedMission + 1, this.model.campaign.length - 1) : this.model.selectedMission;
      if (won) this.startDraftSequence(1, () => this.returnToDeployment(next));
      else this.returnToDeployment(next);
    });
    window.addEventListener('resize', () => this.resizeIfBattleVisible());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resizeIfBattleVisible(), 60));
  }

  clearEnemyInspection() {
    this.inspectedEnemyCell = null;
    this.view.clearUnitInspector();
  }

  startDraftSequence(count, continuation) {
    this.afterDraft = continuation;
    this.model.beginDrafts(count);
    this.view.renderDraft(this.model);
    this.view.openDraft();
  }

  activateTab(tab) {
    this.view.setActiveTab(tab);
    if (tab === 'battle') requestAnimationFrame(() => this.renderer.resize(this.model));
  }

  startBattle() {
    if (!this.model.startBattle()) return;
    this.view.clearBanner();
    this.clearEnemyInspection();
    this.refresh();
    this.startAnimationLoop();
    this.stopTimer();
    this.timer = window.setInterval(() => {
      const result = this.model.tick();
      this.refresh(false);
      if (result) {
        this.stopTimer();
        this.view.showResult(result, this.model.selectedMission + 1 < this.model.campaign.length);
      }
    }, GAME_CONFIG.tickIntervalMs);
  }

  returnToDeployment(missionIndex) {
    this.stopTimer();
    this.stopAnimationLoop();
    this.model.returnToDeployment(missionIndex);
    this.view.closeSheets();
    this.view.clearBanner();
    this.clearEnemyInspection();
    this.activateTab('battle');
    this.refresh();
  }

  refresh(renderCanvas = true) {
    this.view.render(this.model);
    this.view.renderRoster(this.model);
    if (renderCanvas) this.renderer.render(this.model);
  }

  startAnimationLoop() {
    const frame = () => {
      if (this.model.mode !== MODE.BATTLE) return;
      this.renderer.render(this.model);
      this.animationFrame = requestAnimationFrame(frame);
    };
    this.stopAnimationLoop();
    this.animationFrame = requestAnimationFrame(frame);
  }

  stopAnimationLoop() { if (this.animationFrame) cancelAnimationFrame(this.animationFrame); this.animationFrame = null; }
  stopTimer() { if (this.timer) window.clearInterval(this.timer); this.timer = null; }
  resizeIfBattleVisible() { if (!this.view.elements.gameShell.hidden && this.view.document.getElementById('screenBattle').classList.contains('active')) this.renderer.resize(this.model); }
}
