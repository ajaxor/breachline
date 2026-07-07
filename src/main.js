import { FlowGameController } from './backend/FlowGameController.js';
import { validateGameData } from './data/validateGameData.js';
import { CombatEventPresenter } from './frontend/CombatEventPresenter.js';
import { DeploymentBattlefieldRenderer } from './frontend/DeploymentBattlefieldRenderer.js';
import { FlowGameView } from './frontend/FlowGameView.js';
import { StrategyGameModel } from './model/StrategyGameModel.js';

validateGameData();
const view = new FlowGameView();
const model = new StrategyGameModel({ eventPresenter: new CombatEventPresenter() });
const renderer = new DeploymentBattlefieldRenderer(view.elements.field, view.elements.fieldWrap);
const buildInfo = window.BREACH_LINE_BUILD || { version: 'dev', commit: 'local' };
const controller = new FlowGameController(model, view, renderer, buildInfo);
controller.initialize();
