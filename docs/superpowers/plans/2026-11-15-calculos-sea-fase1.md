# Cálculos SEA · Fase 1 · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sección «Cálculos SEA» con un asistente paso a paso para intensidad/potencia, dimensionado completo de la sección de una línea y protección contra sobrecargas, conforme a REBT + UNE-HD 60364-5-52:2014.

**Architecture:** Toda la lógica en funciones puras dentro de un único objeto global `CALCSEA` (`js/calc-core.js`), que también exporta con `module.exports` para probarse en Node. La vista (`js/calc-view.js`) sigue el patrón de vistas de la web: funciones que devuelven HTML, `S.*` como estado, `go('calc')` para navegar, `render()` para repintar.

**Tech Stack:** JS plano en el navegador (sin build), Node ≥ 18 `node --test` para pruebas, Playwright (preinstalado) para la comprobación en navegador.

**Spec:** `docs/superpowers/specs/2026-11-15-calculos-sea-design.md`

## Global Constraints

- Gratis: sin IA, sin servicios de pago, sin tablas ni cambios en Supabase, sin dependencias nuevas.
- Sección independiente de proyectos y notas.
- Fuentes (anotar en un comentario junto a cada tabla):
  - Tablas: «Tablas_Anexo-UNE60364-5-52BT.pdf» del Drive del usuario (reproduce la UNE-HD 60364-5-52:2014, tablas C.52.1 bis, C.52.2 bis, C.52.3 y los factores de corrección).
  - Caída de tensión: Guía técnica del REBT, Anexo 2 (sep 03 R1), tablas 1, 3 y 6.
- Si una combinación no está en la tabla, se devuelve «fuera del alcance de la tabla», nunca un número inventado.
- Si la temperatura o el número de circuitos no está tabulado, se toma el **siguiente valor tabulado más desfavorable** y se dice en los pasos.
- Pie fijo en cada resultado: «Cálculo orientativo según REBT 2002 e ITC. La firma y responsabilidad del proyecto son del técnico competente.»
- Textos de la interfaz en español; números con coma decimal (`toLocaleString('es-ES')`); los campos aceptan coma o punto.
- No hacer `git push` hasta que el usuario lo pida.

## Review Focus

1. Decimales con coma («2,5») en cualquier campo → se leen como 2.5. *(prueba en Task 4, `parseNum`)*
2. Temperatura no tabulada (33 °C) o fuera de rango (> 60 °C o < 10 °C) → 35 °C con aviso; fuera de rango = error claro, sin resultado. *(Task 1)*
3. Intensidad mayor de lo que admite la mayor sección del método elegido → «fuera del alcance de la tabla», no la última sección. *(Task 3)*
4. Ningún calibre de PIA cabe entre Ib e Iz → se sube la sección hasta que quepa y se dice que manda la protección. *(Task 3)*
5. cos φ = 1 con sección > 120 mm² → la reactancia no añade caída (sen φ = 0), sin NaN. *(Task 2)*

---

### Task 1: Tablas de intensidad admisible y factores de corrección

**Files:**
- Create: `js/calc-core.js`
- Test: `tests/calc.test.js`

**Interfaces:**
- Produces:
  - `CALCSEA.SECCIONES` → `[1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300]`
  - `CALCSEA.METODOS` → `{ A1:{label, desc}, A2, B1, B2, C, D, E, F }`. `desc` es texto corto sacado de las tablas 7.8/7.9 del PDF; D = enterrado (D1 en conducto / D2 directamente).
  - `CALCSEA.izBase({ metodo, aisl:'PVC'|'XLPE', cargados:2|3, mat:'cu'|'al', S }) → number|null`
  - `CALCSEA.fTemp({ aisl, T, enterrado:boolean }) → { f:number, Ttab:number }`. Lanza `Error('Temperatura fuera de tabla (10–60 °C)')` si T < 10 o T > 60.
  - `CALCSEA.fAgrup({ disp:1..5, n:int≥1 }) → { f, ntab }` (tabla C.52.3, filas 1–5)
  - `CALCSEA.fCapas(capas:int≥1) → number` (1 → 1)
  - `CALCSEA.fResist({ rho, directo:boolean }) → { f, rhoTab }` (en tubo enterrado / directamente enterrado)
  - `module.exports = CALCSEA` cuando existe `module`.

