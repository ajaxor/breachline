const GRAPHIC_ROLE = Object.freeze({
  rifleman: 'melee', gunner: 'melee', bulwark: 'melee', ram: 'melee', lancer: 'melee', runner: 'melee', phalanx: 'melee',
  marksman: 'ranged', fusilier: 'ranged', flak: 'ranged', artillery: 'ranged',
  medic: 'support', aegis: 'support', amplifier: 'support', disruptor: 'support', jammer: 'support',
  midge: 'flying', wasp: 'flying', kite: 'flying', firefly: 'flying',
  demolisher: 'specialist', ranger: 'specialist', infiltrator: 'specialist',
  barricade: 'structure', turret: 'structure',
});

const PORTRAIT_SOURCES = Object.freeze({
  rifleman: 'data:image/png;base64,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',
  bulwark: 'data:image/png;base64,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',
  lancer: 'data:image/png;base64,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',
});

const portraits = new Map();

if (typeof Image !== 'undefined') {
  await Promise.all(Object.entries(PORTRAIT_SOURCES).map(([graphic, source]) => new Promise((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => { portraits.set(graphic, image); resolve(); };
    image.onerror = () => resolve();
    image.src = source;
  })));
}

export const drawUnitGraphic = (context, graphic, x, y, radius, color, role = null) => {
  const silhouetteRole = role ?? GRAPHIC_ROLE[graphic] ?? null;
  context.save();
  context.translate(x, y);
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = Math.max(1.5, radius * 0.12);
  context.lineCap = 'round';
  context.lineJoin = 'round';

  context.save();
  context.globalAlpha *= 0.18;
  context.beginPath();
  unitBodyPath(context, silhouetteRole, radius);
  context.fill();
  context.restore();
  context.beginPath();
  unitBodyPath(context, silhouetteRole, radius);
  context.stroke();

  const portrait = portraits.get(graphic);
  if (portrait) {
    const size = radius * 1.48;
    context.drawImage(portrait, -size / 2, -size / 2, size, size);
  } else {
    context.lineWidth = Math.max(1.2, radius * 0.09);
    drawUnitDetails(context, graphic, radius);
  }
  context.restore();
};

const unitBodyPath = (ctx, role, radius) => {
  if (role === 'melee') ctx.roundRect(-radius * 0.78, -radius * 0.78, radius * 1.56, radius * 1.56, radius * 0.18);
  else if (role === 'ranged') polygon(ctx, radius, 3, -Math.PI / 2);
  else if (role === 'support') ctx.arc(0, 0, radius, 0, Math.PI * 2);
  else if (role === 'flying') { ctx.moveTo(-radius, 0); ctx.quadraticCurveTo(-radius * 0.35, -radius, 0, -radius * 0.2); ctx.quadraticCurveTo(radius * 0.35, -radius, radius, 0); ctx.quadraticCurveTo(radius * 0.35, radius, 0, radius * 0.2); ctx.quadraticCurveTo(-radius * 0.35, radius, -radius, 0); ctx.closePath(); }
  else if (role === 'specialist') polygon(ctx, radius * 1.05, 4, -Math.PI / 2);
  else if (role === 'structure') polygon(ctx, radius, 6, Math.PI / 6);
  else ctx.rect(-radius, -radius, radius * 2, radius * 2);
};

