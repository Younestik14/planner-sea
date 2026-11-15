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

// ---- Tarea 2 · ejemplos resueltos de la Guía técnica del REBT, Anexo 2 (Cu PVC → γ = 48, cos φ = 1, 230 V) ----
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
const porCaida = (I, L, pctMax) => C.seccionPorCaida({ sistema: 'mono', L, I, cos: 1, mat: 'cu', aisl: 'PVC', U: 230, pctMax });

test('intensidad y potencia', () => {
  assert.equal(C.intensidad({ sistema: 'mono', P: 5750, U: 230, cos: 1 }), 25);
  near(C.intensidad({ sistema: 'tri', P: 145000, U: 400, cos: 0.9 }), 232.5, 0.1);
  assert.equal(C.potencia({ sistema: 'mono', I: 16, U: 230, cos: 1 }), 3680);
});

test('sección por caída: Guía Anexo 2, ejemplos 2, 3 y 4', () => {
  let r = porCaida(25, 10, 1); near(r.Smin, 4.52, 0.01); assert.equal(r.S, 6);
  r = porCaida(25, 22, 1); near(r.Smin, 9.96, 0.01); assert.equal(r.S, 10);
  r = porCaida(16, 30, 3); near(r.Smin, 2.90, 0.01); assert.equal(r.S, 4);
  r = porCaida(25, 35, 1); near(r.Smin, 15.85, 0.01); assert.equal(r.S, 16);
});

test('sección por caída: Guía Anexo 2, ejemplo 5', () => {
  assert.deepEqual([10, 22, 35].map(L => porCaida(40, L, 1).S), [10, 16, 35]);
});

test('caída de tensión sin reactancia', () => {
  near(C.caida({ sistema: 'mono', L: 30, I: 16, cos: 1, S: 4, mat: 'cu', aisl: 'PVC', U: 230 }).pct, 2.17, 0.01);
});

test('caída de tensión con reactancia (S > 120 mm²)', () => {
  const R = 100 / (44 * 185), X = 0.20 * R, esperado = Math.sqrt(3) * 300 * (R * 0.8 + X * 0.6);
  near(C.caida({ sistema: 'tri', L: 100, I: 300, cos: 0.8, S: 185, mat: 'cu', aisl: 'XLPE', U: 400 }).dU, esperado, 1e-9);
});

test('cos φ = 1 con 240 mm²: la reactancia no suma y no hay NaN', () => {
  const r = C.caida({ sistema: 'tri', L: 100, I: 300, cos: 1, S: 240, mat: 'cu', aisl: 'XLPE', U: 400 });
  near(r.dU, Math.sqrt(3) * 300 * 100 / (44 * 240), 1e-9);
});

test('sección del conductor de protección (ITC-BT-19 tabla 2)', () => {
  assert.deepEqual([10, 25, 35, 50, 95, 120].map(C.seccionProteccion), [10, 16, 16, 25, 50, 70]);
});

test('circuitos de vivienda (ITC-BT-25)', () => {
  assert.deepEqual(C.CIRC_VIV.C2, { label: 'C2 · Tomas de uso general', S: 2.5, In: 16 });
  assert.equal(C.CIRC_VIV.C3.S, 6);
  assert.equal(C.CIRC_VIV.C12_C4.In, 20);
});

// ---- Tarea 3 · protección y dimensionado completo ----
test('protección con PIA', () => {
  assert.equal(C.proteccion({ Ib: 50.94, Iz: 57, tipo: 'pia' }).In, null);
  assert.equal(C.proteccion({ Ib: 50.94, Iz: 57, tipo: 'pia' }).cumple, false);
  const r = C.proteccion({ Ib: 50.94, Iz: 77, tipo: 'pia' }); assert.equal(r.In, 63); assert.equal(r.cumple, true);
  assert.equal(C.proteccion({ Ib: 16, Iz: 20, tipo: 'pia' }).In, 16);
});

test('protección con fusible gG', () => {
  const r = C.proteccion({ Ib: 30, Iz: 40, tipo: 'gG' });
  assert.equal(r.In, 32); near(r.I2, 51.2, 1e-9); assert.equal(r.cumple, true);
});

const MOTOR = { linea: 'fuerza', sistema: 'tri', U: 400, cos: 0.85, P: 30000, L: 50, mat: 'cu', aisl: 'XLPE', metodo: 'B1', T: 40, disp: 1, n: 1, capas: 1, prot: 'pia' };

test('dimensionar: motor 30 kW, manda la protección', () => {
  const r = C.dimensionar(MOTOR);
  assert.equal(r.ok, true); near(r.Ib, 50.94, 0.01);
  assert.equal(r.S, 16); assert.equal(r.Iz, 77); assert.equal(r.In, 63); assert.equal(r.manda, 'proteccion');
  assert.equal(r.Sp, 16);
  assert.ok(r.refs.some(x => x.includes('C.52.1 bis')));
});

