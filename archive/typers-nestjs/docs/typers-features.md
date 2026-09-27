# Demostración de las capacidades implementadas de Typers

Este catálogo conecta el código público de Typers con ejemplos ejecutables en
`typers-nestjs`. El inventario se ha contrastado con el código del compilador en
`efe9894778169f53a3a6a0d3d42e0efa4bae3d7f` y los manifests de sus tres paquetes
locales. Los hashes del informe de cada ejecución identifican el artefacto probado:
una versión o un commit no describen por sí solos un build con cambios locales.

## Primero: abre la aplicación NestJS con Typers

La aplicación que debes inspeccionar y modificar está en
**[`apps/typers/src`](../apps/typers/src)**. Tiene módulos Nest, servicios de
presupuestos y reservas, repositorios de catálogo, controladores HTTP y Swagger.
Su [guía](../apps/typers/README.md) explica la preparación, el flujo y los límites;
[`requests.http`](../apps/typers/requests.http) permite probarla desde WebStorm.

```sh
pnpm start:typers       # Aplicación HTTP en http://127.0.0.1:3014/docs
pnpm build:typers       # JavaScript, declaraciones, mapas y assets
pnpm typecheck:typers   # CLI nativo, sin emisión
pnpm test:typers        # Build + Node sobre la salida
pnpm typers:refresh     # Después de reconstruir tarballs o cambiar dependencias
```

| Funcionalidad aplicada                   | Fuente                                                                                                                                               | Caso esperado y comprobación                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `Result`, `Ok`, `Err`                    | [quotes.service.ts](../apps/typers/src/quotes/quotes.service.ts)                                                                                     | Presupuesto válido → 200; cupón desconocido → 400. `test:typers` comprueba ambos casos por HTTP. |
| `Option`, `Some`, `None`, `fromNullable` | [quote-input.ts](../apps/typers/src/quotes/quote-input.ts)                                                                                           | Nota/cupón ausentes se representan explícitamente; JSON inválido se rechaza en runtime.          |
| `if let Some`                            | [quotes.service.ts](../apps/typers/src/quotes/quotes.service.ts), [reservations.service.ts](../apps/typers/src/reservations/reservations.service.ts) | Producto presente/ausente, cupón `ZERO` presente con 0%, nota y reserva previa idempotente.      |
| Búsqueda opcional y stock                | [catalog.repository.ts](../apps/typers/src/catalog/catalog.repository.ts), [catalog.controller.ts](../apps/typers/src/catalog/catalog.controller.ts) | SKU desconocido → 404; `EMPTY` existe con stock cero y reservarlo → 409.                         |
| Errores tipados hasta HTTP               | [domain-result.ts](../apps/typers/src/http/domain-result.ts)                                                                                         | Conversión exhaustiva a 400/404/409; el dominio no depende de excepciones HTTP.                  |
| Emisión nativa y metadatos de DI         | [tsconfig.json](../apps/typers/tsconfig.json), [bootstrap.ts](../apps/typers/src/bootstrap.ts)                                                       | Nest resuelve servicios/repositorios por constructor en el JavaScript emitido.                   |
| Adaptador y assets                       | [nest-cli.json](../apps/typers/nest-cli.json), [policy.controller.ts](../apps/typers/src/http/policy.controller.ts)                                  | `build:typers` copia la política; `/api/policy` la lee desde `dist`.                             |

