import { GameController } from './backend/GameController.js';
import { BattlefieldRenderer } from './frontend/BattlefieldRenderer.js';
import { GameView } from './frontend/GameView.js';
import { StrategyGameModel } from './model/StrategyGameModel.js';

const view = new GameView();
const model = new StrategyGameModel();
const renderer = new BattlefieldRenderer(view.elements.field, view.elements.fieldWrap);
const buildInfo = window.BREACH_LINE_BUILD || { version: 'dev', commit: 'local' };
const controller = new GameController(model, view, renderer, buildInfo);
controller.initialize();