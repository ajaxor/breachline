import { UNIT_TYPES } from '../data/gameConfig.js';

const TYPE_BY_GRAPHIC = Object.freeze(Object.fromEntries(
  Object.values(UNIT_TYPES).map((type) => [type.graphic ?? type.shape, type]),
));

const ABSTRACT_UNIT_DRAWERS = Object.freeze({
  grunt: drawGruntSymbol,
  rifleman: drawRiflemanSymbol,
  skitter: drawSkitterSymbol,
  gunner: drawGunnerSymbol,
  bulwark: drawBulwarkSymbol,
  ram: drawRamSymbol,
  lancer: drawLancerSymbol,
  runner: drawRunnerSymbol,
  phalanx: drawPhalanxSymbol,
  marksman: drawMarksmanSymbol,
  fusilier: drawFusilierSymbol,
  flak: drawFlakSymbol,
  artillery: drawArtillerySymbol,
  bertha: drawBerthaSymbol,
  medic: drawMedicSymbol,
  aegis: drawAegisSymbol,
  amplifier: drawAmplifierSymbol,
  disruptor: drawDisruptorSymbol,
  jammer: drawJammerSymbol,
  midge: drawMidgeSymbol,
  wasp: drawWaspSymbol,
  kite: drawKiteSymbol,
  firefly: drawFireflySymbol,
  demolisher: drawDemolisherSymbol,
  ranger: drawRangerSymbol,
  infiltrator: drawInfiltratorSymbol,
  barricade: drawBarricadeSymbol,
  turret: drawTurretSymbol,
  'flak-turret': drawFlakTurretSymbol,
  'rocket-turret': drawRocketTurretSymbol,
  'mortar-nest': drawMortarNestSymbol,
  'rail-turret': drawRailTurretSymbol,
  factory: drawFactorySymbol,
});

const ROLE_FRAME_SCALE = Object.freeze({
  melee: 0.86,
  ranged: 1.08,
  support: 1,
  flying: 1,
  specialist: 1.05,
  wall: 1.12,
  structure: 1.08,
});

export const drawUnitGraphic = (context, graphic, x, y, radius, color, role = null) => {
  const silhouetteRole = role ?? TYPE_BY_GRAPHIC[graphic]?.role ?? null;
  context.save();
  context.translate(x, y);
  if (silhouetteRole === 'ranged') context.translate(0, radius * 0.08);
  drawRoleFrame(context, silhouetteRole, radius, color);
  drawUnitDetails(context, graphic, radius, color);
  context.restore();
};

const drawRoleFrame = (ctx, role, radius, color) => {
  const frameRadius = radius * (ROLE_FRAME_SCALE[role] ?? 1);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5, radius * 0.12);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.save();
  ctx.globalAlpha *= 0.18;
  ctx.beginPath();
  unitBodyPath(ctx, role, frameRadius);
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  unitBodyPath(ctx, role, frameRadius);
  ctx.stroke();
  ctx.restore();
};

const unitBodyPath = (ctx, role, radius) => {
  if (role === 'melee') ctx.roundRect(-radius, -radius, radius * 2, radius * 2, radius * 0.23);
  else if (role === 'ranged') polygon(ctx, radius, 3, -Math.PI / 2);
  else if (role === 'support') ctx.arc(0, 0, radius, 0, Math.PI * 2);
  else if (role === 'flying') {
    ctx.moveTo(-radius, 0);
    ctx.quadraticCurveTo(-radius * 0.35, -radius, 0, -radius * 0.2);
    ctx.quadraticCurveTo(radius * 0.35, -radius, radius, 0);
    ctx.quadraticCurveTo(radius * 0.35, radius, 0, radius * 0.2);
    ctx.quadraticCurveTo(-radius * 0.35, radius, -radius, 0);
    ctx.closePath();
  } else if (role === 'specialist') polygon(ctx, radius, 4, -Math.PI / 2);
  else if (role === 'wall') ctx.roundRect(-radius * 1.12, -radius * 0.68, radius * 2.24, radius * 1.36, radius * 0.12);
  else if (role === 'structure') polygon(ctx, radius, 6, Math.PI / 6);
  else ctx.rect(-radius, -radius, radius * 2, radius * 2);
};

