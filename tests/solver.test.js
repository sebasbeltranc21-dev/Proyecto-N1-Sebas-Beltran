const assert = require('node:assert/strict');
const Solver = require('../solver.js');

function exact(value) {
  return Solver.formatNumber(value);
}

function expectExact(values, expected) {
  assert.deepEqual(values.map(exact), expected);
}

const unique = [['2', '1', '5'], ['1', '-1', '1']];
const fractional = [['1', '0', '1/3'], ['0', '2', '1/2']];
const infinite = [['1', '1', '2'], ['2', '2', '4']];
const none = [['1', '1', '2'], ['2', '2', '5']];
const infinite3 = [['1', '2', '1', '4'], ['2', '4', '2', '8'], ['0', '1', '1', '3']];
const identity5 = [
  ['1', '0', '0', '0', '0', '3'],
  ['0', '1', '0', '0', '0', '-2'],
  ['0', '0', '1', '0', '0', '5'],
  ['0', '0', '0', '1', '0', '7'],
  ['0', '0', '0', '0', '1', '-1']
];

for (const method of ['gauss-jordan', 'gaussian']) {
  let result = Solver.solve(unique, method);
  assert.equal(result.classification, 'unique');
  expectExact(result.solution, ['2', '1']);
  assert.equal(result.verification.type, 'unique');
  assert.equal(result.verification.verified, true);
  assert.deepEqual(result.verification.residuals.map(exact), ['0', '0']);

  result = Solver.solve(fractional, method);
  assert.equal(result.classification, 'unique');
  expectExact(result.solution, ['1/3', '1/4']);
  assert.equal(result.verification.type, 'unique');
  assert.equal(result.verification.verified, true);
  assert.deepEqual(result.verification.residuals.map(exact), ['0', '0']);

  result = Solver.solve(infinite, method);
  assert.equal(result.classification, 'infinite');
  assert.equal(result.solution, null);
  assert.deepEqual(result.parametricSolution.parameters.map(p => p.name), ['t1']);
  assert.equal(result.parametricSolution.expressions[0].text, '2 − t1');
  assert.equal(result.parametricSolution.expressions[1].text, 't1');
  assert.equal(result.verification.type, 'infinite');
  assert.equal(result.verification.verified, true);
  assert.ok(result.verification.residuals.every(residual =>
    residual.constant.isZero() &&
    residual.parameters.every(item => item.coefficient.isZero())
  ));

  result = Solver.solve(infinite3, method);
  assert.equal(result.classification, 'infinite');
  assert.deepEqual(result.parametricSolution.parameters.map(p => p.name), ['t1']);
  assert.equal(result.parametricSolution.expressions[0].text, '-2 + t1');
  assert.equal(result.parametricSolution.expressions[1].text, '3 − t1');
  assert.equal(result.parametricSolution.expressions[2].text, 't1');
  assert.equal(result.verification.type, 'infinite');
  assert.equal(result.verification.verified, true);
  assert.ok(result.verification.residuals.every(residual =>
    residual.constant.isZero() &&
    residual.parameters.every(item => item.coefficient.isZero())
  ));

  result = Solver.solve(none, method);
  assert.equal(result.classification, 'none');
  assert.equal(result.solution, null);
  assert.equal(result.parametricSolution, null);
  assert.ok(result.contradiction);
  assert.equal(result.contradiction.row, 1);
  assert.equal(result.contradiction.equation, '0 = -1/2');
  assert.equal(result.verification.type, 'none');
  assert.equal(result.verification.verified, null);

  const fractionalNone = Solver.solve([
    ['1/2', '1/3', '1/4'],
    ['1', '2/3', '3/4']
  ], method);
  assert.equal(fractionalNone.classification, 'none');
  assert.ok(fractionalNone.contradiction);
  assert.equal(fractionalNone.contradiction.row, 1);
  assert.equal(fractionalNone.contradiction.equation, '0 = -1/8');

  result = Solver.solve(identity5, method);
  assert.equal(result.classification, 'unique');
  expectExact(result.solution, ['3', '-2', '5', '7', '-1']);
}

assert.equal(Solver.formatNumber('6/8'), '3/4');
assert.equal(Solver.formatNumber('-10/20'), '-1/2');
assert.equal(Solver.formatNumber('0.125'), '1/8');
assert.equal(Solver.formatNumber('1e-3'), '1/1000');
assert.equal(Solver.formatNumber('1,5'), '3/2');
assert.equal(Solver.formatNumber('.5'), '1/2');
assert.equal(Solver.formatNumber('2.'), '2');
assert.equal(Solver.formatNumber('-0.25e2'), '-25');\nassert.equal(Solver.formatDecimal('1/3'), '0.333333');\nassert.equal(Solver.formatDecimal('1/4'), '0.25');\nassert.equal(Solver.formatDecimal('-1/2'), '-0.5');

const visual = Solver.solve(unique, 'gauss-jordan');
assert.ok(Array.isArray(visual.steps[0].focus.rows));
assert.equal(visual.steps[0].focus.pivot, null);
assert.ok(visual.steps.some(step => Array.isArray(step.focus.pivot) && step.focus.pivot.length === 2));
assert.ok(visual.steps.some(step => step.focus.targetRow >= 0));

const hugePivot = Solver.solve([
  ['1000000000000000000000000', '1', '1000000000000000000000001'],
  ['1', '1', '2']
], 'gauss-jordan');
assert.equal(hugePivot.classification, 'unique');
expectExact(hugePivot.solution, ['1', '1']);
assert.throws(() => Solver.solve([['1/0', '1']], 'gauss-jordan'), /denominador cero/);
assert.throws(() => Solver.solve([['abc', '1']], 'gauss-jordan'), /Entrada no válida/);
assert.throws(() => Solver.solve([['1', '2'], ['3']], 'gauss-jordan'), /mismo número de columnas/);
assert.throws(() => Solver.solve(Array.from({ length: 6 }, () => ['1', '2']), 'gauss-jordan'), /entre 1 y 5 filas/);
assert.throws(() => Solver.solve([['1']], 'gauss-jordan'), /entre 2 y 6 columnas/);

console.log('✅ Todos los tests de la Fase 3 pasaron.');
