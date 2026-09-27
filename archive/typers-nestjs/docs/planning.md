# Planificación de proyectos

`src/business/planning/index.ts` exporta un motor de dominio independiente de Nest
para planificar tareas, dependencias y capacidad. La capa REST puede asociar sus
IDs al proyecto y a las tareas de Workspaces sin introducir HTTP ni persistencia
en el algoritmo.

## Contrato público

```ts
createPlan(input: PlanInput): Result<DeliveryPlan, PlanningError>
parsePlanInput(value: unknown): Result<PlanInput, PlanningError>
```

`createPlan` también acepta un segundo argumento opcional `{ signal }` para
cancelación cooperativa. `AbortSignal` pertenece al contexto de ejecución, no al
JSON. Incluso la entrada ya tipada pasa por validación runtime. El resultado usa
la unión discriminada `{ ok: true, value } | { ok: false, error }`.

```json
{
  "projectId": "website",
  "startDate": "2024-02-28",
  "dailyCapacityUnits": 4,
  "maxDays": 30,
  "costPerUnitCents": 125,
  "budgetCents": 1000,
  "tasks": [
    { "id": "design", "title": "Design", "effortUnits": 2, "priority": "high" },
    {
      "id": "build",
      "effortUnits": 4,
      "dependencies": ["design"],
      "maxDailyUnits": 2
    },
    {
      "id": "release",
      "effortUnits": 1,
      "dependencies": ["build"],
      "deadlineDay": 2
    }
  ]
}
```

El ejemplo consume 2 unidades el día 0, 2 el día 1, 2 el día 2 y 1 el día 3.
Termina el 2 de marzo de 2024, cuesta 875 céntimos y avisa de que `release` llegó
un día después de su plazo. La capacidad restante del día 0 no permite comenzar
`build`: las dependencias finalizadas habilitan trabajo al día siguiente.

## Reglas de negocio

- Los días son naturales, consecutivos y expresados en UTC. `startDate` es una
  fecha de calendario `YYYY-MM-DD`; no depende de la zona horaria del servidor.
- `startDay`, `endDay`, `earliestStartDay` y `deadlineDay` son offsets desde cero.
  `endDay` y `deadlineDay` son inclusivos; terminar en el plazo no genera retraso.
- El esfuerzo se divide en unidades enteras y puede repartirse entre días. Cada
  tarea consume como máximo `maxDailyUnits`, además de la capacidad global.
- Las prioridades son `critical`, `high`, `normal`, `low`. Cada día se ordenan las
  tareas elegibles por prioridad y después por ID usando comparación estable de
  caracteres, sin depender del locale ni del orden original de los arrays.
- Una tarea puede comenzar cuando se cumplan todas sus dependencias y su
  `earliestStartDay`. Los días sin trabajo por una fecha de disponibilidad también
  aparecen en el plan con su capacidad disponible intacta.
- El presupuesto y los plazos producen avisos sobre un plan válido. No descartan
  el resultado ni alteran de forma implícita la prioridad de las tareas.
- Los céntimos y las unidades son enteros seguros. Los límites de entrada impiden
  que sumar esfuerzo o multiplicar el coste produzca pérdida de precisión.
- Un proyecto sin tareas devuelve duración cero, listas vacías y `finishDate: null`.

La planificación es una heurística determinista de prioridad. No busca una
solución global óptima ni garantiza el menor plazo posible bajo todas las
restricciones. `capacity-exceeded` significa que esta política no terminó antes
de `maxDays`; además de capacidad insuficiente, pueden influir las dependencias,
las fechas de disponibilidad y la elección de prioridades.

## Validación y errores

Los IDs admiten entre 1 y 80 caracteres: letras ASCII, dígitos, punto, guion,
guion bajo y dos puntos. La entrada admite hasta 1000 tareas, esfuerzo y capacidad
entre 1 y 1.000.000 unidades, un horizonte de 1 a 3660 días —365 por defecto— y
coste por unidad entre 0 y 1.000.000 céntimos. Los offsets aceptados están entre
0 y 3659. `startDate` y el horizonte deben mantenerse dentro del año 9999.

Los campos desconocidos se rechazan para detectar errores de escritura. Los
campos opcionales omitidos usan sus valores por defecto; `null` no equivale a
omisión. Se comprueban fechas reales —incluidos años bisiestos—, enteros finitos,
IDs duplicados, dependencias repetidas, referencias ausentes y ciclos, incluido
el ciclo de una tarea consigo misma. Las listas se copian antes de ordenarse;
se pueden entregar objetos/arrays congelados.