**Datos exactos (copiar tal cual):**

Tabla C.52.1 bis, al aire a 40 °C. Columnas en este orden: `['2','3','4','5a','5b','6a','6b','7a','7b','8a','8b','9a','9b','10a','10b','11','12','13']`. `null` = «–».

Columna según método/aislamiento/conductores cargados:

| Método | PVC3 | PVC2 | XLPE3 | XLPE2 |
|---|---|---|---|---|
| A1 | 3 | 4 | 6b | 7b |
| A2 | 2 | 3 | 5b | 6b |
| B1 | 5a | 6a | 8b | 10b |
| B2 | 4 | 5a | 7b | 8b |
| C | 6a | 8a | 9b | 11 |
| E | 7a | 9a | 10b | 12 |
| F | 8a | 10a | 11 | 13 |

```
Cobre
1.5: 11,11.5,12.5,13.5,14,14.5,15.5,16,16.5,17,17.5,19,20,20,20,21,23,null
2.5: 15,15.5,17,18,19,20,20,21,22,23,24,26,27,26,28,30,32,null
4:   20,20,22,24,25,26,28,29,30,31,32,34,36,36,38,40,44,null
6:   25,26,29,31,32,34,36,37,39,40,41,44,46,46,49,52,57,null
10:  33,36,40,43,45,46,49,52,54,54,57,60,63,65,68,72,78,null
16:  45,48,53,59,61,63,66,69,72,73,77,81,85,87,91,97,104,null
25:  59,63,69,77,80,82,86,87,91,95,100,103,108,110,115,122,135,146
35:  null,null,null,95,100,101,106,109,114,119,124,127,133,137,143,153,168,182
50:  null,null,null,116,121,122,128,133,139,145,151,155,162,167,174,188,204,220
70:  null,null,null,148,155,155,162,170,178,185,193,199,208,214,223,243,262,282
95:  null,null,null,180,188,187,196,207,216,224,234,241,252,259,271,298,320,343
120: null,null,null,207,217,216,226,240,251,260,272,280,293,301,314,350,373,397
150: null,null,null,null,null,247,259,276,289,299,313,322,337,343,359,401,430,458
185: null,null,null,null,null,281,294,314,329,341,356,368,385,391,409,460,493,523
240: null,null,null,null,null,330,345,368,385,401,419,435,455,468,489,545,583,617
Aluminio
2.5: 11.5,12,13,14,15,16,16.5,17,17.5,18,19,20,20,20,21,23,25,null
4:   15,16,17,19,20,21,22,22,23,24,25,26,28,27,29,31,34,null
6:   20,20,22,24,25,27,29,28,30,31,32,33,35,36,38,40,44,null
10:  26,27,31,33,35,38,40,40,41,42,44,46,49,50,52,56,60,null
16:  35,37,41,46,48,50,52,53,55,57,60,63,66,66,70,76,82,null
25:  46,49,54,60,63,63,66,67,70,72,75,78,81,84,88,91,98,110
35:  null,null,null,74,78,78,81,83,87,89,93,97,101,104,109,114,122,136
50:  null,null,null,90,94,95,100,101,106,108,113,118,123,127,132,140,149,167
70:  null,null,null,115,121,121,127,130,136,139,145,151,158,162,170,180,192,215
95:  null,null,null,140,146,147,154,159,166,169,177,183,192,197,206,219,233,262
120: null,null,null,161,169,171,179,184,192,196,205,213,222,228,239,254,273,306
150: null,null,null,null,null,196,205,213,222,227,237,246,257,264,276,294,314,353
185: null,null,null,null,null,222,232,243,254,259,271,281,293,301,315,337,361,406
240: null,null,null,null,null,261,273,287,300,306,320,332,347,355,372,399,427,482
```

