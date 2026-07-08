const GRAPHIC_ROLE = Object.freeze({
  rifleman: 'melee', gunner: 'melee', bulwark: 'melee', ram: 'melee', lancer: 'melee', runner: 'melee', phalanx: 'melee',
  marksman: 'ranged', fusilier: 'ranged', flak: 'ranged', artillery: 'ranged',
  medic: 'support', aegis: 'support', amplifier: 'support', disruptor: 'support', jammer: 'support',
  midge: 'flying', wasp: 'flying', kite: 'flying', firefly: 'flying',
  demolisher: 'specialist', ranger: 'specialist', infiltrator: 'specialist',
  barricade: 'structure', turret: 'structure',
});

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

  context.lineWidth = Math.max(1.2, radius * 0.09);
  drawUnitDetails(context, graphic, radius);
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