const drawUnitDetails = (ctx, graphic, radius, color) => {
  const abstractDrawer = ABSTRACT_UNIT_DRAWERS[graphic];
  if (!abstractDrawer) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  abstractDrawer(ctx, radius);
  ctx.restore();
};

function drawGruntSymbol(ctx, radius) {
  fillRectScaled(ctx, radius, -0.42, -0.48, 0.84, 0.96);
  fillRectScaled(ctx, radius, -0.56, -0.08, 1.12, 0.16);
}

function drawRiflemanSymbol(ctx, radius) {
  fillShape(ctx, radius, [[-0.66, 0.5], [-0.24, 0.22], [-0.24, -0.48], [-0.42, -0.36], [-0.42, 0.12], [-0.72, 0.3]]);
  fillRectScaled(ctx, radius, -0.1, -0.66, 0.2, 1.28);
  fillShape(ctx, radius, [[0.66, 0.5], [0.24, 0.22], [0.24, -0.48], [0.42, -0.36], [0.42, 0.12], [0.72, 0.3]]);
}

function drawSkitterSymbol(ctx, radius) {
  fillShape(ctx, radius, [[-0.7, -0.1], [-0.3, -0.46], [-0.3, -0.24], [0.38, -0.24], [0.38, 0.02], [-0.3, 0.02], [-0.3, 0.24]]);
  fillShape(ctx, radius, [[0.7, 0.1], [0.3, 0.46], [0.3, 0.24], [-0.38, 0.24], [-0.38, -0.02], [0.3, -0.02], [0.3, -0.24]]);
}

function drawGunnerSymbol(ctx, radius) {
  fillShape(ctx, radius, [[-0.42, -0.58], [0.42, -0.58], [0.6, -0.42], [0.6, 0.08], [0.3, 0.08], [0.18, 0.36], [-0.18, 0.36], [-0.3, 0.08], [-0.6, 0.08], [-0.6, -0.42]]);
  fillShape(ctx, radius, [[-0.28, 0.14], [0.28, 0.14], [0, 0.58]]);
}

function drawBulwarkSymbol(ctx, radius) {
  ctx.lineWidth = Math.max(1.4, radius * 0.11);
  ctx.beginPath();
  pathPoints(ctx, radius, [[0, -0.62], [0.54, -0.34], [0.44, 0.3], [0, 0.62], [-0.44, 0.3], [-0.54, -0.34]]);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-radius * 0.28, -radius * 0.08);
  ctx.lineTo(0, radius * 0.04);
  ctx.lineTo(radius * 0.28, -radius * 0.08);
  ctx.moveTo(-radius * 0.24, radius * 0.18);
  ctx.lineTo(0, radius * 0.3);
  ctx.lineTo(radius * 0.24, radius * 0.18);
  ctx.stroke();
}

function drawRamSymbol(ctx, radius) {
  fillRectScaled(ctx, radius, -0.3, -0.64, 0.6, 0.16);
  fillShape(ctx, radius, [[-0.58, -0.26], [0.58, -0.26], [0, 0.56]]);
}

function drawLancerSymbol(ctx, radius) {
  fillShape(ctx, radius, [[0, -0.76], [0.22, -0.38], [-0.22, -0.38]]);
  fillRectScaled(ctx, radius, -0.07, -0.38, 0.14, 0.96);
  fillShape(ctx, radius, [[-0.44, -0.04], [-0.12, 0.14], [-0.12, 0.58], [-0.38, 0.42]]);
  fillShape(ctx, radius, [[0.44, -0.04], [0.12, 0.14], [0.12, 0.58], [0.38, 0.42]]);
}