Tabla C.52.2 bis, enterrados (método D), 25 °C, 2,5 K·m/W, 0,70 m. Secciones 1.5…300:
```
cu PVC2:  20.5,27.5,36,44,59,76,98,118,140,173,205,233,264,296,342,387
cu PVC3:  17,22.5,29,37,49,63,81,97,115,143,170,192,218,245,282,319
cu XLPE2: 24.5,32.5,42,53,70,91,116,140,166,204,241,275,311,348,402,455
cu XLPE3: 21,27.5,35,44,58,75,96,117,138,170,202,230,260,291,336,380
al XLPE2: null×5,70,89,107,126,156,185,211,239,267,309,349
al XLPE3: null×5,58,74,90,107,132,157,178,201,226,261,295
al PVC2/PVC3: no tabulado → null
```

Temperatura ambiente, aire (T: 10,15,…,60):
`PVC: 1.40,1.34,1.29,1.22,1.15,1.08,1.00,0.91,0.82,0.70,0.57` · `XLPE: 1.26,1.23,1.19,1.14,1.10,1.05,1.00,0.96,0.90,0.83,0.78`

Temperatura del terreno (T: 10,15,…,60):
`PVC (70 °C): 1.16,1.11,1.06,1,0.94,0.88,0.81,0.75,0.66,0.58,0.47` · `XLPE (90 °C): 1.11,1.08,1.05,1,0.97,0.93,0.86,0.83,0.79,0.74,0.68`

Agrupamiento C.52.3 (n: 1,2,3,4,6,9,12,16,20):
```
1 Empotrados o embutidos:                   1.0,0.80,0.70,0.70,0.55,0.50,0.45,0.40,0.40
2 Capa única sobre muros/suelos/bandeja no perforada: 1.00,0.85,0.80,0.75,0.70,0.70,0.70,0.70,0.70
3 Capa única en el techo:                   0.95,0.80,0.70,0.70,0.65,0.60,0.60,0.60,0.60
4 Capa única sobre bandejas perforadas:     1.0,0.90,0.80,0.75,0.75,0.70,0.70,0.70,0.70
5 Capa única sobre escaleras, abrazaderas:  1.0,0.85,0.80,0.80,0.80,0.80,0.80,0.80,0.80
```
Capas: `2→0.8, 3→0.73, 4–5→0.7, 6–8→0.68, ≥9→0.66`.
Resistividad del terreno (ρ: 0.5,0.7,1,1.5,2,2.5,3): `en tubo: 1.28,1.20,1.18,1.10,1.05,1,0.96` · `directo: 1.88,1.62,1.5,1.28,1.12,1,0.90`.

Regla «más desfavorable»: temperatura → siguiente T tabulada ≥ T; n → siguiente n tabulado ≥ n (n > 20 → 20); ρ → siguiente ρ tabulada ≥ ρ (ρ > 3 → error «fuera de tabla»).

- [ ] **Step 1: Write the failing tests** in `tests/calc.test.js` (`const C = require('../js/calc-core.js')`, `node:test`, `node:assert/strict`):
  - `izBase cobre al aire`: `{B1,PVC,2,cu,2.5}→20`, `{C,XLPE,2,cu,6}→52`, `{B1,XLPE,3,cu,10}→57`, `{F,XLPE,2,cu,240}→617`, `{A1,PVC,3,cu,1.5}→11.5`
  - `izBase aluminio`: `{E,XLPE,3,al,95}→206`, `{B2,PVC,2,al,16}→46`
  - `izBase enterrado`: `{D,XLPE,3,cu,95}→202`, `{D,PVC,2,cu,1.5}→20.5`, `{D,XLPE,2,al,16}→70`
  - `izBase fuera de tabla`: `{A1,PVC,3,cu,35}→null`, `{F,XLPE,2,cu,16}→null`, `{D,PVC,2,al,25}→null`, `{B1,PVC,2,cu,300}→null`
  - `fTemp`: `{XLPE,33,false}→{f:1.05,Ttab:35}`, `{PVC,25,false}→{f:1.22,Ttab:25}`, `{PVC,25,true}→{f:1,Ttab:25}`, `{XLPE,41,true}→{f:0.83,Ttab:45}`; `T=65` y `T=5` lanzan.
  - `fAgrup`: `{1,3}→{f:0.70,ntab:3}`, `{4,5}→{f:0.75,ntab:6}`, `{2,25}→{f:0.70,ntab:20}`
  - `fCapas`: `1→1, 3→0.73, 7→0.68, 12→0.66`
  - `fResist`: `{1.8,false}→{f:1.05,rhoTab:2}`, `{1,true}→{f:1.5,rhoTab:1}`; `{3.5,…}` lanza.
