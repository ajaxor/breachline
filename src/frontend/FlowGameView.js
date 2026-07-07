import { GameView } from './GameView.js';

const FLOW_IDS = ['campaignOverlay', 'campaignDifficulty', 'campaignLength', 'btnBeginCampaign', 'btnSandbox', 'btnCampaignBack', 'btnReinforce', 'btnDraftBack'];

export class FlowGameView extends GameView {
  constructor(documentRef = document) {
    super(documentRef);
    for (const id of FLOW_IDS) {
      const element = documentRef.getElementById(id);
      if (!element) throw new Error(`FlowGameView is missing required DOM element: ${id}`);
      this.elements[id] = element;
    }
  }

  showTitle() {
    this.elements.screenTitle.hidden = false;
    this.elements.gameShell.hidden = true;
    this.closeCampaignMenu();
    this.closeDraft();
  }

  openCampaignMenu() {
    this.elements.campaignOverlay.hidden = false;
    this.elements.campaignOverlay.classList.add('open');
    this.elements.btnBeginCampaign.focus();
  }

  closeCampaignMenu() {
    this.elements.campaignOverlay.classList.remove('open');
    this.elements.campaignOverlay.hidden = true;
  }

  renderCampaign(model) {
    if (model.isSandbox) {
      this.elements.missionStrip.replaceChildren();
      this.elements.missionInfo.textContent = 'Sandbox mode — select any unit, place it in either deployment zone, then launch a deterministic mock battle.';
      this.elements.btnGoDeploy.textContent = 'Return to Sandbox';
      return;
    }
    super.renderCampaign(model);
    this.elements.missionInfo.textContent = `Mission ${model.selectedMission + 1} of ${model.campaign.length} — ${model.totalSupply} units in supply · hostile force budget ${model.mission.enemyBudget} pts.`;
  }

  renderRoster(model) {
    const rows = model.rosterTypes.map((type) => this.unitPresentation.createRosterRow(type, type.key === model.selectedUnitType, model.isSandbox ? '∞' : model.availableCount(type.key)));
    if (!rows.length) rows.push(this.createElement('div', { className: 'empty-roster', text: model.pendingDrafts > 0 ? 'Open Reinforce to add units after reviewing the hostile formation.' : 'No units remain in supply.' }));
    this.elements.rosterList.replaceChildren(...rows);
  }

  renderSupply(model) {
    if (model.isSandbox) {
      this.elements.budgetSpent.textContent = `${model.placement.length} player · ${model.mission.enemyFormation.length} enemy`;
      this.elements.btnLaunch.disabled = model.placement.length === 0 || model.mission.enemyFormation.length === 0;
      this.elements.btnReinforce.hidden = true;
      return;
    }
    super.renderSupply(model);
    const pending = model.pendingDrafts;
    this.elements.btnReinforce.hidden = false;
    this.elements.btnReinforce.disabled = pending <= 0;
    this.elements.btnReinforce.textContent = `Reinforce · ${pending}`;
    this.elements.btnReinforce.classList.toggle('attention', pending > 0);
  }

  renderBattleChrome(model) {
    super.renderBattleChrome(model);
    const label = model.isSandbox ? 'SANDBOX' : `MISSION ${model.selectedMission + 1}/${model.campaign.length}`;
    this.elements.phaseLabel.textContent = `PHASE: ${model.mode === 'battle' ? 'BATTLE' : 'DEPLOYMENT'} — ${label}`;
    if (model.isSandbox && model.mode !== 'battle') {
      this.elements.deployHint.textContent = 'Choose any unit, then tap a blue cell to place it for the player or a red cell to place it for the enemy.';
    } else if (!model.isSandbox && model.mode !== 'battle') {
      this.elements.deployHint.textContent = model.pendingDrafts > 0
        ? 'Review the hostile formation, then open Reinforce when you are ready to choose additional units.'
        : 'Choose a roster unit, then tap an open blue cell. All launched units are permanently committed.';
    }
  }

  showResult(result, { hasNextMission, canRetry, sandbox }) {
    this.clearBanner();
    const banner = this.elements.bannerOverlay;
    banner.className = `banner-overlay show ${result.cssClass}`;
    const text = this.createElement('div', { className: 'banner-text', text: result.text });
    const actions = this.createElement('div', { className: 'result-actions' });
    const replay = this.createElement('button', { className: 'primary', text: 'Replay Battle' });
    replay.dataset.resultAction = 'replay';
    actions.appendChild(replay);
    if (sandbox) {
      const retry = this.createElement('button', { text: 'Redesign' });
      retry.dataset.resultAction = 'retry';
      actions.appendChild(retry);
    } else if (result.playerWon) {
      const next = this.createElement('button', { className: 'primary', text: hasNextMission ? 'Continue' : 'Finish Campaign' });
      next.dataset.resultAction = 'continue';
      actions.appendChild(next);
    } else {
      const retry = this.createElement('button', { className: 'primary', text: 'Try Again' });
      retry.dataset.resultAction = 'retry';
      retry.disabled = !canRetry;
      const surrender = this.createElement('button', { className: 'danger', text: 'Surrender' });
      surrender.dataset.resultAction = 'surrender';
      actions.append(retry, surrender);
      if (!canRetry) banner.appendChild(this.createElement('div', { className: 'helptext', text: 'No units remain in supply.' }));
    }
    banner.append(text, actions);
    this.overlays.open(banner, { initialFocus: () => replay });
  }
}