| Código                 | Datos del error                                 | Convención de `planningErrorStatus` |
| ---------------------- | ----------------------------------------------- | ----------------------------------- |
| `invalid-input`        | `path` y mensaje legible                        | 400                                 |
| `duplicate-task`       | `taskId`                                        | 409                                 |
| `duplicate-dependency` | `taskId`, `dependencyId`                        | 409                                 |
| `missing-dependency`   | `taskId`, `dependencyId`                        | 422                                 |
| `cyclic-dependency`    | `cycle`, por ejemplo `["a", "b", "a"]`          | 422                                 |
| `capacity-exceeded`    | horizonte, esfuerzo restante e IDs sin terminar | 422                                 |
| `cancelled`            | cantidad de inputs procesados en el lote        | 499                                 |

El 499 es una convención de la demo para cancelación, no un código HTTP estándar.
Un adaptador puede utilizar su política propia. Los errores de validación no
lanzan excepciones. Un error del productor externo de un `AsyncIterable`, en
cambio, se propaga como excepción de esa fuente.

## Resultado y ruta crítica

`DeliveryPlan` contiene tareas con fechas, asignaciones por día, esfuerzo y coste
totales, capacidad usada/disponible, retrasos y avisos de presupuesto. Utiliza
exclusivamente objetos, arrays y primitivas serializables como JSON; no devuelve
`Date`, `Map`, `Set`, bigint, referencias circulares ni instancias del grafo.

`criticalPath` devuelve una cadena determinista y una cota inferior de duración.
Se calcula sobre el DAG, teniendo en cuenta dependencias, fechas de disponibilidad
y el límite diario individual de cada tarea. No incluye competencia entre tareas
por la capacidad global: dos tareas independientes pueden alargar el plan real
sin alargar esa cadena. No es el conjunto de todas las cadenas críticas.

Internamente, `DependencyGraph` encapsula mapas privados, realiza ordenación
topológica de Kahn y usa DFS iterativo para devolver un ciclo cerrado concreto.
`CapacityPlanner` mantiene esfuerzo restante y dependencias pendientes; solo
habilita dependientes después de terminar todas las asignaciones del día. El
cálculo no muta entradas ni conserva estado global entre llamadas.

## Iterables, proyecciones y procesamiento por lotes

- `iterateAllocations(plan)` es un generador síncrono de filas con clave
  `day:<offset>/task:<id>`, fecha e importe de esfuerzo.
- `selectTaskFields(plan, ['id', 'startDay'])` produce una proyección tipada de las
  tareas mediante `keyof` y `Pick`; no expone campos que no se solicitaron.
- `planBatches(inputs, { batchSize, signal })` admite `Iterable` y `AsyncIterable`
  y devuelve un generador asíncrono de `Result<PlanBatch, PlanningError>`.
  Cada lote conserva índices de entrada, resultados individuales y contadores.
  `batchSize` es un entero entre 1 y 1000, con valor por defecto 10.

El generador no lee por adelantado el siguiente lote y deja pasar un turno del
bucle de eventos entre inputs. Un fallo de planificación pertenece al resultado
de su elemento: no impide procesar los demás. Si se cancela, entrega primero el
lote parcial ya completado y después un único error `cancelled`. Al salir mediante
`return()` o cancelar, cierra el iterador de entrada mediante el protocolo iterable.
Una señal abortada antes del primer consumo evita leer la fuente.

La cancelación es cooperativa: no interrumpe a mitad una operación JavaScript
síncrona. Tampoco puede forzar la resolución de un `next()` externo que nunca
termine; una fuente que haga I/O debe respetar también la señal. Los límites de
tareas/horizonte acotan el trabajo síncrono de cada proyecto. No se almacenan
múltiples planes por adelantado fuera del lote solicitado.

## Variedad TypeScript y verificación

El módulo usa unions discriminadas, narrowing de `unknown`, generics, `keyof`,
`Pick`, tipos condicionales con `infer`, mapped types, readonly recursivo,
template literal types, `satisfies`, campos privados `#`, protocolos iterables,
generadores y comprobación exhaustiva mediante `never`. Estos patrones sirven a
contratos concretos del dominio: resultados, errores, prioridades y proyecciones.

```sh
pnpm exec vitest run src/business/planning/planning.spec.ts
pnpm typecheck
pnpm exec oxlint --type-aware src/business/planning/
```

La suite comprueba un DAG en diamante, orden estable con arrays reordenados y
congelados, prioridad con nuevas disponibilidades, esfuerzo repartido, año
bisiesto, plazos inclusivos, presupuesto, proyecto vacío, errores de grafo,
horizonte insuficiente, cotas de ruta crítica y un DAG de 120 tareas con un
verificador independiente de invariantes. También prueba JSON, proyecciones,
batches, backpressure, cierre de fuentes y cancelación antes/durante el consumo.

`planning.type-test.ts` es una fixture que el comprobador de tipos incluye y
Vitest no ejecuta. Contiene casos positivos y `@ts-expect-error` para invariantes
de readonly, errores tipados, selección de campos, narrowing y claves de informe.
No se invoca su función de contratos. Estos resultados siguen siendo la referencia
TypeScript oficial; no demuestran todavía compatibilidad con Typers.