test('dimensionar: C2 de vivienda (Guía Anexo 2, ejemplo 3), manda la caída', () => {
  const r = C.dimensionar({ linea: 'viv', circuito: 'C2', sistema: 'mono', U: 230, L: 30, mat: 'cu', aisl: 'PVC', metodo: 'B1', T: 40, disp: 1, n: 1, capas: 1, prot: 'pia' });
  assert.equal(r.Ib, 16); assert.equal(r.S, 4); assert.equal(r.manda, 'caida'); assert.equal(r.In, 16);
});

test('dimensionar: con factores de temperatura y agrupamiento', () => {
  const r = C.dimensionar({ ...MOTOR, T: 50, n: 3 });
  near(r.factor, 0.63, 1e-9);
  assert.equal(r.S, 25); near(r.Iz, 63, 1e-9); assert.equal(r.In, 63); assert.equal(r.manda, 'intensidad');
  assert.ok(r.pasos.some(p => p.t.includes('50 °C')));
});

test('dimensionar: fuera del alcance de la tabla', () => {
  const r = C.dimensionar({ ...MOTOR, P: undefined, I: 700, aisl: 'PVC' });
  assert.equal(r.ok, false); assert.match(r.error, /Fuera del alcance/);
});

test('dimensionar: manda la sección mínima', () => {
  const r = C.dimensionar({ linea: 'di_unico', sistema: 'mono', U: 230, cos: 1, I: 10, L: 2, mat: 'cu', aisl: 'PVC', metodo: 'B1', T: 40, disp: 1, n: 1, capas: 1, prot: 'pia' });
  assert.equal(r.S, 6); assert.equal(r.manda, 'minima');
});

test('dimensionar: enterrado con resistividad', () => {
  const r = C.dimensionar({ ...MOTOR, metodo: 'D', T: 25, rho: 2.5, directo: false });
  assert.equal(r.ok, true); near(r.factor, 1, 1e-9);
  assert.ok(r.refs.some(x => x.includes('C.52.2 bis')));
});

// ---- Tarea 4 · lectura de números escritos por el usuario ----
test('parseNum acepta coma o punto decimal', () => {
  assert.equal(C.parseNum('2,5'), 2.5);
  assert.equal(C.parseNum('2.5'), 2.5);
  assert.equal(C.parseNum(' 1.000,5 '), 1000.5);
  assert.ok(Number.isNaN(C.parseNum('')));
  assert.ok(Number.isNaN(C.parseNum('abc')));
});

// ---- Revisión final ----
test('enterrado: avisa de que no se aplica agrupamiento', () => {
  const r = C.dimensionar({ ...MOTOR, metodo: 'D', T: 25, rho: 2.5, directo: false });
  assert.ok(r.avisos.some(a => a.includes('agrupamiento')));
});

// ======== Fase 2 ========
// Ejercicios resueltos de «3UT_CIE_Diseño instalaciones BT» (ITC-BT-10)
test('coeficiente de simultaneidad (ITC-BT-10 tabla 1)', () => {
  assert.equal(C.CS_VIV(1), 1); assert.equal(C.CS_VIV(4), 3.8); assert.equal(C.CS_VIV(14), 11.3);
  assert.equal(C.CS_VIV(21), 15.3); near(C.CS_VIV(24), 16.8, 1e-9);
});

test('previsión: ejercicio 3.1 (12 básicas + 2 elevadas)', () => {
  near(C.previsionEdificio({ basicas: 12, elevadas: 2 }).total, 70544, 1);
});

test('previsión: ejercicio 3.2 (locales y oficinas, con mínimos)', () => {
  const r = C.previsionEdificio({ locales: [{ m2: 25 }, { m2: 50 }], oficinas: [{ m2: 200, P: 35000 }, { m2: 150, P: 13500 }] });
  assert.equal(r.total, 58450);
});

test('previsión: ejercicio 3.3 (edificio completo)', () => {
  const r = C.previsionEdificio({ basicas: 20, elevadas: 4, sg: [{ label: 'Alumbrado de escalera', P: 800 }, { label: 'Ascensores', P: 12000 }, { label: 'Bomba de agua', P: 3000 }],
    garajes: [{ m2: 550, forzada: false }], locales: [{ m2: 125 }, { m2: 125 }, { m2: 125 }, { m2: 125 }] });
  near(r.CS, 16.8, 1e-9); near(r.total, 177560, 1);
});

test('previsión: industria con mínimo y tarifa nocturna', () => {
  assert.equal(C.previsionEdificio({ industrias: [{ m2: 50 }] }).total, 10350);
  assert.equal(C.previsionEdificio({ basicas: 10, nocturna: true }).total, 57500);
});

test('cortocircuito: Icc desde la potencia de cortocircuito', () => {
  near(C.iccDesdePcc({ Pcc_MVA: 500, U: 400 }), 721.69, 0.01);
});