function drawRunnerSymbol(ctx, radius) {
  fillShape(ctx, radius, [[-0.62, -0.48], [0.08, -0.48], [0.4, -0.2], [-0.3, -0.2]]);
  fillShape(ctx, radius, [[-0.34, -0.08], [0.36, -0.08], [0.68, 0.2], [-0.02, 0.2]]);
  fillShape(ctx, radius, [[-0.62, 0.32], [0.08, 0.32], [0.4, 0.6], [-0.3, 0.6]]);
}

function drawPhalanxSymbol(ctx, radius) {
  fillRectScaled(ctx, radius, -0.62, -0.5, 0.28, 1);
  fillRectScaled(ctx, radius, -0.14, -0.5, 0.28, 1);
  fillRectScaled(ctx, radius, 0.34, -0.5, 0.28, 1);
  fillRectScaled(ctx, radius, -0.68, -0.08, 1.36, 0.16);
}

function drawMarksmanSymbol(ctx, radius) {
  ctx.lineWidth = Math.max(1.3, radius * 0.09);
  ctx.beginPath();
  ctx.moveTo(-radius * 0.52, -radius * 0.22);
  ctx.lineTo(-radius * 0.52, -radius * 0.46);
  ctx.lineTo(-radius * 0.28, -radius * 0.46);
  ctx.moveTo(radius * 0.52, -radius * 0.22);
  ctx.lineTo(radius * 0.52, -radius * 0.46);
  ctx.lineTo(radius * 0.28, -radius * 0.46);
  ctx.moveTo(-radius * 0.52, radius * 0.22);
  ctx.lineTo(-radius * 0.52, radius * 0.46);
  ctx.lineTo(-radius * 0.28, radius * 0.46);
  ctx.moveTo(radius * 0.52, radius * 0.22);
  ctx.lineTo(radius * 0.52, radius * 0.46);
  ctx.lineTo(radius * 0.28, radius * 0.46);
  ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.06, 0, Math.PI * 2);
  ctx.fill();
}

function drawFusilierSymbol(ctx, radius) {
  ctx.lineWidth = Math.max(1.5, radius * 0.11);
  ctx.beginPath();
  ctx.moveTo(-radius * 0.46, -radius * 0.28);
  ctx.lineTo(0, -radius * 0.08);
  ctx.lineTo(radius * 0.46, -radius * 0.28);
  ctx.moveTo(-radius * 0.46, 0);
  ctx.lineTo(0, radius * 0.2);
  ctx.lineTo(radius * 0.46, 0);
  ctx.moveTo(-radius * 0.46, radius * 0.28);
  ctx.lineTo(0, radius * 0.48);
  ctx.lineTo(radius * 0.46, radius * 0.28);
  ctx.stroke();
}

function drawFlakSymbol(ctx, radius) {
  fillShape(ctx, radius, [[-0.46, 0.38], [-0.16, 0.12], [-0.16, -0.52], [-0.34, -0.52], [-0.6, 0.22]]);
  fillShape(ctx, radius, [[0.46, 0.38], [0.16, 0.12], [0.16, -0.52], [0.34, -0.52], [0.6, 0.22]]);
  fillRectScaled(ctx, radius, -0.46, 0.38, 0.92, 0.16);
}

function drawArtillerySymbol(ctx, radius) {
  ctx.lineWidth = Math.max(1.5, radius * 0.11);
  fillRectScaled(ctx, radius, -0.52, 0.38, 1.04, 0.16);
  fillShape(ctx, radius, [[-0.42, 0.36], [-0.22, 0.16], [0.18, 0.16], [0.42, 0.36]]);
  ctx.beginPath();
  ctx.arc(-radius * 0.38, radius * 0.5, radius * 0.14, 0, Math.PI * 2);
  ctx.arc(radius * 0.38, radius * 0.5, radius * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-radius * 0.08, radius * 0.1);
  ctx.lineTo(radius * 0.42, -radius * 0.42);
  ctx.moveTo(radius * 0.08, radius * 0.18);
  ctx.lineTo(radius * 0.58, -radius * 0.34);
  ctx.stroke();
  fillShape(ctx, radius, [[0.5, -0.48], [0.72, -0.58], [0.66, -0.28]]);
}

