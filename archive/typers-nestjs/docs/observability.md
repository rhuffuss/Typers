# Observability y Devtools

Este laboratorio usa `@nestjs/observe` **0.2.0**, el SDK real y su worker de envío. Es independiente de la aplicación principal: importar `AppModule` o arrancar la demo REST no activa telemetría externa.

## Verificación local

```sh
pnpm exec vitest run --config vitest.config.e2e.ts test/observability.e2e-spec.ts
```

La suite compila únicamente `src/observability` con `tsconfig.lab.json` a `dist-observe`. Arranca un proceso Node con aplicaciones Nest reales y un collector HTTP de prueba en `127.0.0.1` con puerto aleatorio. El SDK envía lotes gzip reales a `/applications/telemetry`, con credenciales ficticias `local-test-key` / `local-test-secret`. El collector recibe y conserva esos lotes en memoria durante el test; no es una implementación del backend de Observe.

La fixture rechaza collectors cuyo hostname no sea `127.0.0.1`. Las llamadas downstream también apuntan al servidor local del test. No se usa una cuenta de Observe ni se envían datos a servicios externos.

| Caso                   | API ejercitada                                                                      | Evidencia comprobada                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Integración SDK        | `createObserveModule`, `ObserveModule.forRootAsync`, `NestFactory` con `instrument` | Peticiones reales generan lotes de telemetría                                           |
| Instrumentación manual | `TracerService.createSpan`, `activeSpan`, `setTag`, `addTags`                       | Spans automáticos de servicios y spans `lab.compute` / `lab.sum` anidados               |
| Contexto               | `setAttribute`, `getAttribute`, `currentTraceId`                                    | Atributos, claves anidadas y trace ID conservados durante la petición                   |
| HTTP distribuido       | Cabecera `x-request-id`, `fetch`                                                    | El servidor downstream recibe el trace ID entrante                                      |
| Métricas propias       | `counter.increment`, `gauge.increment/decrement`, `summary.observe`                 | Valores reales en el lote recibido, incluyendo cero en gauge y observaciones de summary |
| Errores                | `captureError` y excepción no capturada                                             | Detalles del error asociado a la traza, con respuesta HTTP 500 cuando corresponde       |
| Logs y URL             | `Logger`, `forwardLogs`, `redaction`                                                | Mensajes correlacionados y secretos ficticios enmascarados antes del ingest             |
| Runtime                | `runtimeMetrics`                                                                    | Lote con una muestra real de recursos del proceso                                       |
| Exclusión              | `http.ignore`                                                                       | `/observe/health` no genera una traza                                                   |
| Devtools               | `snapshot`, `SerializedGraph`, `ModulesContainer`, `GraphInspector`                 | Grafo serializable con nodos, aristas y entrypoints reales                              |

El intervalo mínimo efectivo de métricas runtime en esta versión del SDK es **30 segundos**. La suite tarda aproximadamente 32 segundos; espera hasta 35 segundos para esa muestra y utiliza tiempos acotados para compilar, arrancar y cerrar el proceso. Los nombres de métricas y sus labels son constantes, evitando crear una serie por usuario o petición.

La versión 0.2.0 emite los valores de métricas como mapas por label (`v`, `ct`, etc.). Las aserciones describen el formato efectivamente recibido. El collector de prueba acepta los lotes para inspeccionarlos; eso no verifica la validación, almacenamiento ni facturación del backend SaaS.

## Demo opcional conectada a Observe

```sh
pnpm exec tsc -p src/observability/tsconfig.lab.json
# Define OBSERVE_APP_KEY y OBSERVE_APP_SECRET fuera del repositorio.
node --env-file-if-exists=.env dist-observe/main.observe.js
```

Este comando exige ambas credenciales antes de crear la aplicación. Usa `OBSERVE_ENDPOINT` si está configurado; en caso contrario utiliza el endpoint oficial `https://observe-api.nestjs.com`. Solo este comando opcional activa el envío a ese servicio. `OBSERVE_SERVICE_ID`, `OBSERVE_SERVICE_VERSION`, `OBSERVE_PORT` y `OBSERVE_UPSTREAM_URL` permiten configurar identidad, versión, puerto y destino downstream. El servidor de demo escucha en `127.0.0.1:3020` por defecto.