test('cortocircuito: comprobación térmica y poder de corte', () => {
  let r = C.cortocircuito({ Icc_kA: 6, S: 16, mat: 'cu', aisl: 'PVC', t: 0.1, pdc_kA: 4.5 });
  near(r.Smin, 16.5, 0.01); assert.equal(r.cumpleTermico, false); assert.equal(r.cumplePdc, false);
  r = C.cortocircuito({ Icc_kA: 6, S: 25, mat: 'cu', aisl: 'PVC', t: 0.1, pdc_kA: 6 });
  assert.equal(r.cumpleTermico, true); assert.equal(r.cumplePdc, true);
  near(r.tmax, (115 * 25 / 6000) ** 2, 1e-9);
});

test('sección de un motor: Ib × 1,25 (ITC-BT-47)', () => {
  const r = C.dimensionar({ ...MOTOR, receptor: 'motor' });
  near(r.Ib, 63.68, 0.01); assert.equal(r.S, 25); assert.equal(r.In, 80); assert.equal(r.manda, 'proteccion');
  assert.ok(r.pasos.some(p => p.t.includes('ITC-BT-47')));
});

test('lámparas de descarga: Ib × 1,8 (ITC-BT-44)', () => {
  const r = C.dimensionar({ ...MOTOR, linea: 'alum', P: 3000, cos: 0.9, sistema: 'mono', U: 230, receptor: 'descarga' });
  near(r.Ib, 3000 / (230 * 0.9) * 1.8, 1e-9);
});

// ======== Fase 3 ========
test('tubos ITC-BT-21 (tablas 2, 5, 7 y 9)', () => {
  assert.equal(C.tubo({ sistema: 'superficie', S: 2.5, n: 3 }).D, 16);
  assert.equal(C.tubo({ sistema: 'empotrado', S: 6, n: 3 }).D, 25);
  assert.equal(C.tubo({ sistema: 'aire', S: 16, n: 5 }).D, 40);
  assert.equal(C.tubo({ sistema: 'enterrado', S: 10, n: 5 }).D, 63);
  assert.equal(C.tubo({ sistema: 'enterrado', S: 50, n: 8 }).D, 125);
  assert.equal(C.tubo({ sistema: 'superficie', S: 240, n: 2 }).D, 75);
});

test('tubos fuera de tabla', () => {
  assert.equal(C.tubo({ sistema: 'aire', S: 25, n: 2 }).D, null);
  assert.equal(C.tubo({ sistema: 'empotrado', S: 240, n: 3 }).D, null);
  assert.equal(C.tubo({ sistema: 'superficie', S: 4, n: 6 }).D, null);
  // con el diámetro del conductor: D_int = Φ·√(f·n), f = 3 empotrado
  near(C.tubo({ sistema: 'empotrado', S: 4, n: 6, phi: 4.2 }).Dint, 4.2 * Math.sqrt(18), 1e-9);
});

test('puesta a tierra: resistencia de electrodos', () => {
  assert.equal(C.tierra({ tipo: 'pica', rho: 500, L: 2 }).R, 250);
  assert.equal(C.tierra({ tipo: 'placa', rho: 50, P: 4 }).R, 10);
  assert.equal(C.tierra({ tipo: 'conductor', rho: 500, L: 40 }).R, 25);
  assert.equal(C.tierra({ tipo: 'pica', rho: 500, L: 2, n: 4 }).R, 62.5);
});

test('puesta a tierra: tensión de contacto con el diferencial', () => {
  let r = C.tierra({ tipo: 'pica', rho: 500, L: 2, n: 4, Ia: 0.03, UL: 24 });
  near(r.Uc, 1.875, 1e-9); assert.equal(r.cumple, true); near(r.Rmax, 800, 1e-9);
  r = C.tierra({ tipo: 'pica', rho: 3000, L: 2, Ia: 0.3, UL: 24 });
  assert.equal(r.cumple, false);
});

test('compensación de reactiva', () => {
  const r = C.reactiva({ P_kW: 100, cos1: 0.8, cos2: 0.95, U: 400, conexion: 'triangulo' });
  near(r.Qc_kvar, 100 * (0.75 - Math.tan(Math.acos(0.95))), 1e-9); near(r.Qc_kvar, 42.13, 0.01);
  near(r.C_uF, r.Qc_kvar * 1000 / (3 * 2 * Math.PI * 50 * 400 ** 2) * 1e6, 1e-9);
  const e = C.reactiva({ P_kW: 100, cos1: 0.8, cos2: 0.95, U: 400, conexion: 'estrella' });
  near(e.C_uF, 3 * r.C_uF, 1e-9);
  assert.equal(C.reactiva({ P_kW: 100, cos1: 0.95, cos2: 0.9, U: 400, conexion: 'estrella' }).Qc_kvar, 0);
});