Los [tests de aplicación](../apps/typers/test/app.test.mjs) están separados de
los resultados históricos del laboratorio. Cada build escribe su procedencia
en `apps/typers/reports/build.json`; los resultados de pruebas corresponden a
la ejecución de `pnpm test:typers`. La app tiene manifiesto, dependencias y lock
propios con tarballs `file:` del compilador hermano; la referencia `src/` raíz
conserva TypeScript oficial. Si faltan tarballs, sigue los
[comandos reales de preparación](../apps/typers/README.md#preparación-en-un-checkout-nuevo-o-si-faltan-tarballs).

La [evidencia de esta app](typers-application-results.json) registra **13 pruebas
Node aprobadas**, acceso real al servidor en 3014 con Swagger/API y cierre
mediante SIGTERM. La referencia también pasó `pnpm check` de nuevo: 109 pruebas
unitarias, 131 e2e y 26 contratos Node. Estos resultados se conservan separados
de la ejecución histórica de fixtures descrita a continuación.

`fixtures` nombra casos pequeños que aíslan una condición del compilador. Se
mantienen para probar errores de sintaxis, contratos ESM/CJS y APIs nativas;
`apps/typers` es la aplicación de negocio. WebStorm puede ejecutar el script,
pero su parser aún no entiende `if let`; el build y la comprobación de tipos de
esta app se hacen con Typers. No se añade soporte de watch, aliases o plugins.

## Evidencia histórica de los perfiles aislados

La [ejecución integrada de fixtures](typers-features-results.json), iniciada el 15 de
septiembre de 2026 a las 18:04:16 UTC, terminó correctamente: `completed: true`,
`passed: true` y código de salida 0. Los rechazos esperados conservan su estado
fallido y sus diagnósticos dentro del informe.

## Qué está disponible

| Capa                          | Estado y origen                                              | Superficie implementada                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Compilador nativo y CLI       | Base TypeScript 7.0.2 heredada, distribución local de Typers | Comandos `typers` y `tsc`, tsconfig, comprobación y emisión nativa a JavaScript, declaraciones y mapas; procedencia y binario del host incluidos.                              |
| Runtime `@typers/core`        | Extensión propia experimental, `0.1.0-alpha.0`               | Cinco valores públicos: `Some`, `None`, `Ok`, `Err`, `fromNullable`; seis tipos: `Some<T>`, `None`, `Option<T>`, `Ok<T>`, `Err<E>`, `Result<T, E>`. ESM/CJS con declaraciones. |
| `if let Some`                 | Extensión propia experimental y opt-in                       | Binding simple, `else` opcional con bloques, protocolo estructural, evaluación única, ámbito y tipo del valor, temporales sin colisiones.                                      |
| API nativa                    | Cliente upstream distribuido por Typers; rutas `unstable/*`  | Sync/async, proyectos y snapshots, filesystem virtual, diagnósticos, AST, checker, símbolos, tipos, firmas, referencias, completions y printer.                                |
| `project.typersEmitProject()` | Extensión propia experimental de la API                      | Emisión del proyecto del snapshot a memoria, diagnósticos y `configFileNames`; respeta los modos de emisión admitidos.                                                         |
| `@typers/nest`                | Adaptador propio experimental, `0.1.0-alpha.0`               | `typers-nest build [project]`, `buildNest(options)`, configuración Nest, selección, assets, validación previa y escritura.                                                     |

Los paquetes son privados/locales, sin publicación npm. El runtime está escrito
en TypeScript estándar y puede usarse sin la sintaxis nueva. Las capacidades
heredadas se identifican como tales: BigInt, NodeNext, DI/decoradores legacy,
genéricos, `using`, TSX o decoradores estándar no son extensiones creadas por
Typers. Su comportamiento en este corpus se mide por separado en la
[comparación de compiladores](typers-comparison.md).

## Ejecutar e inspeccionar los perfiles aislados

El punto de entrada de los perfiles de validación es
[`scripts/demonstrate-typers.mjs`](../scripts/demonstrate-typers.mjs). Consulta sus
opciones antes de elegir los tarballs:

```sh
node scripts/demonstrate-typers.mjs --help

pnpm demo:typers \
  --compiler ../typers/built/typers/typers-compiler-7.0.2-typers.0.tgz \
  --core ../typers/built/typers/typers-core-0.1.0-alpha.0.tgz \
  --nest ../typers/built/typers/typers-nest-0.1.0-alpha.0.tgz \
  --report reports/typers-features.json
```

Añade `--profile runtime`, `--profile experimental`, `--profile native-api` o
`--profile nest-adapter` para ejecutar una sola capa; `all` es el valor
predeterminado. Los tres tarballs siguen siendo explícitos. `--prepare-only`
materializa el consumidor e imprime comandos sin compilarlo. Requiere las
dependencias del repositorio instaladas con su lockfile y artefactos ya
construidos para la plataforma local.

El consumidor aislado conserva las fuentes materializadas, configuraciones,
paquetes, JavaScript/declaraciones/mapas y resultados para revisión. Los perfiles
de Typers se encuentran en [`fixtures/typers`](../fixtures/typers); la aplicación
de `src/` conserva su TypeScript oficial de referencia. Los tests de los perfiles
ejecutan el JavaScript emitido con Node y aplicaciones Nest reales; Vitest no
transforma las fuentes experimentales.

Los apartados siguientes describen el contrato esperado. El resultado observado,
la identidad de los artefactos y cada fallo esperado deben leerse en el informe de
la ejecución concreta. No confundir disponer de código con haber ejecutado una
prueba, ni un import de una subruta con comprobar todas sus operaciones.

### Estado de la verificación de los perfiles

| Perfil                           | Resultado observado en la entrega                                                                                                                                                                                 | Evidencia reproducible                                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `runtime`                        | Compilación Typers correcta, 11/11 pruebas Node; comprobación adicional con TypeScript 6 correcta.                                                                                                                | [Fuentes y pruebas](../fixtures/typers/runtime/README.md)                                                                                   |
| `experimental`                   | Compilación CLI Typers y 8/8 pruebas Node correctas, incluido Nest HTTP/DI; TypeScript 6 consume las declaraciones emitidas. El adaptador compila las mismas fuentes y repite correctamente las mismas 8 pruebas. | [Fuentes y pruebas](../fixtures/typers/experimental/README.md), [consumidor de declaraciones](../fixtures/typers/experimental/consumer.mts) |
| Negativos experimentales         | Siete compilaciones rechazan los casos previstos con código 1; diagnósticos concretos abajo.                                                                                                                      | [Fixtures negativos](../fixtures/typers/experimental/negative)                                                                              |
| TypeScript oficial ante `if-let` | Rechaza la gramática con TS1005/1128 y código 2 en una configuración de comparación sin el flag exclusivo de Typers.                                                                                              | Paso `experimental-official-rejection` del [informe](typers-features-results.json)                                                          |
| `native-api`                     | 36 contratos agrupados correctos: sync/async, consultas, emisión, modos, snapshots y utilidades; tipos públicos comprobados por CLI.                                                                              | [Consumidor y aserciones](../fixtures/typers/native-api/run.mjs)                                                                            |
| `nest-adapter`                   | 14 comprobaciones agrupadas correctas, incluidas 8 familias de rechazo con conservación de salidas; API/CLI producen bytes idénticos y pasan HTTP, DI, metadata y assets.                                         | [Consumidor y aserciones](../fixtures/typers/nest-adapter/run.mjs), [guía manual](../fixtures/typers/nest-adapter/README.md)                |

Los siete negativos son: opt-in desactivado (TS1005), operando `unknown`
(TS1360), patrón `Ok` (TS180001), destructuring (TS180001/180002 y diagnósticos
de recuperación TS1128/1434), bloque ausente (TS180002), promesa sin `await`
(TS1360) y variante `some` sin payload (TS1360). Se conservan como compilaciones
fallidas esperadas; no se suman a las 19 pruebas Node de los dos perfiles.

Son 11 pruebas runtime y 8 experimentales distintas, con esas 8 repetidas sobre
la emisión del adaptador. Los 36 contratos API y las 14 comprobaciones del
adaptador agrupan varias aserciones y tienen otra unidad de recuento: no se
suman como si fueran una única suite homogénea. Tampoco se añaden a las pruebas
Vitest de referencia. La API conserva además sus rechazos de
incremental/composite/referencias y del completado global que requiere
auto-imports; el adaptador conserva errores de tipos, configuración y rutas.

### Identidad exacta de la medición

Entorno: Node 24.20.0, macOS arm64 y Go 1.27.1. El compilador empaquetado declara
base TypeScript 7.0.2, commit de fuentes
`efe9894778169f53a3a6a0d3d42e0efa4bae3d7f` y
`compilerWorktreeDirty: false`. Esta es una nueva medición del artefacto actual;
no se identifica por el tarball anterior construido con cambios locales.

| Tarball            | Versión          | SHA-256                                                            |
| ------------------ | ---------------- | ------------------------------------------------------------------ |
| `@typers/compiler` | `7.0.2-typers.0` | `ef37a6350d19cab6b113077d1c460e7ef22d5da9dd2364b7c6b97d9d4c849b15` |
| `@typers/core`     | `0.1.0-alpha.0`  | `9c1571d8c4d7f64afc5b1841a92a2a6c27835a7472ef4bf3f270753070e25a45` |
| `@typers/nest`     | `0.1.0-alpha.0`  | `38c6b942bc9fefa75a1f0d514e8969220e68d1dfeaec5593518b727d0ce6fe72` |

El binario nativo instalado tiene SHA-256
`5057f05cdcadd8ff8c0dce28ae737ae9758b7300822886b71bcc8af3f1e83651`.
El manifiesto de los 63 archivos del snapshot de fixtures tiene SHA-256
`181e623b6b4691e256d29afb25c5b29ca2f298e524da45948ff55d176f4760bd`.
El [informe](typers-features-results.json) conserva también hashes por archivo,
los dos scripts del harness, las dependencias enlazadas, comandos, logs y
resultados. Al finalizar se comprobaron intactos el TypeScript oficial 6.0.3
instalado y el lockfile de referencia (`reference.preserved: true`). Las
dependencias de referencia se enlazan por paquete: esto no representa una
instalación independiente nueva de todo el árbol pnpm.

La ejecución revisable es `typers-features-1xlQrv`. Su ruta absoluta local figura
en `runDirectory`; contiene copias de los perfiles, artefactos y logs completos.
La emisión API se conserva en memoria y sus ejemplos JS/declaraciones/mapas
aparecen en `steps[native-api-node].evidence.clients.sync.main.capturedExamples`.
Aquí `native-api-node` identifica el elemento por `id`; `steps` es un array.

## Diferencias frente a la aplicación de referencia

La entrega inicial añadió los cuatro perfiles
[`runtime`](../fixtures/typers/runtime),
[`experimental`](../fixtures/typers/experimental),
[`native-api`](../fixtures/typers/native-api) y
[`nest-adapter`](../fixtures/typers/nest-adapter); los scripts
[`demonstrate-typers.mjs`](../scripts/demonstrate-typers.mjs) y
[`typers-lab-support.mjs`](../scripts/typers-lab-support.mjs); el comando
`demo:typers` en [package.json](../package.json); la exclusión de
`fixtures/typers` del [tsconfig raíz](../tsconfig.json); e instrucciones y
documentación en [AGENTS.md](../AGENTS.md), README y las guías Typers.
Las fuentes de la aplicación y sus pruebas oficiales en `src/` y `test/`
conservan su implementación de referencia. La exclusión mantiene la gramática
experimental en su perfil de compilación explícito.

Para inspeccionar la diferencia de representación, abre estos pares:

| Referencia estándar                                                                                                       | Perfil Typers                                                                 | Diferencia concreta                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Result local de pricing](../src/business/pricing/result.ts) y [cálculo de presupuesto](../src/business/pricing/quote.ts) | [Presupuesto con `@typers/core`](../fixtures/typers/runtime/src/budget.ts)    | La referencia usa `ok: true/false`, helpers locales y `andThen`; el fixture usa `kind: "ok"/"err"` y los constructores del paquete real. No es una migración ni una equivalencia de todas las reglas de pricing.   |
| [Validación estándar de presupuesto](../src/business/pricing/validation.ts)                                               | [`parseQuoteInput` y `decodeStock`](../fixtures/typers/runtime/src/budget.ts) | Ambas validan `unknown` en runtime; el perfil demuestra cómo introducir `Result` y `Option` después de validar. Los tipos por sí solos no validan JSON.                                                            |
| [Narrowing TS del runtime](../fixtures/typers/runtime/src/budget.ts)                                                      | [Reservas con `if let Some`](../fixtures/typers/experimental/src/nest-app.ts) | El primero discrimina `candidate.kind`; el segundo extrae el valor con sintaxis experimental y mantiene explícita la conversión a HTTP. Cero existencias sigue siendo presencia, y un SKU desconocido es ausencia. |

