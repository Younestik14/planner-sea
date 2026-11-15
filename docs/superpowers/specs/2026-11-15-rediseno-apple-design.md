# Rediseño del Planner SEA · estilo Apple · Diseño

Fecha: 2026-11-15 · Estado: aprobado por el usuario (2026-11-15)

## Qué y por qué
Cambiar el aspecto de toda la web para que parezca **profesional, premium y al estilo de Apple** (apps de macOS/iOS: Notas, Recordatorios, Ajustes, Calendario), con animaciones cuidadas. Opción **B** elegida por el usuario: nuevo sistema visual **y** reorganización de las pantallas principales.

## Estado actual (visto con datos de prueba)
- Tema oscuro «neón y cristal»: fondo aurora con cuadrícula, brillos morados, bordes y sombras en cada caja. Pedir modo claro no lo aclara.
- Menú lateral de solo iconos (no se sabe qué es cada uno sin pasar el ratón).
- Muchas «pastillas» de colores compitiendo (vencida, en riesgo, entrega…).
- El tablero se corta por la derecha en 1 280 px.

## Objetivos
1. **Lenguaje visual Apple**
   - Tipografía del sistema: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui` (en Mac/iPhone se ve SF Pro; en Windows/Android, Inter). Títulos grandes (34 px, peso 700, tracking −0,02 em), texto 15 px.
   - Colores del sistema: fondo `#F5F5F7` / tarjetas `#FFFFFF` en claro; `#000` / `#1C1C1E` / `#2C2C2E` en oscuro. Acento azul `#007AFF` (oscuro `#0A84FF`); verde, naranja y rojo del sistema para estados.
   - Superficies «materiales»: barra superior, menú lateral y barra inferior móvil translúcidas con `backdrop-filter: saturate(180%) blur(20px)`.
   - Sin aurora, sin cuadrícula, sin brillos. Separadores finos de 0,5–1 px, sombras muy suaves solo en elementos flotantes (menús, ventanas).
   - Radios: 10 px controles, 14 px tarjetas, 20 px ventanas. Controles segmentados estilo iOS, interruptores tipo «switch», listas agrupadas tipo Ajustes.
   - **Tema claro por defecto** que sigue al sistema, y oscuro bien hecho; se mantiene el selector de tema y el de color de acento existentes.
2. **Animaciones** (todas respetan `prefers-reduced-motion`)
   - Curvas tipo muelle (`cubic-bezier(.32,.72,0,1)`), 200–450 ms.
   - Cambio de pantalla: fundido + desplazamiento corto. Ventanas modales y hojas: suben desde abajo en móvil y escalan desde 96 % en escritorio, con fondo que se oscurece y desenfoca.
   - Listas y tarjetas: entrada escalonada (30 ms entre elementos). Botones: leve encogimiento al pulsar (`scale(.97)`). Casillas de tarea: check animado.
   - Barra de progreso y contadores: transición suave al cambiar.
3. **Reorganización (opción B)**
   - **Menú lateral** estilo macOS: ancho 240 px, con nombres, grupos con cabecera pequeña (Inicio, Clase, Proyectos, Herramientas, Administración), proyectos con su emoji y punto de color, plegable a iconos. En móvil se convierte en hoja lateral.
   - **Barra superior** más limpia: título de la sección actual, buscador tipo Spotlight (abre con `/` o ⌘K) y avatar; «Miembros» y notificaciones como iconos.
   - **Inicio** tipo «widgets»: saludo con título grande, rejilla de tarjetas (Hoy, Mis tareas, Próximas entregas, Últimos diarios, Accesos directos) con jerarquía clara.
   - **Cabecera de proyecto**: título grande con emoji, progreso como barra fina, una sola línea de estado (sin pastillas de colores sueltas) y pestañas como **control segmentado** con «Más» en un menú.
   - **Tablero**: columnas que caben en pantalla (desplazamiento horizontal suave si no caben), tarjetas blancas sin borde con sombra mínima, avatares y fechas discretas.
   - **Móvil**: barra de pestañas inferior estilo iOS (5 iconos con nombre, translúcida), títulos grandes que se reducen al hacer scroll.
   - **Cálculos SEA**: hereda el sistema (tarjetas tipo Ajustes, pasos con control segmentado).

4. **Dinámico e innovador** (petición del usuario al aprobar)
   - **Avisos tipo «isla»**: los avisos (`toast`) salen como una cápsula negra en la parte superior que se expande con efecto muelle y se recoge al desaparecer.
   - **Anillos de progreso** tipo «Actividad» para el avance de proyectos (Inicio y cabecera de proyecto), dibujados con SVG y animados al aparecer; los contadores suben de 0 a su valor.
   - **Profundidad**: tarjetas que se elevan al pasar el ratón con una leve inclinación que sigue al cursor (solo con ratón), título grande que se encoge al hacer scroll, desenfoque del fondo al abrir ventanas.

## No objetivos
- No cambia ninguna función, dato, permiso ni la base de datos (Supabase, RLS y tablas intactas).
- No se reescribe con otro framework; sigue siendo HTML/CSS/JS sin compilación.
- No se usan fuentes, iconos ni imágenes propiedad de Apple (ni SF Pro descargada, ni SF Symbols, ni logotipos): solo la fuente del sistema del dispositivo y los iconos Lucide que ya usa la web.

## Anti-objetivos
- Que algo deje de funcionar o se esconda una función que hoy se usa.
- Animaciones lentas o que mareen (nada por encima de 450 ms, nada en bucle salvo indicadores de carga).
- Contraste insuficiente: texto ≥ 4,5:1 en claro y oscuro.

## Enfoques considerados
- A. Solo sistema visual (CSS). Descartado por el usuario: quiere también reorganizar.
- **B. Sistema visual + reorganización de las pantallas principales (elegido).**
- C. Reescritura con un framework. Descartado: mucho riesgo para lo que aporta.

## Cómo se construye
- **Fase 0 · Muestra para aprobar (punto de control):** se aplica el nuevo sistema a **Inicio**, **tablero de un proyecto** y **móvil**, y se enseñan capturas en claro y oscuro. No se sigue sin el visto bueno.
- Fase 1: sistema visual completo — se sustituye `glass.css` por `apple.css` (tokens, materiales, componentes, animaciones) y se ajusta `app.css`; se quita la aurora del `index.html`.
- Fase 2: reorganización — menú lateral con nombres (`js/layout.js` `sideHTML`), barra superior, Inicio, cabecera de proyecto, tablero, barra inferior móvil.
- Fase 3: repaso pantalla por pantalla (lista, cronograma, calendario, diario, notas, material, entregables, incidencias, planos, decisiones, equipo, estadísticas, archivos, historial, papelera, ventanas modales, cálculos) con capturas automáticas en claro/oscuro y 1 280 / 390 px, sin errores de consola.
- Las pruebas de cálculo (`node --test tests/*.test.js`) deben seguir pasando.
- Se publica (unión a `main`) solo cuando el usuario lo pida.

## Lo que queda al constructor
Valores exactos de espaciado y tamaños dentro de las pautas anteriores; elección de iconos Lucide equivalentes.
