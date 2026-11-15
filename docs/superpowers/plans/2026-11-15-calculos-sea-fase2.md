# Cálculos SEA · Fase 2 · Plan de implementación

**Goal:** Añadir previsión de cargas (ITC-BT-10) y cortocircuito (corriente de cortocircuito, poder de corte y comprobación térmica) al asistente, y corregir la intensidad de cálculo de motores y lámparas de descarga en «Sección de una línea».

**Spec:** `docs/superpowers/specs/2026-11-15-calculos-sea-design.md` (fase 2). Mismas restricciones globales que la fase 1: gratis, sin Supabase, tablas de fuentes comprobadas y anotadas, pie fijo, «fuera de tabla» antes que inventar.

**Fuentes (Drive del usuario):**
- «3UT_CIE_Diseño instalaciones BT SIN SOL.pdf»: ITC-BT-10 (grados de electrificación 5 750 / 9 200 W, tabla 1 de simultaneidad, servicios generales con CS = 1, locales y oficinas 100 W/m² mín. 3 450 W, industrias 125 W/m² mín. 10 350 W, garajes 10 / 20 W/m² mín. 3 450 W) y ejercicios 3.1 (70,544 kW), 3.2 (58,45 kW) y 3.3 (177,56 kW).
- «CALCULO SECCIONES1.pdf»: Pcc = √3·U·Icc; Icc = k·S/√t con k = 115 (Cu PVC) y 143 (Cu XLPE); ITC-BT-47 motores ×1,25 (solo el mayor, si hay varios); lámparas de descarga ×1,8.

## Task 1 · Previsión de cargas (calc-core.js)
- `CALCSEA.CS_VIV(n)`: tabla 1; n > 21 → 15,3 + (n − 21)·0,5.
- `CALCSEA.previsionEdificio({ basicas, elevadas, nocturna, sg:[{label, P}], locales:[{m2, P?}], oficinas:[…], industrias:[{m2, P?}], garajes:[{m2, forzada}] })` → `{ Pviv, CS, Psg, Plocales, Pindustrias, Pgarajes, total, pasos, refs }`. Cada local: max(P declarada, W/m²·m², mínimo).
- Pruebas: CS(4)=3,8, CS(14)=11,3, CS(24)=16,8; ejercicios 3.1, 3.2 y 3.3 con su total exacto.

## Task 2 · Cortocircuito (calc-core.js)
- `CALCSEA.iccDesdePcc({ Pcc_MVA, U })` → Icc (kA) = Pcc/(√3·U).
- `CALCSEA.K_CC = { cu:{PVC:115, XLPE:143}, al:{PVC:76, XLPE:94} }` (UNE-HD 60364-4-43, tabla 43A; los de Cu comprobados en el PDF).
- `CALCSEA.cortocircuito({ Icc_kA, S, mat, aisl, t, pdc_kA })` → `{ Smin = Icc·√t/k, cumpleTermico, tmax = (k·S/Icc)², cumplePdc, pasos, refs }`.
- Pruebas: Pcc 500 MVA a 400 V → 721,7 kA; Icc 6 kA, Cu PVC, t 0,1 s → Smin = 16,5 mm² (16 no cumple, 25 sí); PdC 4,5 kA < 6 kA → no cumple.

## Task 3 · Motores y lámparas de descarga en «Sección de una línea»
- `dimensionar(d)` acepta `d.receptor: 'general'|'motor'|'descarga'` → Ib·1,25 / Ib·1,8, con un paso que lo cita (ITC-BT-47 / ITC-BT-44). Si no es vivienda, por defecto 'general'.
- Prueba: el motor de 30 kW de la fase 1 con `receptor:'motor'` → Ib = 63,68 A; B1 XLPE3: 16 mm² (Iz 77) admite PIA 80? no (80 > 77) → sube a 25 mm² (Iz 100, PIA 80) → `S:25, In:80, manda:'proteccion'`.

## Task 4 · Vista
- Dos tarjetas nuevas: «Previsión de cargas» (formulario por bloques: viviendas, servicios generales, locales/oficinas, industrias, garajes, con filas que se añaden) y «Cortocircuito» (Pcc o Icc conocida, sección, material, aislamiento, tiempo, poder de corte).
- En el paso 2 de «Sección», selector «Tipo de receptor» (General / Motor / Lámparas de descarga).
- Comprobación con Playwright (escritorio oscuro y móvil claro, sin errores de consola), luego `node --test tests/*.test.js`.

## Pendiente (requiere fuente)
Icc al final de una línea con el método de la Guía técnica (Anexo 3, Icc = 0,8·U/R): falta el PDF del Anexo 3; f2i2.net no es accesible desde esta sesión.