- [ ] **Step 2: Run** `node --test tests/` → FAIL (`Cannot find module '../js/calc-core.js'`).
- [ ] **Step 3: Implement** the Produces list in `js/calc-core.js` with the data above (`'use strict'`, todo dentro de `const CALCSEA = (() => { … })()`).
- [ ] **Step 4: Run** `node --test tests/` → PASS.
- [ ] **Step 5: Commit** `git add js/calc-core.js tests/calc.test.js && git commit -m "Cálculos SEA: tablas UNE-HD 60364-5-52 y factores de corrección"`

### Task 2: Intensidad, potencia, caída de tensión, límites y secciones mínimas

**Files:**
- Modify: `js/calc-core.js`
- Test: `tests/calc.test.js`

**Interfaces:**
- Consumes: `CALCSEA.SECCIONES`.
- Produces:
  - `CALCSEA.intensidad({ sistema:'mono'|'tri', P, U, cos }) → number` (I = P/(U·cos) o P/(√3·U·cos))
  - `CALCSEA.potencia({ sistema, I, U, cos }) → number`
  - `CALCSEA.GAMMA` → `{ cu:{70:48, 90:44}, al:{70:30, 90:28} }` (PVC → 70 °C, XLPE → 90 °C; Guía Anexo 2, tabla 3)
  - `CALCSEA.caida({ sistema, L, I, cos, S, mat, aisl, U }) → { dU, pct }`: R = L/(γ·S); X = 0 si S ≤ 120; X = 0.15R (150), 0.20R (185), 0.25R (240) (Guía Anexo 2 tabla 1; S = 300 → X = 0.25R con aviso); ΔU = k·I·(R·cos φ + X·sen φ), k = 2 en mono y √3 en tri.
  - `CALCSEA.seccionPorCaida({ sistema, L, I, cos, mat, aisl, U, pctMax }) → { Smin:number, S:number|null }` (para S ≤ 120 despeja directamente; si sale > 120, prueba 150/185/240 con su reactancia; `S:null` si ni 240 cumple)
  - `CALCSEA.LINEAS` → lista `{ id, label, pct, ref, Smin:{cu, al} }`:
    - `lga_conc` LGA, contadores totalmente concentrados · 0.5 · ITC-BT-14 · cu 10 / al 16
    - `lga_parc` LGA, centralizaciones parciales · 1 · ITC-BT-14 · cu 10 / al 16
    - `di_unico` DI, suministro de un único usuario · 1.5 · ITC-BT-15 · cu 6 / al 6
    - `di_conc` DI, contadores totalmente concentrados · 1 · ITC-BT-15 · cu 6 / al 6
    - `di_parc` DI, centralizaciones parciales · 0.5 · ITC-BT-15 · cu 6 / al 6
    - `viv` Circuito interior de vivienda · 3 · ITC-BT-19 / ITC-BT-25 · (Smin según circuito C1…C12)
    - `alum` Alumbrado (no vivienda) · 3 · ITC-BT-19 · cu 1.5 / al 16
    - `fuerza` Fuerza / otros usos (no vivienda) · 5 · ITC-BT-19 · cu 1.5 / al 16
  - `CALCSEA.CIRC_VIV` (ITC-BT-25 tabla 1): `C1 Iluminación 1.5/10 A`, `C2 Tomas de uso general 2.5/16`, `C3 Cocina y horno 6/25`, `C4 Lavadora, lavavajillas y termo 4/20`, `C5 Baño y cuarto de cocina 2.5/16`, `C6 Adicional de C1 1.5/10`, `C7 Adicional de C2 2.5/16`, `C8 Calefacción 6/25`, `C9 Aire acondicionado 6/25`, `C10 Secadora 2.5/16`, `C11 Automatización 1.5/10`, `C12 Adicional de C3, C4 o C5` (sección y PIA del circuito que duplica). **Antes de escribirlo, comprobarlo contra la ITC-BT-25 tabla 1 del PDF «REBT_plcmadrid.pdf» del Drive del usuario** (id `1wXGt1_DB27MLa-AWd0pKUnQ4RgPQxITR`) y anotar la página.
  - `CALCSEA.seccionProteccion(S) → number` (ITC-BT-19 tabla 2: S ≤ 16 → S; 16 < S ≤ 35 → 16; S > 35 → S/2 redondeado a la sección normalizada superior)

