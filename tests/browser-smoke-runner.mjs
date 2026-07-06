const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function click(selector) {
  const element = document.querySelector(selector);
  assert(element, `Missing element: ${selector}`);
  element.click();
  await sleep(40);
  return element;
}

async function tryInspectCell(canvas, rect, row, column) {
  const points = [
    {
      clientX: rect.left + (column + 0.5) / 14 * rect.width,
      clientY: rect.top + (row + 0.5) / 8 * rect.height,
    },
    {
      clientX: rect.left + (row + 0.5) / 8 * rect.width,
      clientY: rect.top + (14 - column - 0.5) / 14 * rect.height,
    },
  ];

  for (const point of points) {
    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, ...point }));
    await sleep(15);
    if (!document.querySelector('#unitInspector').hidden) return true;
  }
  return false;
}

async function run() {
  await sleep(100);
  await click('#btnStartGame');
  assert(document.querySelector('#screenTitle').hidden, 'Title screen did not close');
  assert(!document.querySelector('#gameShell').hidden, 'Game shell did not open');

  for (let remaining = 3; remaining > 0; remaining -= 1) {
    const choices = document.querySelectorAll('[data-draft-unit]');
    assert(choices.length === 3, `Expected three draft choices with ${remaining} drafts remaining`);
    choices[0].click();
    await sleep(70);
  }

  assert(document.querySelector('#draftOverlay').hidden, 'Opening draft did not close');
  assert(document.querySelector('#screenBattle').classList.contains('active'), 'Game did not transition to deployment');
  assert(document.querySelectorAll('#rosterList [data-unit-type]').length > 0, 'Compact roster is empty');

  await click('#rosterExpand');
  const fullCards = document.querySelectorAll('[data-full-roster-unit]');
  assert(fullCards.length > 0, 'Expanded roster has no unit cards');
  const selectedType = fullCards[0].dataset.fullRosterUnit;
  fullCards[0].click();
  await sleep(50);
  assert(document.querySelector('#rosterOverlay').hidden, 'Expanded roster did not close after selection');
  assert(document.querySelector(`#rosterList [data-unit-type="${selectedType}"]`)?.classList.contains('selected'), 'Expanded roster selection did not update compact roster');

  const canvas = document.querySelector('#field');
  await sleep(120);
  const rect = canvas.getBoundingClientRect();
  assert(rect.width > 0 && rect.height > 0, 'Battlefield canvas has no layout size');
  let inspected = false;
  for (let row = 0; row < 8 && !inspected; row += 1) {
    for (let column = 9; column < 14 && !inspected; column += 1) {
      inspected = await tryInspectCell(canvas, rect, row, column);
    }
  }
  assert(inspected, 'Could not inspect a hostile unit on the deployment grid');
  assert(document.querySelector('#unitInspector .unit-description'), 'Hostile inspector did not render a full unit description');
  assert(document.querySelector('#unitInspector .unit-description-role'), 'Hostile inspector did not render the unit role');

  const result = document.createElement('pre');
  result.id = 'smoke-result';
  result.dataset.status = 'pass';
  result.textContent = 'Browser smoke test passed';
  document.body.appendChild(result);
}

run().catch((error) => {
  const result = document.createElement('pre');
  result.id = 'smoke-result';
  result.dataset.status = 'fail';
  result.textContent = error.stack || error.message;
  document.body.appendChild(result);
});