function drawBerthaSymbol(ctx, radius) {
  ctx.lineWidth = Math.max(1.7, radius * 0.12);
  fillRectScaled(ctx, radius, -0.62, 0.32, 1.24, 0.22);
  fillRectScaled(ctx, radius, -0.42, 0.14, 0.84, 0.22);
  fillShape(ctx, radius, [[-0.3, 0.12], [0.16, -0.18], [0.34, 0.02], [-0.08, 0.26]]);
  ctx.beginPath();
  ctx.moveTo(0.02 * radius, -0.14 * radius);
  ctx.lineTo(0.62 * radius, -0.68 * radius);
  ctx.moveTo(0.18 * radius, -0.02 * radius);
  ctx.lineTo(0.78 * radius, -0.56 * radius);
  ctx.stroke();
  fillShape(ctx, radius, [[0.62, -0.78], [0.88, -0.68], [0.72, -0.42]]);
  ctx.beginPath();
  ctx.arc(-radius * 0.42, radius * 0.58, radius * 0.16, 0, Math.PI * 2);
  ctx.arc(radius * 0.42, radius * 0.58, radius * 0.16, 0, Math.PI * 2);
  ctx.fill();
  fillRectScaled(ctx, radius, -0.12, -0.4, 0.18, 0.18);
}

function drawMedicSymbol(ctx, radius) {
  ctx.lineWidth = Math.max(1.4, radius * 0.1);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.52, 0, Math.PI * 2);
  ctx.stroke();
  fillRectScaled(ctx, radius, -0.1, -0.34, 0.2, 0.68);
  fillRectScaled(ctx, radius, -0.34, -0.1, 0.68, 0.2);
}

function drawAegisSymbol(ctx, radius) {
  ctx.lineWidth = Math.max(1.4, radius * 0.1);
  ctx.beginPath();
  pathPoints(ctx, radius, [[0, -0.56], [0.42, -0.3], [0.42, 0.2], [0, 0.56], [-0.42, 0.2], [-0.42, -0.3]]);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function drawAmplifierSymbol(ctx, radius) {
  ctx.lineWidth = Math.max(1.4, radius * 0.1);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.38, -Math.PI * 0.65, Math.PI * 0.65);
  ctx.arc(0, 0, radius * 0.62, -Math.PI * 0.55, Math.PI * 0.55);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, radius * 0.18);
  ctx.lineTo(0, radius * 0.46);
  ctx.stroke();
}

function drawDisruptorSymbol(ctx, radius) {
  ctx.lineWidth = Math.max(1.5, radius * 0.11);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.52, -Math.PI * 0.78, -Math.PI * 0.16);
  ctx.arc(0, 0, radius * 0.52, Math.PI * 0.22, Math.PI * 0.84);
  ctx.stroke();
  fillShape(ctx, radius, [[-0.08, -0.58], [0.18, -0.14], [-0.02, -0.14], [0.12, 0.5], [-0.24, 0.02], [0, 0.02]]);
}

function drawJammerSymbol(ctx, radius) {
  ctx.lineWidth = Math.max(1.4, radius * 0.1);
  ctx.beginPath();
  ctx.arc(0, -radius * 0.1, radius * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, radius * 0.5);
  ctx.moveTo(0, radius * 0.22);
  ctx.lineTo(-radius * 0.34, radius * 0.56);
  ctx.moveTo(0, radius * 0.22);
  ctx.lineTo(radius * 0.34, radius * 0.56);
  ctx.arc(0, -radius * 0.1, radius * 0.34, -Math.PI * 0.72, -Math.PI * 0.28);
  ctx.arc(0, -radius * 0.1, radius * 0.56, -Math.PI * 0.68, -Math.PI * 0.32);
  ctx.stroke();
}

function drawMidgeSymbol(ctx, radius) {
  fillShape(ctx, radius, [[0, -0.62], [0.13, -0.16], [0.08, 0.58], [-0.08, 0.58], [-0.13, -0.16]]);
  fillShape(ctx, radius, [[-0.12, -0.18], [-0.62, -0.42], [-0.34, 0.08]]);
  fillShape(ctx, radius, [[0.12, -0.18], [0.62, -0.42], [0.34, 0.08]]);
}