- [ ] **Step 1: Write the failing tests** (ejemplos resueltos de la Guía Anexo 2, cobre PVC → γ = 48, cos φ = 1, 230 V mono):
  - `intensidad`: `{mono,5750,230,1}→25`; `{tri,145000,400,0.9}≈232.5` (±0.1)
  - `potencia`: `{mono,16,230,1}→3680`
  - `seccionPorCaida` Ej. 2: `I=25, L=10, pct=1` → `Smin≈4.52 (±0.01), S=6`
  - Ej. 3 DI: `I=25, L=22, pct=1` → `Smin≈9.96, S=10`
  - Ej. 3 C2: `I=16, L=30, pct=3` → `Smin≈2.90, S=4`
  - Ej. 4: `I=25, L=35, pct=1` → `Smin≈15.85, S=16`
  - Ej. 5: `I=40` y `L = 10 / 22 / 35` → `S = 10 / 16 / 35`
  - `caida`: `{mono,L:30,I:16,cos:1,S:4,cu,PVC,230}` → `pct≈2.17` (±0.01)
  - `caida con reactancia`: `{tri,L:100,I:300,cos:0.8,S:185,cu,XLPE,400}` → R = 100/(44·185), X = 0.20R, `dU = √3·300·(R·0.8 + X·0.6)` (calcular el valor esperado en el propio test con esa expresión)
  - Review Focus 5: `caida({…S:240, cos:1})` = mismo resultado que con X = 0 y sin NaN
  - `seccionProteccion`: `10→10, 25→16, 35→16, 50→25, 95→50, 120→70` (60 → 70, la normalizada superior)
- [ ] **Step 2: Run** `node --test tests/` → los nuevos FAIL.
- [ ] **Step 3: Implement** the Produces list.
- [ ] **Step 4: Run** `node --test tests/` → PASS.
- [ ] **Step 5: Commit** `git commit -am "Cálculos SEA: intensidad, caída de tensión y límites reglamentarios"` (añadir antes los archivos nuevos si los hay).

### Task 3: Protección y dimensionado completo de la sección

**Files:**
- Modify: `js/calc-core.js`
- Test: `tests/calc.test.js`

**Interfaces:**
- Consumes: todo lo de Tasks 1–2.
- Produces:
  - `CALCSEA.CALIBRES_PIA` → `[6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125]`
  - `CALCSEA.CALIBRES_GG` → `[2, 4, 6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630]`
  - `CALCSEA.proteccion({ Ib, Iz, tipo:'pia'|'gG' }) → { In:number|null, I2:number|null, cumple:boolean, pasos:string[] }`. Condiciones UNE-HD 60364-4-43: Ib ≤ In ≤ Iz e I2 ≤ 1,45·Iz, con I2 = 1,45·In (PIA, UNE-EN 60898) e I2 = 1,6·In (fusible gG, In ≥ 16 A; 1,9·In para 4 < In < 16; 2,1·In para In ≤ 4). Elige el menor calibre que cumple.
  - `CALCSEA.dimensionar(d) → Resultado`, con `d = { linea:id, circuito?:'C1'..'C12', sistema, U, cos, P?|I?, L, mat, aisl, metodo, T, disp, n, capas, rho?, directo?, prot:'pia'|'gG' }`. Si `linea === 'viv'`, Ib = In del PIA del circuito (ITC-BT-25) y cos φ = 1 (Guía Anexo 2, Ej. 3).
  - `Resultado = { ok:boolean, S, manda:'intensidad'|'caida'|'minima'|'proteccion', Ib, Iz, f:{temp, agrup, capas, resist}, dU, pct, pctMax, In, Sp, pasos:[{t:string, f?:string}], refs:string[], avisos:string[], error?:string }`
  - Algoritmo de `dimensionar` (cargados = 2 si mono, 3 si tri):
    1. Ib.
    2. Factor total = fTemp · fAgrup · fCapas · (si D) fResist.
    3. Recorre `SECCIONES` desde max(Smin de la línea/circuito) y se queda con la primera S en la que **todo** cumple: `izBase·factor ≥ Ib` **y** `pct ≤ pctMax` **y** existe In con `proteccion` cumpliendo.
    4. `manda` = el criterio que obligó a subir de la sección anterior: si no se subió nunca → `'minima'`; si no, el primero de [intensidad, caída, protección] que falló en la sección anterior.
    5. Si `izBase` da null antes de encontrar una S válida → `ok:false, error:'Fuera del alcance de la tabla para este método de instalación'`.
    6. `Sp = seccionProteccion(S)`.
    7. `refs` incluye siempre «UNE-HD 60364-5-52:2014 tabla C.52.1 bis» (o C.52.2 bis), la ITC de la línea, «Guía técnica REBT Anexo 2» y «UNE-HD 60364-4-43».