`sourceContext: false` desactiva el envío de fragmentos de código fuente. El SDK recibe `tracesSampleRate: 1`, logs con redacción y tags estáticos del laboratorio. Sus credenciales deben pertenecer al proyecto de Observe que el usuario quiera utilizar.

| Ruta GET                 | Resultado                                                           |
| ------------------------ | ------------------------------------------------------------------- |
| `/observe/work`          | Calcula `6`, crea spans y registra las tres métricas propias        |
| `/observe/downstream`    | Propaga `x-request-id` al destino configurado; 400 si falta destino |
| `/observe/handled-error` | Registra un error manejado y responde 200                           |
| `/observe/error`         | Genera un error instrumentado y responde 500                        |
| `/observe/log`           | Emite un log con secretos ficticios para demostrar redacción        |
| `/observe/health`        | Responde 200, excluida de las trazas                                |

Ejemplo: `curl -H 'x-request-id: manual-demo-1' http://127.0.0.1:3020/observe/work`.

## Cierre del SDK 0.2.0

Se ha reproducido localmente un defecto de cierre en 0.2.0: el SDK llama a `worker.terminate()` durante `onApplicationShutdown`, pero su manejador de salida reinicia el worker cuando recibe código 1, también durante ese cierre. La sonda real registró el mensaje de reinicio y una segunda inicialización del worker tras `app.close()`. La fixture conserva `app.close()` y registra el reinicio si aparece en stdout/stderr. Después finaliza explícitamente su proceso, con límite de cuatro segundos; el test comprueba tanto el mensaje de cierre de las aplicaciones como la salida del proceso.

Esto **no constituye un cierre limpio garantizado por el SDK**: el aislamiento impide que un worker reiniciado mantenga viva la suite. El comando opcional aplica la misma salida explícita tras `app.close()`. Tampoco se presupone que el último lote pendiente se vacíe al cerrar: los tests esperan que llegue al collector antes de terminar. Esta limitación debe revisarse al actualizar `@nestjs/observe`.

## Grafo y Devtools

```sh
pnpm exec tsc -p src/observability/tsconfig.lab.json
node dist-observe/main.devtools.js
```

El servidor de ejemplo escucha en `127.0.0.1:3021`. `/devtools/graph` devuelve el `SerializedGraph` original producido por Nest con `snapshot: true`, incluidos los entrypoints. `/devtools/inspect` reconstruye una vista estructural utilizando las APIs exportadas `NestContainer`, `GraphInspector.inspectModules` e `inspectInstanceWrapper` sobre el `ModulesContainer` real. No se accede a propiedades privadas de la aplicación.

`DevtoolsModule` se registra con su servidor de introspección desactivado por defecto. `DEVTOOLS_HTTP=1` permite activarlo explícitamente en el puerto `DEVTOOLS_PORT` (8000 por defecto). El servidor propio de ese paquete escucha en todas las interfaces y ofrece funciones de Playground: utilízalo únicamente en un entorno local de desarrollo de confianza. El laboratorio rechaza `NODE_ENV=production`.

## Alcance pendiente de servicios alojados

El SDK local, su transporte HTTP, errores, logs, métricas, trazas y grafo se verifican automáticamente. No se han verificado con una cuenta real el dashboard de Observe, vistas analíticas, alertas, releases, profiler alojado, límites del plan, integración MCP ni la interfaz web de Devtools. La propagación demostrada es HTTP; gRPC y RPC necesitan adaptar el canal de transporte. La documentación actual indica que los jobs BullMQ comienzan una traza propia y pueden conservar la traza de origen como tag.

## Documentación oficial

- [Observe: SDK](https://docs.nestjs.com/observability/sdk)
- [Instrumentación manual](https://docs.nestjs.com/observability/manual-instrumentation)
- [Trazas distribuidas](https://docs.nestjs.com/observability/distributed-tracing)
- [Dashboard de Observe](https://docs.nestjs.com/observability/dashboard)
- [MCP de Observe](https://docs.nestjs.com/observability/mcp-server)
- [Devtools](https://docs.nestjs.com/devtools/overview)