La regla mínima de presupuesto del fixture devuelve 2703 céntimos para tres
unidades de 1001 con descuento del 10 %. La referencia mantiene su catálogo,
políticas, redondeos y flujos amplios; sus reglas completas se validan mediante
la [comparación independiente del corpus](typers-comparison.md).

## Índice: runtime y sintaxis

En esta tabla, **demo** significa ejecutar el comando anterior con los tres
tarballs explícitos, añadiendo el perfil indicado. Los tests son programas Node
conservados junto al fixture. Desde el directorio materializado de cada perfil:

```sh
node ../../node_modules/@typers/compiler/bin/typers.cjs -p tsconfig.json --pretty false
node --test runtime.test.mjs
```

Para la sintaxis, usa `experimental.test.mjs` como test en el directorio
`experimental`. Después del build, `node dist/src/main.js` abre la demostración
HTTP experimental en `http://127.0.0.1:3014`; se cierra con Ctrl+C. Las pruebas
usan puertos efímeros y cierran la aplicación por sí mismas.

En otra terminal, estos casos permiten ver éxito, ausencia y validación:

```sh
curl -i http://127.0.0.1:3014/stock/EMPTY
curl -i http://127.0.0.1:3014/stock/MISSING
curl -i http://127.0.0.1:3014/reservations \
  -H 'content-type: application/json' \
  -d '{"sku":"WIDGET","units":2,"note":""}'
curl -i http://127.0.0.1:3014/reservations \
  -H 'content-type: application/json' \
  -d '{"sku":"WIDGET","units":0}'
```

