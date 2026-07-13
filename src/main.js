import { FlowGameController } from './backend/FlowGameController.js';
import { validateGameData } from './data/validateGameData.js';
import { CenteredCombatEventPresenter } from './frontend/CenteredCombatEventPresenter.js';
import { CombatRangeBattlefieldRenderer } from './frontend/CombatRangeBattlefieldRenderer.js';
import { FileTrackAudioDirector } from './frontend/FileTrackAudioDirector.js';
import { FlowGameView } from './frontend/FlowGameView.js';
import { StrategyGameModel } from './model/StrategyGameModel.js';

validateGameData();
const view = new FlowGameView();
const model = new StrategyGameModel({ eventPresenter: new CenteredCombatEventPresenter() });
const renderer = new CombatRangeBattlefieldRenderer(view.elements.field, view.elements.fieldWrap);
const audioDirector = new FileTrackAudioDirector();
const buildInfo = window.BREACH_LINE_BUILD || { version: 'dev', commit: 'local' };
const controller = new FlowGameController(model, view, renderer, buildInfo, { audioDirector });
controller.initialize();
