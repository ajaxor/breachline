import { TEAM } from '../data/gameConfig.js';
import { GameView } from './GameView.js';

const FLOW_IDS = ['campaignOverlay', 'campaignDifficulty', 'campaignLength', 'btnBeginCampaign', 'btnSandbox', 'btnCampaignBack', 'sandboxTeam'];

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
      this.elements.missionInfo.textContent = 'Sandbox mode — build both formations, then launch a deterministic mock battle.';
      this.elements.btnGoDeploy.textContent = 'Return to Sandbox';
      return;
    }
    super.renderCampaign(model);
    this.elements.missionInfo.textContent = `Mission ${model.selectedMission + 1} of ${model.campaign.length} — ${model.totalSupply} units in supply · hostile force budget ${model.mission.enemyBudget} pts.`;
  }

  renderRoster(model) {
    const types = model.isSandbox ? model.rosterTypes.filter((type) => model.sandboxTeam === TEAM.ENEMY || !type.tags.includes('ai-only')) : model.rosterTypes;
    const rows = types.map((type) => this.unitPresentation.createRosterRow(type, type.key === model.selectedUnitType, model.isSandbox ? '∞' : model.availableCount(type.key)));
    if (!rows.length) rows.push(this.createElement('div', { className: 'empty-roster', text: 'Complete a reinforcement draft to add units to your supply.' }));
    this.elements.rosterList.replaceChildren(...rows);
    this.renderSandboxControls(model);
  }

  renderSandboxControls(model) {
    this.elements.sandboxTeam.hidden = !model.isSandbox;
    this.elements.sandboxTeam.querySelectorAll('[data-sandbox-team]').forEach((button) => button.classList.toggle('active', button.dataset.sandboxTeam === model.sandboxTeam));
  }

  renderSupply(model) {
    if (model.isSandbox) {
      this.elements.budgetSpent.textContent = `${model.placement.length} player · ${model.mission.enemyFormation.length} enemy`;
      this.elements.btnLaunch.disabled = model.placement.length === 0 || model.mission.enemyFormation.length === 0;
      return;
    }
    super.renderSupply(model);
  }

  renderBattleChrome(model) {
    super.renderBattleChrome(model);
    const label = model.isSandbox ? 'SANDBOX' : `MISSION ${model.selectedMission + 1}/${model.campaign.length}`;
    this.elements.phaseLabel.textContent = `PHASE: ${model.mode === 'battle' ? 'BATTLE' : 'DEPLOYMENT'} — ${label}`;
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
      const next = this.createElement('button', { className: 'primary', text: hasNextMission ? 'Draft Reinforcement' : 'Finish Campaign' });
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