En un proceso recién iniciado, devuelven respectivamente HTTP 200 con
`Some(0)`, 404 `UNKNOWN_SKU`, 201 con dos unidades restantes y nota presente
vacía, y 400 `INVALID_INPUT`. Reservar tres unidades después de reservar dos
devuelve 409 `INSUFFICIENT_STOCK`. El stock vive en memoria del perfil aislado.

| Capacidad                                      | Fuente legible                                                                                                           | Comando / prueba                                                        | Resultado esperado                                                                                                                   | Límite del caso                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `Ok` / `Err` y `Result<T,E>`                   | [Presupuesto](../fixtures/typers/runtime/src/budget.ts)                                                                  | Demo; [aserciones runtime](../fixtures/typers/runtime/runtime.test.mjs) | El presupuesto válido contiene un valor; una entrada o regla inválida contiene un error tipado que el consumidor decide cómo tratar. | `Err(error)` no lanza ni captura excepciones; una función que devuelve `Result` puede lanzar por otras causas. |
| `Some` / `None` y `Option<T>`                  | [Presupuesto](../fixtures/typers/runtime/src/budget.ts)                                                                  | Demo; `runtime.test.mjs`                                                | Presencia y ausencia se deciden por `kind`, con acceso al payload después de narrowing.                                              | `None` es un valor, no `None()`. La forma es estructural; no valida JSON externo.                              |
| `fromNullable`                                 | [Presupuesto](../fixtures/typers/runtime/src/budget.ts) y [aserciones](../fixtures/typers/runtime/runtime.test.mjs)      | Demo; `runtime.test.mjs`                                                | Solo `null` y `undefined` producen ausencia; `0`, `false` y `""` permanecen presentes.                                               | `Some(undefined)` y `Some(null)` son presencia; el helper y el constructor tienen contratos diferentes.        |
| Tipos de variantes y campos `readonly`         | [Contratos de tipos](../fixtures/typers/runtime/src/type-contracts.ts)                                                   | Demo; compilación real con Typers                                       | Usos válidos compilan y cada `@ts-expect-error` encuentra su error.                                                                  | `readonly` se borra en JavaScript; no congela el payload.                                                      |
| Distribución ESM/CJS y referencia de payloads  | [Consumidor CJS](../fixtures/typers/runtime/src/commonjs.cts), [aserciones](../fixtures/typers/runtime/runtime.test.mjs) | Demo; compilación `.cts` y ejecución Node                               | Ambas condiciones de exports resuelven su JS/declaraciones; `None` está congelado y el constructor conserva el objeto recibido.      | El singleton `None` pertenece a cada instancia del módulo; no exigir igualdad ESM/CJS o entre copias.          |
| `if let Some(identifier)` con `else`           | [Perfil experimental](../fixtures/typers/experimental)                                                                   | Demo; Typers con `experimentalTypersSyntax: true`                       | Rama presente con valor tipado y rama ausente; Node ejecuta el JavaScript normalizado.                                               | Solo `Some` y un identificador simple; ambas ramas requieren bloque.                                           |
| Evaluación única, scope e higiene              | [Perfil experimental](../fixtures/typers/experimental)                                                                   | Demo; aserciones Node y contratos negativos                             | Un operando con efecto se evalúa una vez; binding local equivalente a `const`, anidamiento y nombres del usuario preservados.        | No implica inmutabilidad profunda ni espera automática de promesas.                                            |
| Protocolo estructural y opt-in                 | [Perfil experimental](../fixtures/typers/experimental)                                                                   | Demo; perfiles positivo/desactivado y rechazos                          | Un objeto estructural válido funciona sin importar `Some` como patrón; el perfil desactivado rechaza la sintaxis.                    | `unknown` debe refinarse; `any` conserva los escapes de TypeScript.                                            |
| Diagnósticos experimentales y `.d.ts` estándar | [Perfil experimental](../fixtures/typers/experimental)                                                                   | Demo; casos inválidos y consumidor de declaraciones                     | Patrón, operando o bloque inválido producen diagnósticos; declaraciones públicas no contienen `if let`.                              | No se certifican todas las posiciones de depuración ni edición sin pérdida del AST.                            |