function drawWaspSymbol(ctx, radius) {
  fillShape(ctx, radius, [[0, -0.68], [0.22, -0.3], [0.16, 0.32], [0, 0.68], [-0.16, 0.32], [-0.22, -0.3]]);
  fillRectScaled(ctx, radius, -0.26, -0.12, 0.52, 0.12);
  fillRectScaled(ctx, radius, -0.22, 0.16, 0.44, 0.12);
  fillShape(ctx, radius, [[-0.16, -0.28], [-0.62, -0.5], [-0.34, 0.02]]);
  fillShape(ctx, radius, [[0.16, -0.28], [0.62, -0.5], [0.34, 0.02]]);
}

function drawKiteSymbol(ctx, radius) {
  fillShape(ctx, radius, [[0, -0.68], [0.5, -0.06], [0, 0.34], [-0.5, -0.06]]);
  fillRectScaled(ctx, radius, -0.06, 0.28, 0.12, 0.34);
  fillShape(ctx, radius, [[0, 0.46], [0.38, 0.62], [0.12, 0.66]]);
}

function drawFireflySymbol(ctx, radius) {
  ctx.lineWidth = Math.max(1.4, radius * 0.1);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.24, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 6; i += 1) {
    const angle = -Math.PI / 2 + i * Math.PI / 3;
    ctx.moveTo(Math.cos(angle) * radius * 0.36, Math.sin(angle) * radius * 0.36);
    ctx.lineTo(Math.cos(angle) * radius * 0.62, Math.sin(angle) * radius * 0.62);
  }
  ctx.stroke();
}

function drawDemolisherSymbol(ctx, radius) {
  ctx.lineWidth = Math.max(1.4, radius * 0.1);
  ctx.beginPath();
  ctx.arc(0, radius * 0.08, radius * 0.38, 0, Math.PI * 2);
  ctx.stroke();
  fillShape(ctx, radius, [[-0.14, -0.34], [0.08, -0.64], [0.24, -0.3]]);
  fillShape(ctx, radius, [[0.28, -0.5], [0.48, -0.7], [0.5, -0.4]]);
}

function drawRangerSymbol(ctx, radius) {
  fillShape(ctx, radius, [[-0.58, -0.48], [0.12, 0], [-0.58, 0.48], [-0.3, 0]]);
  fillShape(ctx, radius, [[0.02, -0.48], [0.72, 0], [0.02, 0.48], [0.3, 0]]);
}

function drawInfiltratorSymbol(ctx, radius) {
  ctx.lineWidth = Math.max(1.5, radius * 0.11);
  ctx.beginPath();
  ctx.moveTo(-radius * 0.58, 0);
  ctx.quadraticCurveTo(0, -radius * 0.48, radius * 0.58, 0);
  ctx.quadraticCurveTo(0, radius * 0.48, -radius * 0.58, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.13, 0, Math.PI * 2);
  ctx.fill();
}

function drawBarricadeSymbol(ctx, radius) {
  fillShape(ctx, radius, [[-0.64, -0.42], [-0.46, -0.58], [0.64, 0.42], [0.46, 0.58]]);
  fillShape(ctx, radius, [[0.64, -0.42], [0.46, -0.58], [-0.64, 0.42], [-0.46, 0.58]]);
  fillRectScaled(ctx, radius, -0.64, -0.08, 1.28, 0.16);
  fillShape(ctx, radius, [[-0.5, -0.16], [-0.38, -0.36], [-0.26, -0.16]]);
  fillShape(ctx, radius, [[0.26, 0.16], [0.38, 0.36], [0.5, 0.16]]);
}

function drawTurretSymbol(ctx, radius) {
  ctx.lineWidth = Math.max(1.5, radius * 0.11);
  ctx.beginPath();
  ctx.arc(-radius * 0.08, radius * 0.06, radius * 0.34, 0, Math.PI * 2);
  ctx.stroke();
  fillShape(ctx, radius, [[0.08, -0.12], [0.7, -0.48], [0.78, -0.28], [0.2, 0.04]]);
  fillRectScaled(ctx, radius, -0.42, 0.38, 0.84, 0.16);
}

