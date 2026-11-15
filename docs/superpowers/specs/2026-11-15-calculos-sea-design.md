# Cálculos SEA · Diseño

Fecha: 2026-11-15 · Estado: pendiente de aprobación

## Qué y por qué
Un apartado nuevo del Planner SEA, **«Cálculos SEA»**, independiente de los proyectos: un asistente que guía paso a paso para hacer cálculos eléctricos de baja tensión. Requisito central del usuario: **el resultado tiene que ser veraz y conforme al reglamento** (REBT 2002 y sus ITC, normas UNE citadas por ellas). Tiene que ser **totalmente gratuito**.

## Objetivos
- Sección propia en el menú lateral (y en el menú móvil), visible para cualquier usuario con sesión.
- Asistente: elegir cálculo → preguntas paso a paso → resultado.
- Cada resultado muestra: fórmula, valores sustituidos, tabla/ITC aplicada con su referencia, resultado y veredicto **cumple / no cumple** con el motivo.
- Cálculos deterministas (fórmulas + tablas transcritas de la norma), con pruebas automáticas contra ejemplos resueltos.

## No objetivos
- Nada de IA ni servidores de pago. Todo se calcula en el navegador.
- No se guarda nada en Supabase (sin tablas nuevas ni cambios de RLS).
- Sin relación con proyectos ni notas: se elimina «Insertar en la nota».
- Alta tensión, alumbrado (luminotecnia) y fotovoltaica quedan fuera de este diseño.

## Anti-objetivos (sería un fracaso aunque funcione)
- Un resultado que «cumple» por un solo criterio y no cumple otro (p. ej. sección por caída de tensión que no soporta la intensidad). La sección siempre se elige por **todos** los criterios aplicables y se dice cuál manda.
- Valores de tabla escritos de memoria sin verificar contra la norma.
- Dar un resultado fuera del alcance de la tabla sin avisar (p. ej. método o sección no tabulados): en ese caso se muestra «fuera del alcance de la tabla» y no un número.

## Enfoques considerados
- **A. Asistente con cálculos programados (elegido).** Gratis, exacto, sin dependencias. Limitado a lo programado.
- B. A + chat con IA (Supabase Edge Function + API de pago). Descartado por el usuario: no es gratuito. Se puede añadir más tarde encima de A.
- C. IA que calcula sola. Descartado: no garantiza veracidad.

## Alcance por fases
**Fase 1**
1. Intensidad y potencia (mono/trifásica, cos φ).
2. Sección de un circuito/línea:
   - Intensidad admisible Iz: UNE-HD 60364-5-52:2014, tabla C.52.1 bis (método de instalación A1, A2, B1, B2, C, D1, D2, E, F; PVC/XLPE; 2 o 3 conductores cargados; Cu/Al).
   - Factores de corrección: temperatura ambiente (aire y terreno), agrupamiento, resistividad térmica del terreno (D).
   - Caída de tensión con límites: ITC-BT-19 (3 % alumbrado / 5 % resto en interiores), ITC-BT-15 (DI 1 % / 1,5 %), ITC-BT-14 (LGA 0,5 % / 1 %). Fórmula con conductividad a la temperatura de servicio (γ: Cu 56/48/44, Al 35/30/28).
   - Secciones mínimas: ITC-BT-25 (circuitos de vivienda C1…C12), ITC-BT-15 (DI ≥ 6 mm²), ITC-BT-14 (LGA ≥ 10 mm² Cu / 16 mm² Al), ITC-BT-19 (neutro y protección, tabla 2).
   - Resultado: la sección normalizada mínima que cumple todo, indicando qué criterio manda.
3. Protección contra sobrecargas: Ib ≤ In ≤ Iz e I2 ≤ 1,45·Iz (UNE-HD 60364-4-43), calibres normalizados de PIA; diferencial (sensibilidad según uso: 30 mA en viviendas, ITC-BT-25 / ITC-BT-24).

**Fase 2**
4. Previsión de cargas ITC-BT-10: vivienda (básica 5 750 W / elevada 9 200 W), edificio de viviendas (coeficientes de simultaneidad de la tabla 1), servicios generales, locales y garajes.
5. Cortocircuito al final de la línea (método simplificado de la Guía técnica del REBT, Anexo 3: Icc = 0,8·U / R) y comprobación del poder de corte y de la longitud máxima protegida.

**Fase 3**
6. Diámetro de tubos: ITC-BT-21 (tablas 2, 5, 7 y 9 según el tipo de instalación).
7. Puesta a tierra: ITC-BT-18 tabla 5 (resistencia de picas, placas y conductor enterrado según resistividad), tensión de contacto ≤ 24 V / 50 V con la sensibilidad del diferencial.
8. Compensación de reactiva: Qc = P·(tg φ1 − tg φ2) y capacidad por fase (estrella/triángulo).

## Cómo se construye (decisiones tomadas)
- `js/calc-core.js`: **solo** tablas y funciones puras (sin DOM). Cada función devuelve `{ valores, pasos[], referencias[], cumple, avisos[] }`. Se carga en el navegador como el resto de archivos y también con Node para las pruebas.
- `js/calc-view.js`: la vista del asistente (`calcHTML()` como sección de nivel superior, `go('calc')`), siguiendo el estilo de las vistas existentes (`nav(...)`, plantillas HTML, `ic()`, `toast()`).
- `tests/calc.test.js`: pruebas con `node --test` (sin dependencias nuevas). Cada tabla se comprueba en varias celdas contra la norma y cada cálculo contra al menos un ejemplo resuelto de la Guía técnica del REBT o de un libro de texto del ciclo.
- Se sustituye la calculadora antigua (`js/tools.js` líneas 103-155, entrada en `js/extras.js:42` y botón en `js/views.js:514`). Las constantes `GAMMA` y `SECTIONS` pasan a `calc-core.js`.
- Los datos que introduce el usuario se validan (números > 0, cos φ ∈ (0, 1], etc.) antes de calcular.
- Cada pantalla de resultado lleva un pie fijo: «Cálculo orientativo según REBT 2002 e ITC. La firma y responsabilidad del proyecto son del técnico competente.»
- Botón «Copiar resultado» (texto plano con datos, pasos y referencias) para pegarlo en una memoria.

## Lo que queda al constructor
- Transcribir las tablas desde la norma o desde una fuente fiable que las reproduzca (Guía técnica del REBT, catálogos técnicos de fabricantes de cable) y anotar la fuente en un comentario junto a cada tabla.
- Diseño visual exacto de los pasos del asistente, dentro del estilo actual de la web (app.css / glass.css, modo claro/oscuro).

## Entrega
Cada fase en su propio commit y probada (pruebas de Node + navegador con Playwright) antes de subirla. Se sube a GitHub (y por tanto a la web publicada) solo cuando el usuario lo pida.
