import { GameController } from './backend/GameController.js';
import { CanvasRenderer } from './frontend/CanvasRenderer.js';
import { GameView } from './frontend/GameView.js';
import { GameModel } from './model/GameModel.js';

const view = new GameView();
const model = new GameModel();
const renderer = new CanvasRenderer(view.elements.field, view.elements.fieldWrap);
const controller = new GameController(model, view, renderer);
controller.initialize();
