'use strict';
// Pruebas de Cálculos SEA: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/calc-core.js');

const iz = (metodo, aisl, cargados, mat, S) => C.izBase({ metodo, aisl, cargados, mat, S });

test('izBase cobre al aire', () => {
  assert.equal(iz('B1', 'PVC', 2, 'cu', 2.5), 20);
  assert.equal(iz('C', 'XLPE', 2, 'cu', 6), 52);
  assert.equal(iz('B1', 'XLPE', 3, 'cu', 10), 57);
  assert.equal(iz('F', 'XLPE', 2, 'cu', 240), 617);
  assert.equal(iz('A1', 'PVC', 3, 'cu', 1.5), 11.5);
});

test('izBase aluminio', () => {
  assert.equal(iz('E', 'XLPE', 3, 'al', 95), 206);
  assert.equal(iz('B2', 'PVC', 2, 'al', 16), 46);
});

test('izBase enterrado', () => {
  assert.equal(iz('D', 'XLPE', 3, 'cu', 95), 202);
  assert.equal(iz('D', 'PVC', 2, 'cu', 1.5), 20.5);
  assert.equal(iz('D', 'XLPE', 2, 'al', 16), 70);
});

test('izBase fuera de tabla', () => {
  assert.equal(iz('A1', 'PVC', 3, 'cu', 35), null);
  assert.equal(iz('F', 'XLPE', 2, 'cu', 16), null);
  assert.equal(iz('D', 'PVC', 2, 'al', 25), null);
  assert.equal(iz('B1', 'PVC', 2, 'cu', 300), null);
});

test('fTemp', () => {
  assert.deepEqual(C.fTemp({ aisl: 'XLPE', T: 33, enterrado: false }), { f: 1.05, Ttab: 35 });
  assert.deepEqual(C.fTemp({ aisl: 'PVC', T: 25, enterrado: false }), { f: 1.22, Ttab: 25 });
  assert.deepEqual(C.fTemp({ aisl: 'PVC', T: 25, enterrado: true }), { f: 1, Ttab: 25 });
  assert.deepEqual(C.fTemp({ aisl: 'XLPE', T: 41, enterrado: true }), { f: 0.83, Ttab: 45 });
  assert.throws(() => C.fTemp({ aisl: 'PVC', T: 65, enterrado: false }));
  assert.throws(() => C.fTemp({ aisl: 'PVC', T: 5, enterrado: false }));
});

test('fAgrup', () => {
  assert.deepEqual(C.fAgrup({ disp: 1, n: 3 }), { f: 0.70, ntab: 3 });
  assert.deepEqual(C.fAgrup({ disp: 4, n: 5 }), { f: 0.75, ntab: 6 });
  assert.deepEqual(C.fAgrup({ disp: 2, n: 25 }), { f: 0.70, ntab: 20 });
});

test('fCapas', () => {
  assert.equal(C.fCapas(1), 1);
  assert.equal(C.fCapas(3), 0.73);
  assert.equal(C.fCapas(7), 0.68);
  assert.equal(C.fCapas(12), 0.66);
});

test('fResist', () => {
  assert.deepEqual(C.fResist({ rho: 1.8, directo: false }), { f: 1.05, rhoTab: 2 });
  assert.deepEqual(C.fResist({ rho: 1, directo: true }), { f: 1.5, rhoTab: 1 });
  assert.throws(() => C.fResist({ rho: 3.5, directo: false }));
});
