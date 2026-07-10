import { GAME_CONFIG, MODE, UNIT_TYPES } from '../data/gameConfig.js';

const BATTLE_SPEED = 0.5;
const RESULT_REVEAL_PADDING_MS = 220;
const defaultScheduler = Object.freeze({
  setInterval: (callback, delay) => window.setInterval(callback, delay),
  clearInterval: (handle) => window.clearInterval(handle),
  requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
  cancelAnimationFrame: (handle) => window.cancelAnimationFrame(handle),
  setTimeout: (callback, delay) => window.setTimeout(callback, delay),
  clearTimeout: (handle) => window.clearTimeout(handle),
});

export class GameController {
  constructor(model, view, renderer, buildInfo = {}, { scheduler = defaultScheduler, browser = window } = {}) {
    this.model = model;
    this.view = view;
    this.renderer = renderer;
    this.buildInfo = buildInfo;
    this.scheduler = scheduler;
    this.browser = browser;
    this.timer = null;
    this.animationFrame = null;
    this.orientationTimer = null;
    this.afterDraft = null;
    this.inspectedEnemyCell = null;
    this.listeners = [];
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;
    this.initialized = true;
    this.bindEvents();
    this.view.renderBuildInfo(this.buildInfo);
    this.model.beginDrafts(3);
    this.view.renderDraft(this.model);
    this.view.renderRoster(this.model);
    this.refresh();
  }

  listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.listeners.push(() => target.removeEventListener(type, handler, options));
  }

  bindEvents() {
    const { document, elements } = this.view;
    this.listen(elements.btnStartGame, 'click', () => {
      this.view.enterGame();
      this.afterDraft = () => {
        this.activateTab('battle');
        this.scheduler.requestAnimationFrame(() => this.renderer.resize(this.model));
      };
      this.view.renderDraft(this.model);
      this.view.openDraft();
    });
    document.querySelectorAll('.tab-btn').forEach((button) => this.listen(button, 'click', () => this.activateTab(button.dataset.tab)));
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
    this.listen(elements.btnRedesign, 'click', () => this.returnToDeployment(this.model.selectedMission));
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

  handleMissionClick(event) { const button = event.target.closest('[data-mission]'); if (button && this.model.selectMission(Number(button.dataset.mission))) this.refresh(); }
  handleRosterClick(event) { const button = event.target.closest('[data-unit-type]'); if (!button) return; this.model.setSelectedUnitType(button.dataset.unitType); this.view.renderRoster(this.model); this.clearUnitInspection(); }
  handleExpandedRosterClick(event) { const button = event.target.closest('[data-full-roster-unit]'); if (!button) return; this.model.setSelectedUnitType(button.dataset.fullRosterUnit); this.view.renderRoster(this.model); this.view.closeRoster(); this.clearUnitInspection(); }
  handleDraftClick(event) {
    const button = event.target.closest('[data-draft-choice]');
    if (!button || !this.model.chooseDraft(button.dataset.draftChoice)) return;
    this.view.renderRoster(this.model);
    if (this.model.pendingDrafts > 0) { this.view.renderDraft(this.model); return; }
    this.view.closeDraft();
    const continuation = this.afterDraft;
    this.afterDraft = null;
    continuation?.();
  }

  handleFieldClick(event) {
    const cell = this.renderer.cellFromPointer(event);
    if (!cell) return;
    const enemy = this.model.enemyPlanAt(cell.row, cell.column);
    if (enemy) {
      const key = `${cell.row}:${cell.column}`;
      if (this.inspectedEnemyCell === key) this.clearUnitInspection();
      else { this.inspectedEnemyCell = key; this.view.showUnitInspector(UNIT_TYPES[enemy.type], 'Hostile unit', 'enemy', { includeTechLevel: this.model.isSandbox }); }
      return;
    }
    this.clearUnitInspection();
    if (this.model.togglePlacement(cell.row, cell.column)) this.refresh();
  }

  handleResultAction(event) {
    if (!event.target.closest('[data-result-action]')) return;
    const won = Boolean(this.model.result?.playerWon);
    const next = won ? Math.min(this.model.selectedMission + 1, this.model.campaign.length - 1) : this.model.selectedMission;
    if (won) this.startDraftSequence(2, () => this.returnToDeployment(next));
    else this.returnToDeployment(next);
  }

  clearUnitInspection() { this.inspectedEnemyCell = null; this.view.clearUnitInspector(); }
  startDraftSequence(count, continuation) { this.afterDraft = continuation; this.model.beginDrafts(count); this.view.renderDraft(this.model); this.view.openDraft(); }
  activateTab(tab) { this.view.closeRoster(); this.view.setActiveTab(tab); if (tab === 'battle') this.scheduler.requestAnimationFrame(() => this.renderer.resize(this.model)); }

  startBattle() {
    if (!this.model.startBattle()) return;
    this.view.closeRoster();
    this.view.clearBanner();
    this.clearUnitInspection();
    this.refresh();
    this.startAnimationLoop();
    this.stopTimer();
    this.scheduler.requestAnimationFrame(() => this.renderer.resize(this.model));
    this.scheduleBattleTick(0);
  }

  scheduleBattleTick(delay) {
    this.stopTimer();
    this.timer = this.scheduler.setTimeout(() => {
      this.timer = null;
      this.runBattleTick();
    }, delay);
  }

  runBattleTick() {
    const effectStart = this.model.effects.length;
    const result = this.model.tick();
    const tickDuration = result ? this.effectWindowDuration(effectStart) : this.movementDuration();
    this.fitEffectsToTickWindow(effectStart, tickDuration);
    this.refresh(false);
    if (result) {
      this.stopTimer();
      this.timer = this.scheduler.setTimeout(() => {
        this.timer = null;
        this.renderer.render(this.model);
        this.stopAnimationLoop();
        this.view.showResult(result, this.model.selectedMission + 1 < this.model.campaign.length);
      }, tickDuration + RESULT_REVEAL_PADDING_MS);
      return;
    }
    this.scheduleBattleTick(tickDuration);
  }

  movementDuration() {
    return Math.max(220, Math.min(960, GAME_CONFIG.tickIntervalMs * 0.85 / BATTLE_SPEED));
  }

  effectWindowDuration(effectStart) {
    const effects = this.model.effects.slice(effectStart);
    if (effects.length === 0) return this.movementDuration();
    const starts = effects.map((effect) => effect.actionStart ?? effect.start).filter(Number.isFinite);
    const ends = effects.map((effect) => (effect.start ?? 0) + (effect.duration ?? 0)).filter(Number.isFinite);
    if (starts.length === 0 || ends.length === 0) return this.movementDuration();
    return Math.max(this.movementDuration(), Math.max(...ends) - Math.min(...starts));
  }

  fitEffectsToTickWindow(effectStart, tickDuration) {
    const effects = this.model.effects.slice(effectStart);
    if (effects.length === 0) return;

    const windowStart = effects.reduce(
      (earliest, effect) => Math.min(earliest, effect.actionStart ?? effect.start ?? Infinity),
      Infinity,
    );
    if (!Number.isFinite(windowStart)) return;

    const latestEnd = effects.reduce(
      (latest, effect) => Math.max(latest, (effect.start ?? windowStart) + (effect.duration ?? 0)),
      windowStart,
    );
    const originalSpan = latestEnd - windowStart;
    if (originalSpan <= tickDuration || originalSpan <= 0) return;

    const scale = tickDuration / originalSpan;
    for (const effect of effects) {
      effect.start = windowStart + ((effect.start ?? windowStart) - windowStart) * scale;
      effect.duration = Math.max(1, (effect.duration ?? 0) * scale);
      if (effect.actionStart !== undefined) {
        effect.actionStart = windowStart + (effect.actionStart - windowStart) * scale;
      }
    }
  }

  returnToDeployment(missionIndex) {
    this.stopTimer();
    this.stopAnimationLoop();
    this.model.returnToDeployment(missionIndex);
    this.view.closeSheets();
    this.view.closeRoster();
    this.view.clearBanner();
    this.clearUnitInspection();
    this.activateTab('battle');
    this.refresh();
  }

  refresh(renderCanvas = true) { this.view.render(this.model); this.view.renderRoster(this.model); if (renderCanvas) this.renderer.render(this.model); }
  startAnimationLoop() {
    const frame = () => { if (this.model.mode !== MODE.BATTLE) return; this.renderer.render(this.model); this.animationFrame = this.scheduler.requestAnimationFrame(frame); };
    this.stopAnimationLoop();
    this.animationFrame = this.scheduler.requestAnimationFrame(frame);
  }
  stopAnimationLoop() { if (this.animationFrame !== null) this.scheduler.cancelAnimationFrame(this.animationFrame); this.animationFrame = null; }
  stopTimer() { if (this.timer !== null) this.scheduler.clearTimeout(this.timer); this.timer = null; }
  resizeIfBattleVisible() { if (!this.view.elements.gameShell.hidden && this.view.elements.screenBattle.classList.contains('active')) this.renderer.resize(this.model); }
  dispose() {
    this.stopTimer();
    this.stopAnimationLoop();
    if (this.orientationTimer !== null) this.scheduler.clearTimeout(this.orientationTimer);
    this.orientationTimer = null;
    this.listeners.splice(0).forEach((remove) => remove());
    this.view.dispose?.();
    this.afterDraft = null;
    this.initialized = false;
  }
}