El runtime no exporta `unwrap`, `map`, `andThen`, captura automática de `throw`,
adaptadores de promesas ni generadores de wrappers. Si el ejemplo compone
funciones o traduce errores a HTTP, esa lógica pertenece a la aplicación y queda
visible en sus fuentes; no se atribuye al paquete.

## Índice: CLI, API y emisión

Para esta capa añade `--profile native-api` al comando de demostración. El
consumidor programático está completo en
[`native-api/run.mjs`](../fixtures/typers/native-api/run.mjs). Desde su directorio
materializado: `node run.mjs`; para comprobar sus tipos públicos:
`node ../../node_modules/@typers/compiler/bin/typers.cjs -p tsconfig.contracts.json --pretty false`.

| Capacidad                                  | Ejemplo / fuente                                                                                                                                                                                                 | Comando / prueba                                                              | Resultado esperado                                                                                                                                           | Límite del caso                                                                                                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identidad del compilador, `typers` y `tsc` | [Harness](../scripts/demonstrate-typers.mjs); [manifest](../../typers/packages/compiler/package.json)                                                                                                            | Demo; consulta de versión, metadata y hashes                                  | Binario del paquete de la plataforma local; `typersVersion`, `upstreamVersion`, commit y estado del build identificables.                                    | Un launcher nativo no acredita otras plataformas ni la API clásica.                                                                                        |
| Comprobación y emisión estándar CLI        | [Comparación del corpus](../scripts/compare-typers.mjs)                                                                                                                                                          | `pnpm compare:typers` con tarballs; [26 contratos Node](typers-comparison.md) | Typecheck, JavaScript, declaraciones, mapas y comportamiento comparados por ruta.                                                                            | El CLI no copia assets Nest; el harness de comparación registra su copia explícita.                                                                        |
| Clientes sync y async                      | [Consumidor de API](../fixtures/typers/native-api)                                                                                                                                                               | Demo; cliente real y cierre de recursos                                       | Ambos abren el binario instalado, obtienen proyecto y consultan la misma fuente.                                                                             | Cliente y servidor deben proceder del mismo build; no se usa `tsserverPath` para ocultar otro compilador.                                                  |
| Configuración y snapshots                  | [Presupuesto API](../fixtures/typers/native-api/src/budget.ts), [configuración](../fixtures/typers/native-api/tsconfig.json)                                                                                     | Demo; creación, actualización y liberación                                    | La vista retenida conserva su programa; una vista nueva refleja los cambios notificados; no se reutiliza una vista liberada.                                 | No representa un watch ni una garantía de toda interacción concurrente.                                                                                    |
| AST, símbolos, tipos y printer             | [Fuentes API](../fixtures/typers/native-api/src)                                                                                                                                                                 | Demo; consultas del cliente, predicados y printer nativo                      | Se encuentran nodos del presupuesto, sus símbolos/tipos y un nodo impreso.                                                                                   | `printNode` imprime AST; no sustituye la compilación con borrado de tipos y decoradores.                                                                   |
| Once subrutas distribuidas                 | [Consumidor API](../fixtures/typers/native-api), [contratos de tipos](../fixtures/typers/native-api/contracts.mts)                                                                                               | Demo; importación y ejemplos seleccionados                                    | Todas las rutas públicas resuelven y los ejemplos usan sus utilidades reales.                                                                                | Un ejemplo de fábrica, visitor o scanner no verifica todos sus nodos ni adapta parsers externos.                                                           |
| Fábrica, visitor, clone y scanner          | [Consumidor API](../fixtures/typers/native-api/run.mjs)                                                                                                                                                          | Demo; aserciones de tokens y printer                                          | La fábrica crea `string \| number`, el visitor cambia `number` por `boolean`, el clon preserva el resultado impreso; el scanner reconoce tokens TS estándar. | Es manipulación/impresión de nodos; no registra un plugin en el emisor.                                                                                    |
| Firmas, referencias y completions          | [Presupuesto API](../fixtures/typers/native-api/src/budget.ts), [consumidor](../fixtures/typers/native-api/run.mjs)                                                                                              | Demo; consultas sync/async                                                    | Encuentra usos de `maximumBudget`, parámetro `amount`, retorno `Allocation` y completion `Number.isSafeInteger`.                                             | La consulta global al final del archivo rechaza `completion list needs auto imports`; no acredita auto-imports ni editor completo.                         |
| VFS y snapshots retenidos                  | [Consumidor API](../fixtures/typers/native-api/run.mjs)                                                                                                                                                          | Demo; callback `readFile` en el cliente                                       | El presupuesto virtual cambia de 1200 a 1500 en una vista nueva; la anterior sigue en 1200 y el archivo de disco no cambia.                                  | Es un overlay de lectura; configuraciones, metadata de paquetes y bibliotecas siguen en disco. No prueba concurrencia arbitraria, grafos grandes ni watch. |
| Medición de peticiones                     | [Consumidor API](../fixtures/typers/native-api/run.mjs)                                                                                                                                                          | Demo; `collectTiming`, lectura y reset                                        | Registra peticiones/bytes y reinicia contadores en ambos clientes.                                                                                           | Instrumentación funcional; no es un benchmark de rendimiento.                                                                                              |
| Emisión en memoria                         | [Perfil principal API](../fixtures/typers/native-api/tsconfig.json)                                                                                                                                              | Demo; `project.typersEmitProject()` sync/async                                | `outputs` ordenados contienen JS, `.d.ts` y mapas; no existe salida en disco hasta que el consumidor la escribe.                                             | No acepta custom transformers, no copia assets y no implementa rollback de escrituras del consumidor.                                                      |
| Configuraciones heredadas                  | [Configuración base](../fixtures/typers/native-api/tsconfig.base.json)                                                                                                                                           | Demo; inspección de `configFileNames`                                         | Ruta del tsconfig y sus `extends`, absolutas, ordenadas y sin duplicados, incluso con `noEmit` o diagnósticos.                                               | Se refiere al snapshot emitido, no a un nuevo parseo de archivos vivos.                                                                                    |
| `noEmit` y `emitDeclarationOnly`           | [No emit](../fixtures/typers/native-api/tsconfig.no-emit.json), [declarations](../fixtures/typers/native-api/tsconfig.declarations.json)                                                                         | Demo; modos de emisión                                                        | `noEmit`: salida vacía y `emitSkipped`; declaration-only: solo declaraciones y mapas correspondientes.                                                       | Las opciones las decide el perfil; la API no las sustituye silenciosamente.                                                                                |
| Errores con y sin `noEmitOnError`          | [Fuente inválida](../fixtures/typers/native-api/src/invalid-budget.ts), [bloqueo](../fixtures/typers/native-api/tsconfig.blocked.json), [errores](../fixtures/typers/native-api/tsconfig.errors.json)            | Demo; diagnóstico TS2322 y salidas                                            | Se conservan diagnósticos; con bloqueo no se emite, sin bloqueo se observa la política configurada.                                                          | Emitir con un error no equivale a que el programa sea correcto.                                                                                            |
| Rechazo de modos no admitidos por la API   | [Incremental](../fixtures/typers/native-api/tsconfig.incremental.json), [composite](../fixtures/typers/native-api/tsconfig.composite.json), [references](../fixtures/typers/native-api/tsconfig.references.json) | Demo; peticiones negativas                                                    | Rechazo explícito de `typersEmitProject` sin sustituir el backend.                                                                                           | La restricción pertenece a esta operación y al adaptador; no convierte todo el CLI heredado en incompatible con esos modos.                                |

