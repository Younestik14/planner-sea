'use strict';
// Planner SEA · Cálculos SEA: tablas del reglamento y cálculos puros (sin DOM). También se carga en Node para las pruebas.
const CALCSEA = (() => {
  const SECCIONES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300];

  // Fuente: UNE-HD 60364-5-52:2014, tablas 52.1 / 52.2 (reproducidas en «Tablas_Anexo-UNE60364-5-52BT.pdf», tablas 7.8 y 7.9)
  const METODOS = {
    A1: { label: 'A1', desc: 'Conductores aislados en un tubo empotrado en una pared térmicamente aislante' },
    A2: { label: 'A2', desc: 'Cable multiconductor en un tubo empotrado en una pared térmicamente aislante' },
    B1: { label: 'B1', desc: 'Conductores aislados en un tubo sobre pared o empotrado en obra' },
    B2: { label: 'B2', desc: 'Cable multiconductor en un tubo sobre pared o empotrado en obra' },
    C: { label: 'C', desc: 'Cables unipolares o multiconductores sobre pared o en bandeja no perforada' },
    D: { label: 'D', desc: 'Enterrado: cable en tubo enterrado (D1) o directamente enterrado (D2)' },
    E: { label: 'E', desc: 'Cable multiconductor al aire libre o en bandeja perforada (separado de la pared ≥ 0,3·D)' },
    F: { label: 'F', desc: 'Cables unipolares al aire libre o en bandeja perforada (separados de la pared ≥ D)' },
  };

  // Fuente: UNE-HD 60364-5-52:2014 tabla C.52.1 bis (40 °C en el aire), «Tablas_Anexo-UNE60364-5-52BT.pdf» tabla 7.10. null = «–»
  const COLS = ['2', '3', '4', '5a', '5b', '6a', '6b', '7a', '7b', '8a', '8b', '9a', '9b', '10a', '10b', '11', '12', '13'];
  const COL = {
    A1: { PVC3: '3', PVC2: '4', XLPE3: '6b', XLPE2: '7b' },
    A2: { PVC3: '2', PVC2: '3', XLPE3: '5b', XLPE2: '6b' },
    B1: { PVC3: '5a', PVC2: '6a', XLPE3: '8b', XLPE2: '10b' },
    B2: { PVC3: '4', PVC2: '5a', XLPE3: '7b', XLPE2: '8b' },
    C: { PVC3: '6a', PVC2: '8a', XLPE3: '9b', XLPE2: '11' },
    E: { PVC3: '7a', PVC2: '9a', XLPE3: '10b', XLPE2: '12' },
    F: { PVC3: '8a', PVC2: '10a', XLPE3: '11', XLPE2: '13' },
  };
  const _ = null;
  const AIRE = {
    cu: {
      1.5: [11, 11.5, 12.5, 13.5, 14, 14.5, 15.5, 16, 16.5, 17, 17.5, 19, 20, 20, 20, 21, 23, _],
      2.5: [15, 15.5, 17, 18, 19, 20, 20, 21, 22, 23, 24, 26, 27, 26, 28, 30, 32, _],
      4: [20, 20, 22, 24, 25, 26, 28, 29, 30, 31, 32, 34, 36, 36, 38, 40, 44, _],
      6: [25, 26, 29, 31, 32, 34, 36, 37, 39, 40, 41, 44, 46, 46, 49, 52, 57, _],
      10: [33, 36, 40, 43, 45, 46, 49, 52, 54, 54, 57, 60, 63, 65, 68, 72, 78, _],
      16: [45, 48, 53, 59, 61, 63, 66, 69, 72, 73, 77, 81, 85, 87, 91, 97, 104, _],
      25: [59, 63, 69, 77, 80, 82, 86, 87, 91, 95, 100, 103, 108, 110, 115, 122, 135, 146],
      35: [_, _, _, 95, 100, 101, 106, 109, 114, 119, 124, 127, 133, 137, 143, 153, 168, 182],
      50: [_, _, _, 116, 121, 122, 128, 133, 139, 145, 151, 155, 162, 167, 174, 188, 204, 220],
      70: [_, _, _, 148, 155, 155, 162, 170, 178, 185, 193, 199, 208, 214, 223, 243, 262, 282],
      95: [_, _, _, 180, 188, 187, 196, 207, 216, 224, 234, 241, 252, 259, 271, 298, 320, 343],
      120: [_, _, _, 207, 217, 216, 226, 240, 251, 260, 272, 280, 293, 301, 314, 350, 373, 397],
      150: [_, _, _, _, _, 247, 259, 276, 289, 299, 313, 322, 337, 343, 359, 401, 430, 458],
      185: [_, _, _, _, _, 281, 294, 314, 329, 341, 356, 368, 385, 391, 409, 460, 493, 523],
      240: [_, _, _, _, _, 330, 345, 368, 385, 401, 419, 435, 455, 468, 489, 545, 583, 617],
    },
    al: {
      2.5: [11.5, 12, 13, 14, 15, 16, 16.5, 17, 17.5, 18, 19, 20, 20, 20, 21, 23, 25, _],
      4: [15, 16, 17, 19, 20, 21, 22, 22, 23, 24, 25, 26, 28, 27, 29, 31, 34, _],
      6: [20, 20, 22, 24, 25, 27, 29, 28, 30, 31, 32, 33, 35, 36, 38, 40, 44, _],
      10: [26, 27, 31, 33, 35, 38, 40, 40, 41, 42, 44, 46, 49, 50, 52, 56, 60, _],
      16: [35, 37, 41, 46, 48, 50, 52, 53, 55, 57, 60, 63, 66, 66, 70, 76, 82, _],
      25: [46, 49, 54, 60, 63, 63, 66, 67, 70, 72, 75, 78, 81, 84, 88, 91, 98, 110],
      35: [_, _, _, 74, 78, 78, 81, 83, 87, 89, 93, 97, 101, 104, 109, 114, 122, 136],
      50: [_, _, _, 90, 94, 95, 100, 101, 106, 108, 113, 118, 123, 127, 132, 140, 149, 167],
      70: [_, _, _, 115, 121, 121, 127, 130, 136, 139, 145, 151, 158, 162, 170, 180, 192, 215],
      95: [_, _, _, 140, 146, 147, 154, 159, 166, 169, 177, 183, 192, 197, 206, 219, 233, 262],
      120: [_, _, _, 161, 169, 171, 179, 184, 192, 196, 205, 213, 222, 228, 239, 254, 273, 306],
      150: [_, _, _, _, _, 196, 205, 213, 222, 227, 237, 246, 257, 264, 276, 294, 314, 353],
      185: [_, _, _, _, _, 222, 232, 243, 254, 259, 271, 281, 293, 301, 315, 337, 361, 406],
      240: [_, _, _, _, _, 261, 273, 287, 300, 306, 320, 332, 347, 355, 372, 399, 427, 482],
    },
  };
  // Fuente: UNE-HD 60364-5-52:2014 tabla C.52.2 bis (enterrados: 25 °C, 2,5 K·m/W, 0,70 m), mismo PDF tabla 7.12. Secciones 1,5…300
  const ENTERRADO = {
    cu: {
      PVC2: [20.5, 27.5, 36, 44, 59, 76, 98, 118, 140, 173, 205, 233, 264, 296, 342, 387],
      PVC3: [17, 22.5, 29, 37, 49, 63, 81, 97, 115, 143, 170, 192, 218, 245, 282, 319],
      XLPE2: [24.5, 32.5, 42, 53, 70, 91, 116, 140, 166, 204, 241, 275, 311, 348, 402, 455],
      XLPE3: [21, 27.5, 35, 44, 58, 75, 96, 117, 138, 170, 202, 230, 260, 291, 336, 380],
    },
    al: {
      XLPE2: [_, _, _, _, _, 70, 89, 107, 126, 156, 185, 211, 239, 267, 309, 349],
      XLPE3: [_, _, _, _, _, 58, 74, 90, 107, 132, 157, 178, 201, 226, 261, 295],
    },
  };

  function izBase({ metodo, aisl, cargados, mat, S }){
    const k = aisl + cargados;
    if (metodo === 'D') { const row = ENTERRADO[mat]?.[k], i = SECCIONES.indexOf(S); return row && i >= 0 ? row[i] ?? null : null; }
    const col = COL[metodo]?.[k], row = AIRE[mat]?.[S];
    return col && row ? row[COLS.indexOf(col)] ?? null : null;
  }

  // Busca el valor tabulado más desfavorable: la primera clave ≥ x (o la última si se permite)
  function arriba(keys, x, clampTop){
    const k = keys.find(v => v >= x - 1e-9);
    return k ?? (clampTop ? keys[keys.length - 1] : undefined);
  }

  // Fuente: tablas 7.22 (aire, UNE-HD 60364-5-52 B.52.14) y 7.26 (terreno, B.52.15) del mismo PDF
  const T_KEYS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
  const F_T_AIRE = { PVC: [1.40, 1.34, 1.29, 1.22, 1.15, 1.08, 1.00, 0.91, 0.82, 0.70, 0.57], XLPE: [1.26, 1.23, 1.19, 1.14, 1.10, 1.05, 1.00, 0.96, 0.90, 0.83, 0.78] };
  const F_T_TERRENO = { PVC: [1.16, 1.11, 1.06, 1, 0.94, 0.88, 0.81, 0.75, 0.66, 0.58, 0.47], XLPE: [1.11, 1.08, 1.05, 1, 0.97, 0.93, 0.86, 0.83, 0.79, 0.74, 0.68] };
  function fTemp({ aisl, T, enterrado }){
    if (!(T >= 10 && T <= 60)) throw new Error('Temperatura fuera de tabla (10–60 °C)');
    const Ttab = arriba(T_KEYS, T);
    return { f: (enterrado ? F_T_TERRENO : F_T_AIRE)[aisl][T_KEYS.indexOf(Ttab)], Ttab };
  }

  // Fuente: tabla 7.15 (UNE-HD 60364-5-52 tabla C.52.3)
  const N_KEYS = [1, 2, 3, 4, 6, 9, 12, 16, 20];
  const DISP = {
    1: ['Empotrados o embutidos', [1.0, 0.80, 0.70, 0.70, 0.55, 0.50, 0.45, 0.40, 0.40]],
    2: ['Capa única sobre muros, suelos o bandejas no perforadas', [1.00, 0.85, 0.80, 0.75, 0.70, 0.70, 0.70, 0.70, 0.70]],
    3: ['Capa única en el techo', [0.95, 0.80, 0.70, 0.70, 0.65, 0.60, 0.60, 0.60, 0.60]],
    4: ['Capa única sobre bandejas perforadas horizontales o verticales', [1.0, 0.90, 0.80, 0.75, 0.75, 0.70, 0.70, 0.70, 0.70]],
    5: ['Capa única sobre escaleras de cables, abrazaderas, etc.', [1.0, 0.85, 0.80, 0.80, 0.80, 0.80, 0.80, 0.80, 0.80]],
  };
  function fAgrup({ disp, n }){
    const ntab = arriba(N_KEYS, n, true);
    return { f: DISP[disp][1][N_KEYS.indexOf(ntab)], ntab };
  }

  // Fuente: tabla 7.16 (agrupación en capas)
  function fCapas(capas){ return capas <= 1 ? 1 : capas === 2 ? 0.8 : capas === 3 ? 0.73 : capas <= 5 ? 0.7 : capas <= 8 ? 0.68 : 0.66; }

  // Fuente: tabla 7.30 (UNE-HD 60364-5-52, resistividad térmica del terreno)
  const RHO_KEYS = [0.5, 0.7, 1, 1.5, 2, 2.5, 3];
  const F_RHO = { tubo: [1.28, 1.20, 1.18, 1.10, 1.05, 1, 0.96], directo: [1.88, 1.62, 1.5, 1.28, 1.12, 1, 0.90] };
  function fResist({ rho, directo }){
    if (!(rho > 0 && rho <= 3)) throw new Error('Resistividad térmica fuera de tabla (hasta 3 K·m/W)');
    const rhoTab = arriba(RHO_KEYS, rho);
    return { f: F_RHO[directo ? 'directo' : 'tubo'][RHO_KEYS.indexOf(rhoTab)], rhoTab };
  }

  return { SECCIONES, METODOS, DISP, izBase, fTemp, fAgrup, fCapas, fResist };
})();
if (typeof module !== 'undefined') module.exports = CALCSEA;
