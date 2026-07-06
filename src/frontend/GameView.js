import { GAME_CONFIG, MODE, UNIT_TYPES } from '../data/gameConfig.js';

export class GameView {
  constructor(documentRef = document) {
    this.document = documentRef;
    this.elements = Object.fromEntries(['screenTitle','gameShell','btnStartGame','buildInfo','field','fieldWrap','missionStrip','missionInfo','btnGoDeploy','budgetSpent','budgetFill','btnLaunch','deployTopbar','resolveTopbar','deployHint','battleStatus','btnOpenPalette','btnOpenLog','phaseLabel','log','bannerOverlay','paletteSheet','logSheet','sheetBackdrop','rosterList','playerHpText','enemyHpText','playerHpFill','enemyHpFill'].map((id) => [id, documentRef.getElementById(id)]));
  }

  render(model) {
    this.renderCampaign(model);
    this.renderBudget(model);
    this.renderBattleChrome(model);
    this.renderBases(model);
    this.renderLog(model);
  }

  renderBuildInfo(buildInfo) {
    const version = buildInfo?.version || 'dev';
    const commit = buildInfo?.commit || 'local';
    this.elements.buildInfo.textContent = `v${version} · ${commit}`;
  }

  enterGame() {
    this.elements.screenTitle.hidden = true;
    this.elements.gameShell.hidden = false;
    this.setActiveTab('missions');
  }

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
    Object.values(UNIT_TYPES).forEach((type) => {
      const card = this.document.createElement('button');
      card.className = `roster-card${type.key === model.selectedUnitType ? ' selected' : ''}`;
      card.dataset.unitType = type.key;
      const stats = type.key === 'healer' ? `HP ${type.hp} · HEAL ${type.healAmount} · RNG ${type.range}` : `HP ${type.hp} · ATK ${type.attack} · RNG ${type.range}`;
      card.innerHTML = `<span class="unit-symbol">${this.symbolFor(type.shape)}</span><span class="rc-info"><span class="rc-name">${type.name}</span><span class="rc-stats">${stats}</span><span class="rc-behavior">${type.behavior}</span></span><span class="rc-cost">${type.cost}</span>`;
      list.appendChild(card);
    });
  }

  renderBudget(model) {
    this.elements.budgetSpent.textContent = `${model.spentBudget} / ${model.budget}`;
    this.elements.budgetFill.style.width = `${Math.min(100, model.spentBudget / model.budget * 100)}%`;
    this.elements.budgetFill.classList.toggle('over', model.spentBudget > model.budget);
    this.elements.btnLaunch.disabled = !model.canLaunch;
  }

  renderBattleChrome(model) {
    const battling = model.mode === MODE.BATTLE;
    this.elements.deployTopbar.hidden = battling;
    this.elements.resolveTopbar.hidden = !battling;
    this.elements.deployHint.hidden = battling;
    this.elements.battleStatus.hidden = !battling;
    this.elements.btnOpenPalette.hidden = battling;
    this.elements.btnOpenLog.hidden = !battling;
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
    this.elements.log.innerHTML = '';
    model.logEntries.forEach((entry) => { const row = this.document.createElement('div'); row.className = entry.cssClass; row.textContent = entry.message; this.elements.log.appendChild(row); });
    this.elements.log.scrollTop = this.elements.log.scrollHeight;
  }

  setActiveTab(tab) {
    this.document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
    this.document.getElementById(tab === 'missions' ? 'screenMissions' : 'screenBattle').classList.add('active');
    this.document.querySelectorAll('.tab-btn').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
  }

  openSheet(element) { this.document.querySelectorAll('.sheet').forEach((sheet) => sheet.classList.remove('open')); element.classList.add('open'); this.elements.sheetBackdrop.classList.add('open'); }
  closeSheets() { this.document.querySelectorAll('.sheet').forEach((sheet) => sheet.classList.remove('open')); this.elements.sheetBackdrop.classList.remove('open'); }
  clearBanner() { this.elements.bannerOverlay.className = 'banner-overlay'; this.elements.bannerOverlay.innerHTML = ''; }
  showResult(result, hasNextMission) { this.clearBanner(); const banner = this.elements.bannerOverlay; banner.className = `banner-overlay show ${result.cssClass}`; banner.innerHTML = `<div class="banner-text">${result.text}</div>${result.playerWon && !hasNextMission ? '<div class="helptext">Campaign complete — all 10 missions cleared!</div>' : `<button class="primary" data-result-action>${result.playerWon ? 'Continue to Next Mission' : 'Retry Mission'}</button>`}`; }
  symbolFor(shape) { return ({ square: '□', hex: '⬡', triangle: '△', diamond: '◇', circle: '⊕' })[shape]; }
}