### Superficie nativa heredada que distribuye el paquete

Las once rutas son `unstable/sync`, `unstable/async`, `unstable/fs`,
`unstable/proto`, `unstable/ast`, `unstable/ast/is`, `unstable/ast/factory`,
`unstable/ast/utils`, `unstable/ast/scanner`, `unstable/ast/visitor` y
`unstable/ast/clone`. Todas incluyen declaraciones. El prefijo de importación es
`@typers/compiler/` o `typescript/` según el nombre bajo el que se instale el
tarball. La entrada raíz CJS exporta `version`, `versionMajorMinor`,
`typersVersion` y `upstreamVersion`.

El [cliente sync](../../typers/tsc/_packages/native-preview/src/api/sync/api.ts)
y su [equivalente async](../../typers/tsc/_packages/native-preview/src/api/async/api.ts)
implementan estas familias, además de la extensión de emisión:

- `API`: configuración, snapshots, caché, cierre y medidas de peticiones mediante
  `collectTiming`, `getTimingInfo` y `resetTimingInfo`.
- `Snapshot`: proyectos, proyecto predeterminado de archivo, estado y liberación.
- `Project`: opciones, raíces, `program`, `checker`, `emitter` y emisión Typers.
- `Program`: fuentes, metadata de bibliotecas y diagnósticos de sintaxis, binder,
  semántica, sugerencias, declaraciones, programa, globales y configuración.
