import { FlowGameController } from './backend/FlowGameController.js';
import { validateGameData } from './data/validateGameData.js';
import { BattlefieldRenderer } from './frontend/BattlefieldRenderer.js';
import { CombatEventPresenter } from './frontend/CombatEventPresenter.js';
import { FlowGameView } from './frontend/FlowGameView.js';
import { StrategyGameModel } from './model/StrategyGameModel.js';

validateGameData();
const view = new FlowGameView();
const model = new StrategyGameModel({ eventPresenter: new CombatEventPresenter() });
const renderer = new BattlefieldRenderer(view.elements.field, view.elements.fieldWrap);
const buildInfo = window.BREACH_LINE_BUILD || { version: 'dev', commit: 'local' };
const controller = new FlowGameController(model, view, renderer, buildInfo);
controller.initialize();
