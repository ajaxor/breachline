import { GAME_CONFIG, MODE } from '../data/gameConfig.js';

export class GameController {
  constructor(model, view, renderer) {
    this.model = model;
    this.view = view;
    this.renderer = renderer;
    this.timer = null;
    this.animationFrame = null;
  }

  initialize() {
    this.bindEvents();
    this.view.renderRoster(this.model);
    this.refresh();
  }

  bindEvents() {
    const { document } = this.view;
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
      this.view.closeSheets();
    });
    this.view.elements.field.addEventListener('click', (event) => {
      const cell = this.renderer.cellFromPointer(event);
      if (cell && this.model.togglePlacement(cell.row, cell.column)) this.refresh();
    });
    document.getElementById('clearLink').addEventListener('click', () => { this.model.clearPlacement(); this.view.closeSheets(); this.refresh(); });
    this.view.elements.btnLaunch.addEventListener('click', () => this.startBattle());
    document.getElementById('btnRedesign').addEventListener('click', () => this.returnToDeployment(this.model.selectedMission));
    document.getElementById('paletteClose').addEventListener('click', () => this.view.closeSheets());
    document.getElementById('logClose').addEventListener('click', () => this.view.closeSheets());
    this.view.elements.sheetBackdrop.addEventListener('click', () => this.view.closeSheets());
    this.view.elements.btnOpenPalette.addEventListener('click', () => this.view.openSheet(this.view.elements.paletteSheet));
    this.view.elements.btnOpenLog.addEventListener('click', () => this.view.openSheet(this.view.elements.logSheet));
    this.view.elements.bannerOverlay.addEventListener('click', (event) => {
      if (!event.target.closest('[data-result-action]')) return;
      const next = this.model.result?.playerWon ? Math.min(this.model.selectedMission + 1, this.model.campaign.length - 1) : this.model.selectedMission;
      this.returnToDeployment(next);
    });
    window.addEventListener('resize', () => this.resizeIfBattleVisible());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resizeIfBattleVisible(), 60));
  }

  activateTab(tab) {
    this.view.setActiveTab(tab);
    if (tab === 'battle') requestAnimationFrame(() => this.renderer.resize(this.model));
  }

  startBattle() {
    if (!this.model.startBattle()) return;
    this.view.clearBanner();
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
    this.refresh();
  }

  refresh(renderCanvas = true) {
    this.view.render(this.model);
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

  stopAnimationLoop() {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
  }

  stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  resizeIfBattleVisible() {
    if (this.view.document.getElementById('screenBattle').classList.contains('active')) this.renderer.resize(this.model);
  }
}
