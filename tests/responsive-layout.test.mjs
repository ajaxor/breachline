import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../assets/reinforcements.css', import.meta.url), 'utf8');

const blockFor = (selector, source = css) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Expected ${selector} rule to exist.`);
  return match[1];
};

const propertyValue = (selector, property, source = css) => {
  const block = blockFor(selector, source);
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`${escaped}\\s*:\\s*([^;]+);`));
  assert.ok(match, `Expected ${selector} to define ${property}.`);
  return match[1].trim();
};

const mobileBlock = () => {
  const match = css.match(/@media \(max-width: 760px\) \{([\s\S]*)\}\s*$/);
  assert.ok(match, 'Expected mobile layout media query to exist.');
  return match[1];
};

test('paired draft cards preserve staggered desktop geometry', () => {
  assert.equal(propertyValue('.draft-pair', 'grid-template-rows'), 'auto auto');
  assert.equal(propertyValue('.draft-pair', 'min-height'), '360px');
  assert.equal(propertyValue('.draft-pair .unit-description:first-child', 'width'), '100%');
  assert.equal(propertyValue('.draft-pair .unit-description:last-child', 'width'), '72%');
  assert.match(propertyValue('.draft-pair .unit-description:last-child', 'transform'), /translate\(-8%, -10px\)/);
  assert.equal(propertyValue('.draft-pair-plus', 'left'), '18%');
  assert.equal(propertyValue('.draft-pair-plus', 'top'), '70%');
});

test('paired draft cards keep a narrower mobile layout to avoid overlap and clipping', () => {
  const mobile = mobileBlock();

  assert.equal(propertyValue('.draft-pair', 'min-height', mobile), '0');
  assert.equal(propertyValue('.draft-pair .unit-description:last-child', 'width', mobile), '78%');
  assert.match(propertyValue('.draft-pair .unit-description:last-child', 'transform', mobile), /translate\(-7%, -8px\)/);
  assert.equal(propertyValue('.draft-pair-plus', 'left', mobile), '12%');
  assert.equal(propertyValue('.draft-pair-plus', 'top', mobile), '72%');
  assert.equal(propertyValue('.draft-pair-plus', 'font-size', mobile), '46px');
});

test('reinforcement stylesheet remains reviewable source, not single-line minified output', () => {
  const sourceLines = css.trim().split('\n').length;
  assert.ok(sourceLines > 50, `Expected readable multi-line CSS, found ${sourceLines} lines.`);
});
