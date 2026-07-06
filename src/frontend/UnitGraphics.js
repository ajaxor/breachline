export const drawUnitGraphic = (context, graphic, x, y, radius, color) => {
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
  unitBodyPath(context, graphic, radius);
  context.fill();
  context.restore();
  context.beginPath();
  unitBodyPath(context, graphic, radius);
  context.stroke();

  context.lineWidth = Math.max(1.2, radius * 0.09);
  drawUnitDetails(context, graphic, radius);
  context.restore();
};

const unitBodyPath = (ctx, graphic, radius) => {
  if (graphic === 'rifleman') ctx.roundRect(-radius * 0.72, -radius * 0.82, radius * 1.44, radius * 1.64, radius * 0.2);
  else if (graphic === 'bulwark') polygon(ctx, radius, 6, Math.PI / 6);
  else if (graphic === 'marksman') polygon(ctx, radius, 3, -Math.PI / 2);
  else if (graphic === 'demolisher') polygon(ctx, radius * 1.05, 4, -Math.PI / 2);
  else if (graphic === 'medic') ctx.arc(0, 0, radius, 0, Math.PI * 2);
  else if (graphic === 'ranger') { ctx.moveTo(-radius, -radius * 0.85); ctx.lineTo(radius * 0.2, 0); ctx.lineTo(-radius, radius * 0.85); ctx.lineTo(radius, radius * 0.85); ctx.lineTo(radius * 0.35, 0); ctx.lineTo(radius, -radius * 0.85); ctx.closePath(); }
  else if (graphic === 'infiltrator') { ctx.moveTo(0, -radius * 1.15); ctx.lineTo(radius * 0.78, 0); ctx.lineTo(0, radius); ctx.lineTo(-radius * 0.78, 0); ctx.closePath(); }
  else if (graphic === 'wasp') { ctx.moveTo(-radius, 0); ctx.quadraticCurveTo(-radius * 0.35, -radius, 0, -radius * 0.2); ctx.quadraticCurveTo(radius * 0.35, -radius, radius, 0); ctx.quadraticCurveTo(radius * 0.35, radius, 0, radius * 0.2); ctx.quadraticCurveTo(-radius * 0.35, radius, -radius, 0); ctx.closePath(); }
  else if (graphic === 'artillery') polygon(ctx, radius, 8, Math.PI / 8);
  else if (graphic === 'barricade') ctx.roundRect(-radius, -radius * 0.72, radius * 2, radius * 1.44, radius * 0.12);
  else if (graphic === 'turret') ctx.arc(0, 0, radius, 0, Math.PI * 2);
  else ctx.rect(-radius, -radius, radius * 2, radius * 2);
};

const drawUnitDetails = (ctx, graphic, radius) => {
  ctx.beginPath();
  if (graphic === 'rifleman') {
    ctx.arc(-radius * 0.18, -radius * 0.22, radius * 0.2, 0, Math.PI * 2);
    ctx.moveTo(-radius * 0.1, 0); ctx.lineTo(radius * 0.52, radius * 0.42);
    ctx.moveTo(radius * 0.25, radius * 0.25); ctx.lineTo(radius * 0.72, -radius * 0.18);
  } else if (graphic === 'bulwark') {
    ctx.rect(-radius * 0.48, -radius * 0.52, radius * 0.96, radius * 1.04);
    ctx.moveTo(-radius * 0.7, -radius * 0.1); ctx.lineTo(radius * 0.7, -radius * 0.1);
    ctx.moveTo(0, -radius * 0.52); ctx.lineTo(0, radius * 0.52);
  } else if (graphic === 'marksman') {
    ctx.moveTo(-radius * 0.62, radius * 0.38); ctx.lineTo(radius * 0.7, -radius * 0.15);
    ctx.moveTo(radius * 0.08, radius * 0.08); ctx.lineTo(radius * 0.25, radius * 0.45);
    ctx.arc(-radius * 0.2, radius * 0.18, radius * 0.16, 0, Math.PI * 2);
  } else if (graphic === 'demolisher') {
    ctx.arc(0, radius * 0.08, radius * 0.42, 0, Math.PI * 2);
    ctx.moveTo(radius * 0.18, -radius * 0.34); ctx.quadraticCurveTo(radius * 0.65, -radius * 0.75, radius * 0.72, -radius * 0.2);
    ctx.moveTo(-radius * 0.24, radius * 0.08); ctx.lineTo(radius * 0.24, radius * 0.08);
  } else if (graphic === 'medic') {
    ctx.moveTo(-radius * 0.48, 0); ctx.lineTo(radius * 0.48, 0);
    ctx.moveTo(0, -radius * 0.48); ctx.lineTo(0, radius * 0.48);
    ctx.arc(0, 0, radius * 0.68, 0, Math.PI * 2);
  } else if (graphic === 'ranger') {
    ctx.moveTo(-radius * 0.55, -radius * 0.48); ctx.lineTo(radius * 0.25, 0); ctx.lineTo(-radius * 0.55, radius * 0.48);
    ctx.moveTo(radius * 0.15, -radius * 0.52); ctx.lineTo(radius * 0.72, 0); ctx.lineTo(radius * 0.15, radius * 0.52);
  } else if (graphic === 'infiltrator') {
    ctx.moveTo(-radius * 0.5, radius * 0.05); ctx.quadraticCurveTo(0, -radius * 0.45, radius * 0.5, radius * 0.05);
    ctx.moveTo(-radius * 0.28, radius * 0.2); ctx.lineTo(radius * 0.28, radius * 0.2);
  } else if (graphic === 'wasp') {
    ctx.ellipse(0, 0, radius * 0.24, radius * 0.65, 0, 0, Math.PI * 2);
    ctx.moveTo(-radius * 0.18, -radius * 0.2); ctx.lineTo(radius * 0.18, -radius * 0.2);
    ctx.moveTo(-radius * 0.2, radius * 0.15); ctx.lineTo(radius * 0.2, radius * 0.15);
    ctx.moveTo(0, -radius * 0.65); ctx.lineTo(0, -radius * 0.95);
  } else if (graphic === 'artillery') {
    ctx.arc(0, radius * 0.08, radius * 0.48, 0, Math.PI * 2);
    ctx.moveTo(0, -radius * 0.1); ctx.lineTo(radius * 0.76, -radius * 0.68);
    ctx.moveTo(-radius * 0.52, radius * 0.62); ctx.lineTo(radius * 0.52, radius * 0.62);
  } else if (graphic === 'barricade') {
    ctx.moveTo(-radius * 0.78, -radius * 0.48); ctx.lineTo(radius * 0.15, radius * 0.48);
    ctx.moveTo(-radius * 0.15, -radius * 0.48); ctx.lineTo(radius * 0.78, radius * 0.48);
    ctx.moveTo(-radius * 0.72, radius * 0.75); ctx.lineTo(-radius * 0.5, radius * 0.42);
    ctx.moveTo(radius * 0.72, radius * 0.75); ctx.lineTo(radius * 0.5, radius * 0.42);
  } else if (graphic === 'turret') {
    ctx.arc(0, 0, radius * 0.55, 0, Math.PI * 2);
    ctx.moveTo(0, 0); ctx.lineTo(radius * 0.9, -radius * 0.42);
    ctx.moveTo(-radius * 0.42, radius * 0.55); ctx.lineTo(-radius * 0.7, radius * 0.88);
    ctx.moveTo(radius * 0.42, radius * 0.55); ctx.lineTo(radius * 0.7, radius * 0.88);
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
