import fs from 'node:fs';
import { BalanceAnalyzer } from '../src/simulation/BalanceAnalyzer.js';

const baselinePath = 'reports/balance-baseline.json';
const accept = process.argv.includes('--accept');
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const report = new BalanceAnalyzer().analyze({ seed: baseline.seed });

if (accept) {
  const winRates = report.units.map((unit) => unit.scores.matchupWinRate);
  const margins = report.units.map((unit) => unit.scores.matchupMargin);
  const contributions = report.units.map((unit) => unit.scores.marginalContribution);
  const timeouts = report.units.map((unit) => unit.scores.timeoutRate);
  const padding = 0.05;
  const nextBaseline = {
    seed: baseline.seed,
    summary: {
      meanAbsoluteWinRateDeviationMax: Number((report.summary.meanAbsoluteWinRateDeviation + padding).toFixed(6)),
    },
    unitScoreBounds: {
      matchupWinRate: { min: Number((Math.max(0, Math.min(...winRates) - padding)).toFixed(6)), max: Number((Math.min(1, Math.max(...winRates) + padding)).toFixed(6)) },
      matchupMargin: { min: Number((Math.min(...margins) - padding).toFixed(6)), max: Number((Math.max(...margins) + padding).toFixed(6)) },
      marginalContribution: { min: Number((Math.min(...contributions) - padding).toFixed(6)), max: Number((Math.max(...contributions) + padding).toFixed(6)) },
      timeoutRate: { min: 0, max: Number((Math.min(1, Math.max(...timeouts) + padding)).toFixed(6)) },
    },
  };
  fs.writeFileSync(baselinePath, `${JSON.stringify(nextBaseline, null, 2)}\n`);
  console.log(`Accepted balance baseline at ${baselinePath}`);
  process.exit(0);
}

const failures = [];
const deviation = report.summary.meanAbsoluteWinRateDeviation;
if (deviation > baseline.summary.meanAbsoluteWinRateDeviationMax) {
  failures.push(`mean absolute win-rate deviation ${deviation.toFixed(4)} exceeds ${baseline.summary.meanAbsoluteWinRateDeviationMax}`);
}

for (const unit of report.units) {
  for (const [score, bounds] of Object.entries(baseline.unitScoreBounds)) {
    const value = unit.scores[score];
    if (!Number.isFinite(value)) failures.push(`${unit.key}.${score} is not finite`);
    else if (value < bounds.min || value > bounds.max) {
      failures.push(`${unit.key}.${score} ${value.toFixed(4)} is outside [${bounds.min}, ${bounds.max}]`);
    }
  }
}

if (failures.length) {
  console.error('Balance regression check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error('Run npm run balance:accept only after reviewing an intentional balance change.');
  process.exit(1);
}

console.log(`Balance regression check passed across ${report.simulations} simulations.`);
console.log(`Mean absolute win-rate deviation: ${deviation.toFixed(4)}`);