- [ ] **Step 1: Write the failing tests:**
  - `proteccion PIA`: `{Ib:50.94, Iz:57, pia}` → `In:null, cumple:false`; `{Ib:50.94, Iz:77, pia}` → `In:63, cumple:true`; `{Ib:16, Iz:20, pia}` → `In:16`
  - `proteccion gG`: `{Ib:30, Iz:40, gG}` → `In:32`, `I2 = 51.2 ≤ 58` → cumple
  - `dimensionar motor` (Review Focus 4): `{linea:'fuerza', sistema:'tri', U:400, cos:0.85, P:30000, L:50, mat:'cu', aisl:'XLPE', metodo:'B1', T:40, disp:1, n:1, capas:1, prot:'pia'}` → `Ib≈50.94`, con 10 mm² Iz = 57 sin PIA posible → `S:16, Iz:77, In:63, manda:'proteccion', ok:true`
  - `dimensionar C2 vivienda` (Guía Ej. 3): `{linea:'viv', circuito:'C2', sistema:'mono', U:230, L:30, mat:'cu', aisl:'PVC', metodo:'B1', T:40, disp:1, n:1, capas:1, prot:'pia'}` → `Ib:16, S:4, manda:'caida', In:16`
  - `dimensionar con factores`: el caso del motor con `T:50, disp:1, n:3` → factor 0.90·0.70 = 0.63; sección que dé el código, comprobada a mano en el test: `izBase(S)·0.63 ≥ Ib` y `izBase(S anterior)·0.63 < Ib` o la protección/caída falla en la anterior.
  - `dimensionar fuera de tabla` (Review Focus 3): `{linea:'fuerza', sistema:'tri', I:700, metodo:'B1', aisl:'PVC', mat:'cu', …}` → `ok:false`, `error` contiene «Fuera del alcance»
  - `dimensionar mínima`: `{linea:'di_unico', sistema:'mono', U:230, cos:1, I:10, L:2, mat:'cu', aisl:'PVC', metodo:'B1', …}` → `S:6, manda:'minima'`
- [ ] **Step 2: Run** `node --test tests/` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `node --test tests/` → PASS.
- [ ] **Step 5: Commit** `git commit -am "Cálculos SEA: protección y dimensionado completo de la sección"`

### Task 4: Vista del asistente y enlace en el menú; quitar la calculadora antigua