- `Checker`: consultas por nodo/posición, símbolos, tipos, firmas, tipos
  intrínsecos/contextuales, asignabilidad, restricciones, propiedades, índices,
  exports, aliases de símbolos, documentación/JSDoc, referencias y completions.
  Resolver un alias de símbolo no reescribe un import `paths` emitido.
- `Symbol`, objetos de tipo, `Signature` y `NodeHandle`: inspección de miembros,
  exports, declaraciones, parámetros, retornos, variantes de tipos y recuperación
  de nodos en el proyecto correspondiente.
- `Emitter.printNode`: impresión de nodos con sus opciones. `fs` ofrece
  `createVirtualFileSystem` y callbacks; `proto` ofrece contratos e identificadores
  de archivos/URI. AST incluye enums/tipos, predicados, factories, scanner,
  navegación, visitantes, clones y utilidades.

El código también expone conexión por pipe/`fromLSPConnection` y utilidades
`API.internal` para perfiles CPU/heap. Son capacidades heredadas; esta demo no
acredita una integración de editor/LSP ni un benchmark mediante enumerarlas.
Los casos ejecutados del cliente son una muestra funcional de esta superficie,
no cobertura de todos sus métodos, overloads, opciones o nodos AST.

La consulta de completado global del fixture es una limitación observada:
`completion list needs auto imports`. El test conserva el rechazo y prueba de
forma independiente el completado de miembros de `Number`. Disponer del método
`getCompletionsAtPosition` no garantiza todos los contextos de completado.

## Índice: adaptador Nest

Añade `--profile nest-adapter` al comando de demostración. Las fuentes son
[`nest-adapter/src/app.ts`](../fixtures/typers/nest-adapter/src/app.ts), la
[configuración Nest](../fixtures/typers/nest-adapter/nest-cli.json) y el
[consumidor/pruebas](../fixtures/typers/nest-adapter/run.mjs). Desde el perfil
materializado, `node run.mjs` vuelve a ejecutar sus contratos.

El contrato de referencia está en el
[README del adaptador](../../typers/packages/nest/README.md), sus
[tipos públicos](../../typers/packages/nest/src/build.d.ts) y
[código de build](../../typers/packages/nest/src/build.mjs).