const drawUnitDetails = (ctx, graphic, radius) => {
  ctx.beginPath();
  if (graphic === 'rifleman') {
    ctx.arc(-radius * 0.18, -radius * 0.22, radius * 0.2, 0, Math.PI * 2);
    ctx.moveTo(-radius * 0.1, 0); ctx.lineTo(radius * 0.52, radius * 0.42);
    ctx.moveTo(radius * 0.25, radius * 0.25); ctx.lineTo(radius * 0.72, -radius * 0.18);
  } else if (graphic === 'gunner') {
    ctx.arc(-radius * 0.22, -radius * 0.2, radius * 0.18, 0, Math.PI * 2);
    ctx.moveTo(-radius * 0.05, 0); ctx.lineTo(radius * 0.58, -radius * 0.18);
    ctx.moveTo(radius * 0.2, -radius * 0.08); ctx.lineTo(radius * 0.72, -radius * 0.48);
    ctx.moveTo(radius * 0.18, 0.08); ctx.lineTo(radius * 0.68, radius * 0.34);
  } else if (graphic === 'bulwark') {
    ctx.rect(-radius * 0.48, -radius * 0.52, radius * 0.96, radius * 1.04);
    ctx.moveTo(-radius * 0.7, -radius * 0.1); ctx.lineTo(radius * 0.7, -radius * 0.1);
    ctx.moveTo(0, -radius * 0.52); ctx.lineTo(0, radius * 0.52);
  } else if (graphic === 'ram') {
    ctx.moveTo(-radius * 0.65, -radius * 0.35); ctx.lineTo(radius * 0.35, -radius * 0.35); ctx.lineTo(radius * 0.75, 0); ctx.lineTo(radius * 0.35, radius * 0.35); ctx.lineTo(-radius * 0.65, radius * 0.35);
    ctx.moveTo(-radius * 0.35, -radius * 0.55); ctx.lineTo(-radius * 0.35, radius * 0.55);
  } else if (graphic === 'lancer') {
    ctx.arc(-radius * 0.25, 0, radius * 0.22, 0, Math.PI * 2);
    ctx.moveTo(-radius * 0.05, 0); ctx.lineTo(radius * 0.8, -radius * 0.55);
    ctx.moveTo(radius * 0.42, -radius * 0.3); ctx.lineTo(radius * 0.82, -radius * 0.58);
  } else if (graphic === 'runner') {
    ctx.moveTo(-radius * 0.65, -radius * 0.35); ctx.lineTo(radius * 0.25, -radius * 0.35);
    ctx.moveTo(-radius * 0.45, 0); ctx.lineTo(radius * 0.55, 0);
    ctx.moveTo(-radius * 0.25, radius * 0.35); ctx.lineTo(radius * 0.75, radius * 0.35);
  } else if (graphic === 'phalanx') {
    ctx.moveTo(-radius * 0.55, -radius * 0.55); ctx.lineTo(-radius * 0.55, radius * 0.55);
    ctx.moveTo(0, -radius * 0.55); ctx.lineTo(0, radius * 0.55);
    ctx.moveTo(radius * 0.55, -radius * 0.55); ctx.lineTo(radius * 0.55, radius * 0.55);
    ctx.moveTo(-radius * 0.7, 0); ctx.lineTo(radius * 0.7, 0);
  } else if (graphic === 'marksman') {
    ctx.moveTo(-radius * 0.62, radius * 0.38); ctx.lineTo(radius * 0.7, -radius * 0.15);
    ctx.moveTo(radius * 0.08, radius * 0.08); ctx.lineTo(radius * 0.25, radius * 0.45);
    ctx.arc(-radius * 0.2, radius * 0.18, radius * 0.16, 0, Math.PI * 2);
  } else if (graphic === 'fusilier') {
    ctx.moveTo(-radius * 0.55, radius * 0.45); ctx.lineTo(radius * 0.55, -radius * 0.2);
    ctx.moveTo(-radius * 0.35, radius * 0.1); ctx.lineTo(radius * 0.7, radius * 0.1);
    ctx.moveTo(-radius * 0.25, -radius * 0.35); ctx.lineTo(radius * 0.25, -radius * 0.35);
  } else if (graphic === 'flak') {
    ctx.arc(0, radius * 0.18, radius * 0.26, 0, Math.PI * 2);
    ctx.moveTo(-radius * 0.12, 0); ctx.lineTo(-radius * 0.46, -radius * 0.62);
    ctx.moveTo(radius * 0.12, 0); ctx.lineTo(radius * 0.46, -radius * 0.62);
    ctx.moveTo(-radius * 0.55, radius * 0.5); ctx.lineTo(radius * 0.55, radius * 0.5);
  } else if (graphic === 'demolisher') {
    ctx.arc(0, radius * 0.08, radius * 0.42, 0, Math.PI * 2);
    ctx.moveTo(radius * 0.18, -radius * 0.34); ctx.quadraticCurveTo(radius * 0.65, -radius * 0.75, radius * 0.72, -radius * 0.2);
    ctx.moveTo(-radius * 0.24, radius * 0.08); ctx.lineTo(radius * 0.24, radius * 0.08);
  } else if (graphic === 'medic') {
    ctx.moveTo(-radius * 0.48, 0); ctx.lineTo(radius * 0.48, 0);
    ctx.moveTo(0, -radius * 0.48); ctx.lineTo(0, radius * 0.48);
    ctx.arc(0, 0, radius * 0.68, 0, Math.PI * 2);
  } else if (graphic === 'aegis') {
    ctx.moveTo(0, -radius * 0.65); ctx.lineTo(radius * 0.5, -radius * 0.38); ctx.lineTo(radius * 0.42, radius * 0.25); ctx.quadraticCurveTo(0, radius * 0.7, -radius * 0.42, radius * 0.25); ctx.lineTo(-radius * 0.5, -radius * 0.38); ctx.closePath();
    ctx.moveTo(0, -radius * 0.38); ctx.lineTo(0, radius * 0.38);
  } else if (graphic === 'amplifier') {
    ctx.moveTo(-radius * 0.58, radius * 0.48); ctx.lineTo(0, -radius * 0.58); ctx.lineTo(radius * 0.58, radius * 0.48);
    ctx.moveTo(-radius * 0.3, radius * 0.48); ctx.lineTo(0, -radius * 0.05); ctx.lineTo(radius * 0.3, radius * 0.48);
    ctx.arc(0, -radius * 0.2, radius * 0.13, 0, Math.PI * 2);
  } else if (graphic === 'disruptor') {
    ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2); ctx.arc(0, 0, radius * 0.5, -Math.PI * 0.75, Math.PI * 0.15);
    ctx.moveTo(-radius * 0.72, -radius * 0.28); ctx.lineTo(-radius * 0.48, -radius * 0.42); ctx.moveTo(radius * 0.55, radius * 0.45); ctx.lineTo(radius * 0.75, radius * 0.28); ctx.moveTo(-radius * 0.18, -radius * 0.72); ctx.lineTo(radius * 0.08, -radius * 0.5);
  } else if (graphic === 'jammer') {
    ctx.arc(0, 0, radius * 0.16, 0, Math.PI * 2); ctx.arc(0, 0, radius * 0.42, -Math.PI * 0.72, Math.PI * 0.72); ctx.arc(0, 0, radius * 0.7, -Math.PI * 0.62, Math.PI * 0.62);
    ctx.moveTo(-radius * 0.15, radius * 0.05); ctx.lineTo(-radius * 0.52, radius * 0.58); ctx.moveTo(radius * 0.15, radius * 0.05); ctx.lineTo(radius * 0.52, radius * 0.58);
  } else if (graphic === 'ranger') {
    ctx.moveTo(-radius * 0.55, -radius * 0.48); ctx.lineTo(radius * 0.25, 0); ctx.lineTo(-radius * 0.55, radius * 0.48); ctx.moveTo(radius * 0.15, -radius * 0.52); ctx.lineTo(radius * 0.72, 0); ctx.lineTo(radius * 0.15, radius * 0.52);
  } else if (graphic === 'infiltrator') {
    ctx.moveTo(-radius * 0.5, radius * 0.05); ctx.quadraticCurveTo(0, -radius * 0.45, radius * 0.5, radius * 0.05); ctx.moveTo(-radius * 0.28, radius * 0.2); ctx.lineTo(radius * 0.28, radius * 0.2);
  } else if (graphic === 'midge') {
    ctx.ellipse(0, 0, radius * 0.16, radius * 0.5, 0, 0, Math.PI * 2); ctx.moveTo(-radius * 0.55, -radius * 0.15); ctx.lineTo(radius * 0.55, radius * 0.15);
  } else if (graphic === 'wasp') {
    ctx.ellipse(0, 0, radius * 0.24, radius * 0.65, 0, 0, Math.PI * 2); ctx.moveTo(-radius * 0.18, -radius * 0.2); ctx.lineTo(radius * 0.18, -radius * 0.2); ctx.moveTo(-radius * 0.2, radius * 0.15); ctx.lineTo(radius * 0.2, radius * 0.15); ctx.moveTo(0, -radius * 0.65); ctx.lineTo(0, -radius * 0.95);
  } else if (graphic === 'kite') {
    ctx.moveTo(0, -radius * 0.72); ctx.lineTo(0, radius * 0.72); ctx.moveTo(-radius * 0.48, 0); ctx.lineTo(radius * 0.48, 0); ctx.moveTo(0, radius * 0.35); ctx.lineTo(radius * 0.5, radius * 0.72);
  } else if (graphic === 'firefly') {
    ctx.arc(0, 0, radius * 0.34, 0, Math.PI * 2); ctx.moveTo(-radius * 0.5, -radius * 0.4); ctx.lineTo(radius * 0.5, radius * 0.4); ctx.moveTo(radius * 0.5, -radius * 0.4); ctx.lineTo(-radius * 0.5, radius * 0.4);
  } else if (graphic === 'artillery') {
    ctx.arc(0, radius * 0.08, radius * 0.48, 0, Math.PI * 2); ctx.moveTo(0, -radius * 0.1); ctx.lineTo(radius * 0.76, -radius * 0.68); ctx.moveTo(-radius * 0.52, radius * 0.62); ctx.lineTo(radius * 0.52, radius * 0.62);
  } else if (graphic === 'barricade') {
    ctx.moveTo(-radius * 0.78, -radius * 0.48); ctx.lineTo(radius * 0.15, radius * 0.48); ctx.moveTo(-radius * 0.15, -radius * 0.48); ctx.lineTo(radius * 0.78, radius * 0.48); ctx.moveTo(-radius * 0.72, radius * 0.75); ctx.lineTo(-radius * 0.5, radius * 0.42); ctx.moveTo(radius * 0.72, radius * 0.75); ctx.lineTo(radius * 0.5, radius * 0.42);
  } else if (graphic === 'turret') {
    ctx.arc(0, 0, radius * 0.55, 0, Math.PI * 2); ctx.moveTo(0, 0); ctx.lineTo(radius * 0.9, -radius * 0.42); ctx.moveTo(-radius * 0.42, radius * 0.55); ctx.lineTo(-radius * 0.7, radius * 0.88); ctx.moveTo(radius * 0.42, radius * 0.55); ctx.lineTo(radius * 0.7, radius * 0.88);
  }
  ctx.stroke();
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