**Files:**
- Create: `js/calc-view.js`
- Modify: `index.html` (añadir `<script src="js/calc-core.js">` y `<script src="js/calc-view.js">` justo antes de `js/main.js`)
- Modify: `js/layout.js:87-95` (añadir `nav('calc','calculator','Cálculos SEA')` tras «Horario») y `js/layout.js:109-119` (`if (S.view === 'calc') return calcSeaHTML();`); en el menú móvil «más», la misma entrada.
- Modify: `js/tools.js:103-155` (borrar `GAMMA`, `SECTIONS`, `nf` solo si nadie más lo usa —comprobar con grep—, `CALC`, `CALC_TABS`, `openCalc`, `calcHTML`, `calcUpdate`, `insertCalc`), `js/extras.js:42` (la entrada pasa a `() => go('calc')` con descripción «Asistente de cálculos eléctricos según REBT»), `js/views.js:514` (quitar el botón «Calculadoras» de Notas). Hacer `grep -n "openCalc\|calcHTML\|'calc'" js/*.js` y quitar también el caso `'calc'` del renderizado de modales.
- Modify: `app.css` (estilos mínimos del asistente reutilizando clases existentes: `card-box`, `btn`, `seg`, `grid4`, `calc-res`, `tabs`)
- Test: `tests/calc.test.js` (solo `parseNum`)

**Interfaces:**
- Consumes: `CALCSEA.*`, y de la web: `S`, `render()`, `go()`, `ic()`, `icons()`, `esc()`, `toast()`, `track()`.
- Produces:
  - `CALCSEA.parseNum(str) → number` (acepta «2,5», «2.5», « 1.000,5 » → 1000.5; vacío → NaN). Va en `calc-core.js` para poder probarlo.
  - `calcSeaHTML() → string`; estado en `S.cs = { calc:'seccion'|'intensidad'|'proteccion', paso:int, d:{…} }`.

Comportamiento:
- Pantalla inicial: tres tarjetas — «Intensidad y potencia», «Sección de una línea», «Protección (PIA / fusible)».
- «Sección de una línea» en 5 pasos con barra de progreso y botones Atrás / Siguiente: 1) Tipo de línea (`LINEAS`; si `viv`, elegir circuito C1…C12); 2) Carga (mono/tri, U, P o I, cos φ — ocultos si `viv`); 3) Cable (material, aislamiento PVC/XLPE, método con su descripción de `METODOS`); 4) Condiciones (temperatura; si no es D: disposición + nº de circuitos + capas; si es D: temperatura del terreno, resistividad, en tubo/directo); 5) Longitud y protección (PIA/gG). «Calcular» muestra el resultado.
- Resultado: tarjeta grande con S (fase), Sp (protección), In, ΔU %, «Manda: …» y ✅/❌; debajo la lista `pasos` (fórmula + valores), `refs`, `avisos` y el pie fijo. Botones «Copiar resultado» (texto plano con datos, pasos y referencias vía `navigator.clipboard.writeText`, `toast('Resultado copiado')`) y «Nuevo cálculo».
- Validación al pulsar Siguiente: números > 0; cos φ en (0, 1]; error en rojo bajo el campo, sin avanzar.
- `track('f:calcsea')` al entrar.

- [ ] **Step 1: Write the failing test** `parseNum`: `'2,5'→2.5`, `'2.5'→2.5`, `' 1.000,5 '→1000.5`, `''→NaN`, `'abc'→NaN`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `parseNum` → **Run** → PASS.
- [ ] **Step 4: Implement** the view and the wiring above.
- [ ] **Step 5: Comprobar en navegador.** La web pide login con Google, así que la comprobación es un HTML de prueba en el scratchpad que carga `app.css`, `glass.css`, lucide, `js/core.js` con `supabase` simulado (`window.supabase = { createClient: () => ({ auth:{ onAuthStateChange(){} }, from(){…} }) }`), `calc-core.js` y `calc-view.js`, y pinta `calcSeaHTML()` en `#app`. Con Playwright: recorrer los 5 pasos con el caso del motor de Task 3 y comprobar que el resultado muestra «16 mm²» y «63 A»; captura en claro y oscuro y a 390 px de ancho; ningún error en consola.
- [ ] **Step 6: Run** `node --test tests/` → PASS y `grep -n "openCalc\|insertCalc" js/*.js` → sin resultados.
- [ ] **Step 7: Commit** `git add -A && git commit -m "Cálculos SEA: asistente en su propia sección y retirada de la calculadora antigua"`

---

## Fuera de esta fase
Fase 2 (previsión de cargas ITC-BT-10, cortocircuito) y fase 3 (tubos ITC-BT-21, puesta a tierra ITC-BT-18, reactiva) tendrán su propio plan. El rediseño de toda la interfaz es un proyecto aparte, después.