| Capacidad                                  | Ejemplo / prueba                                                                            | Comando                     | Resultado esperado y límite                                                                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typers-nest build` y `buildNest(options)` | Perfiles Nest del [harness](../scripts/demonstrate-typers.mjs)                              | Demo                        | Compilador explícito, emisión nativa y Nest real con DI/metadata/HTTP; informa `success`, `emitSkipped`, diagnósticos, configuración, proyecto, compilador, emitidos y assets.                       |
| Selección y precedencia                    | Configuración raíz, proyecto y sobrescritura del perfil                                     | Demo                        | `project` selecciona `projects[name]`; propiedades sustituyen la raíz, arrays se reemplazan. `--path` > `tsConfigPath` > `builder.options.configPath` > `tsconfig.build.json` > `tsconfig.json`.     |
| Assets                                     | Archivos del perfil y verificaciones de bytes                                               | Demo                        | Strings, objetos `include`/`exclude`/`outDir`, patrones/directorios, ocultos y binarios; relativos a `sourceRoot`, destino relativo a `rootDir`. No ejecuta plugins GraphQL por copiar `.graphql`.   |
| Limpieza y preservación                    | Casos positivo y negativos del perfil                                                       | Demo                        | Con `deleteOutDir`, limpia el outDir del compilador después de validar; error de tipos, `noEmit` o validación previa conservan salida previa. Directorios alternativos no se limpian recursivamente. |
| Validación de rutas y configuraciones      | Casos negativos del harness; [helpers originales](../../typers/packages/nest/src/paths.mjs) | Demo                        | Rechaza escapes, symlinks, colisiones, solapamientos con entradas y configuraciones heredadas. No hay rollback de fallos IO ni soporte de escrituras concurrentes.                                   |
| Diagnósticos de incompatibilidad           | Casos negativos y [comparación original](typers-comparison.md)                              | Demo; `pnpm compare:typers` | Watch/assets, plugins, aliases, incremental/referencias y builders fuera del alcance permanecen rechazados. Un rechazo esperado conserva su error y diagnóstico.                                     |

La API acepta `cwd`, `project`, `config`, `path` y
`compilerPackage: "typescript" | "@typers/compiler"`. El CLI añade `--json`,
`--help` y `--version`. Busca `nest-cli.json` o `.nest-cli.json`; sin ellos usa
valores por defecto. Las rutas de Nest son relativas al cwd. Se aceptan builder
ausente/`tsc`/`typers`, pero todos usan la API nativa elegida. Requiere `outDir`
explícito y, con assets, `rootDir` explícito.

La tabla inventaría el contrato completo de configuración implementado; las 14
comprobaciones de esta demo acreditan el subconjunto que ejercita `run.mjs`:
selección raíz/proyecto con punto, sustitución de assets, selección efectiva de
`builder.options.configPath`, override explícito, emisión, HTTP, assets y los
rechazos enumerados. No convierten cada precedencia, fallback o combinación de
rutas en un caso ejecutado aquí. Los casos existentes del compilador en
[`config-assets.test.mjs`](../../typers/packages/nest/test/config-assets.test.mjs)
incluyen descubrimiento sin configuración, `.nest-cli.json` y preferencia de
`tsconfig.build.json`; su
[`test-nest-builder.mjs`](../../typers/tooling/test-nest-builder.mjs) añade el
consumidor bajo `typescript`, configuraciones alternativas y protección de
herencia transitiva. Esa evidencia pertenece a sus pruebas propias y no se suma
a los resultados de esta demo.

`buildNest` devuelve diagnóstico de compilación en su informe; configuración o IO
pueden lanzar. El CLI devuelve código 1 para error y código 0 para un `noEmit`
correcto. Ni `collection`, `entryFile` ni `generateOptions` añaden generación,
arranque o ejecución: esas propiedades pertenecen a otros comandos Nest.

## Qué sigue pendiente

- El comando original **`nest build` con Typers** sigue requiriendo la API clásica
  ausente (`createProgram`, `sys`, `getParsedCommandLineOfConfigFile`, etc.).
  `typers-nest build` es un comando explícito distinto.
- Reescritura nativa de aliases de módulos en JS/declaraciones/mapas y su contrato
  NodeNext/ESM. `paths` puede resolver tipos en TS estándar; eso no crea rutas de
  imports ejecutables. El adaptador rechaza `paths` no vacío.
- Plugins/transformadores de compilación, incluidos Swagger y GraphQL; watch,
  `--all`, incremental/composite/referencias en la API de emisión y el adaptador,
  builders alternativos y concurrencia del adaptador.
- `if let Ok`, patrones anidados/destructuring, `while let`, `let else`, `match`,
  propagación `?`, helpers de captura y generación de adaptadores.
- Integración de sintaxis nueva con Oxlint/Oxfmt, SWC, Babel, loaders, editores y
  AST público que conserve la sintaxis original. Un scanner exportado no añade
  ese soporte a otra herramienta.
- Distribución npm/releases, matriz multiplataforma, garantías completas de
  depuración y rendimiento/eficiencia de agentes medidos.

## Cómo pedir un cambio concreto

1. Abre el servicio/controlador correspondiente en `apps/typers/src` y las
   [pruebas de aplicación](../apps/typers/test/app.test.mjs). Para una operación
   de la API del compilador o un caso mínimo, usa su fixture específico.
2. Ejecuta `pnpm start:typers` para inspeccionar el flujo HTTP y
   `pnpm test:typers` para verificarlo; conserva el informe de build. Para los
   perfiles aislados usa `demo:typers` y su informe/directorio de ejecución.
   Comprueba versiones, hashes y configuración antes de interpretar el resultado.
3. Inspecciona el JavaScript emitido y sus declaraciones/mapas. En las rutas Nest,
   contrasta la respuesta HTTP y el asset con las aserciones del caso.
4. Modifica una entrada, una regla o un resultado esperado del ejemplo y vuelve
   a ejecutar. Un fallo inesperado debe hacer fallar el comando.
5. Al solicitar una mejora, indica capacidad, archivo, entrada, comportamiento
   actual y deseado. Los diagnósticos negativos también son resultados revisables.

Esta evidencia no convierte las 260 pruebas Vitest de referencia en pruebas
ejecutadas bajo Typers. Tampoco promueve los 1131 exports/2698 miembros del
[inventario Nest](nest-api-coverage.md) a verificados: sus 30 casos manuales
acreditan casos de 76 exports y 91 miembros bajo la referencia identificada.
Los servicios externos mantienen pruebas y requisitos separados.

La referencia local se comprobó al terminar la entrega inicial de perfiles:
`pnpm check` pasó tipos, lint, 109 unitarias, 131 e2e, build, 26 contratos Node y
matrices; `pnpm format:check` también pasó. Los logs se conservan en
`reports/typers-reference-check.log` y `reports/typers-format-check.log`.
Las 20 integraciones con servicios reales no se repitieron en esta entrega.
Regenerar el inventario solo actualizó sus fingerprints de configuración por la
exclusión de fixtures; mantiene 31 paquetes, 1131 exports, 2698 miembros y 30
casos manuales. No se han creado commits, push ni merge nuevos para esta entrega;
los cambios locales anteriores permanecen conservados para revisión.

## Continuidad del desarrollo

Por decisión explícita del usuario del 15 de septiembre de 2026, cada incremento
de Typers debe desarrollar, demostrar y validar aquí el comportamiento nuevo o
cambiado. Hay que actualizar este índice, ejemplos, comandos, casos negativos y
evidencia antes de presentar la entrega. Se conserva la referencia TypeScript
estándar. Las funciones que afecten a aplicaciones Nest se muestran primero en
`apps/typers`, con código de negocio y contratos HTTP; los perfiles explícitos
de fixtures siguen cubriendo semántica mínima, diagnósticos y API. Ambas capas
complementan las pruebas de componentes y regresión nativa del compilador.