function drawFlakTurretSymbol(ctx, radius) {
  fillRectScaled(ctx, radius, -0.46, 0.38, 0.92, 0.16);
  fillShape(ctx, radius, [[-0.44, 0.3], [-0.14, -0.46], [0, -0.34], [-0.2, 0.32]]);
  fillShape(ctx, radius, [[0.44, 0.3], [0.14, -0.46], [0, -0.34], [0.2, 0.32]]);
  fillRectScaled(ctx, radius, -0.18, -0.02, 0.36, 0.18);
}

function drawRocketTurretSymbol(ctx, radius) {
  fillRectScaled(ctx, radius, -0.54, 0.36, 1.08, 0.18);
  fillShape(ctx, radius, [[-0.44, -0.08], [0.28, -0.48], [0.44, -0.2], [-0.28, 0.2]]);
  fillShape(ctx, radius, [[0.38, -0.62], [0.68, -0.54], [0.48, -0.32]]);
  fillRectScaled(ctx, radius, -0.16, 0.02, 0.32, 0.32);
}

function drawMortarNestSymbol(ctx, radius) {
  ctx.lineWidth = Math.max(1.5, radius * 0.11);
  fillRectScaled(ctx, radius, -0.6, 0.34, 1.2, 0.18);
  fillShape(ctx, radius, [[-0.42, 0.3], [-0.2, 0.04], [0.22, 0.04], [0.42, 0.3]]);
  ctx.beginPath();
  ctx.moveTo(-radius * 0.08, -radius * 0.02);
  ctx.lineTo(radius * 0.28, -radius * 0.54);
  ctx.moveTo(radius * 0.08, 0);
  ctx.lineTo(radius * 0.44, -radius * 0.5);
  ctx.stroke();
}

function drawRailTurretSymbol(ctx, radius) {
  ctx.lineWidth = Math.max(1.6, radius * 0.12);
  fillRectScaled(ctx, radius, -0.56, 0.36, 1.12, 0.16);
  fillRectScaled(ctx, radius, -0.2, 0.06, 0.4, 0.3);
  ctx.beginPath();
  ctx.moveTo(-radius * 0.5, -radius * 0.12);
  ctx.lineTo(radius * 0.54, -radius * 0.12);
  ctx.moveTo(-radius * 0.5, radius * 0.04);
  ctx.lineTo(radius * 0.54, radius * 0.04);
  ctx.stroke();
  fillShape(ctx, radius, [[0.54, -0.24], [0.78, -0.04], [0.54, 0.16]]);
}

function drawFactorySymbol(ctx, radius) {
  fillRectScaled(ctx, radius, -0.58, -0.04, 1.16, 0.58);
  fillRectScaled(ctx, radius, -0.48, -0.36, 0.22, 0.32);
  fillRectScaled(ctx, radius, -0.08, -0.5, 0.22, 0.46);
  fillShape(ctx, radius, [[-0.22, 0.18], [0.22, 0.18], [0, 0.48]]);
  fillRectScaled(ctx, radius, 0.28, 0.1, 0.16, 0.22);
}

const fillRectScaled = (ctx, radius, x, y, width, height) => {
  ctx.fillRect(x * radius, y * radius, width * radius, height * radius);
};

const fillShape = (ctx, radius, points) => {
  ctx.beginPath();
  pathPoints(ctx, radius, points);
  ctx.fill();
};

const pathPoints = (ctx, radius, points) => {
  points.forEach(([x, y], index) => {
    if (index) ctx.lineTo(x * radius, y * radius);
    else ctx.moveTo(x * radius, y * radius);
  });
  ctx.closePath();
};

const polygon = (ctx, radius, sides, offset = 0) => {
  for (let i = 0; i < sides; i += 1) {
    const angle = offset + i * Math.PI * 2 / sides;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
};
