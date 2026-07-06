import fs from 'node:fs';
import path from 'node:path';
import { BalanceAnalyzer } from '../src/simulation/BalanceAnalyzer.js';

const outputArg = process.argv.find((argument) => argument.startsWith('--output='));
const seedArg = process.argv.find((argument) => argument.startsWith('--seed='));
const output = outputArg?.slice('--output='.length) ?? 'reports/balance-report.json';
const seed = Number(seedArg?.slice('--seed='.length) ?? 12345);

if (!Number.isInteger(seed)) throw new Error(`Invalid seed: ${seedArg}`);

const report = new BalanceAnalyzer().analyze({ seed });
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);

console.table(report.units.map((unit) => ({
  unit: unit.name,
  cost: unit.cost,
  winRate: unit.scores.matchupWinRate.toFixed(3),
  margin: unit.scores.matchupMargin.toFixed(3),
  contribution: unit.scores.marginalContribution.toFixed(3),
  timeouts: unit.scores.timeoutRate.toFixed(3),
})));
console.log(`Balance deviation: ${report.summary.meanAbsoluteWinRateDeviation.toFixed(3)} across ${report.simulations} simulations`);
console.log(`Wrote ${output}`);
