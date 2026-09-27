# Verificación de la referencia

## Aplicación NestJS que utiliza Typers

La aplicación de [apps/typers](../apps/typers/README.md) se ejecuta con
`pnpm start:typers`. Catálogo, presupuestos y reservas usan `@typers/core` e
`if let Some` dentro de servicios y controladores Nest. Se compila en su propio
`dist` mediante `@typers/nest` y ejecuta el JavaScript nativo con Node.

Verificación del 15 de septiembre de 2026:

- `pnpm test:typers`: build nativo y 13 pruebas Node aprobadas. Incluyen HTTP
  200/201/400/404/409, dinero BigInt, ausencia y valores cero/vacíos, stock,
  idempotencia, DI por metadata, Swagger, asset copiado y declaraciones/mapas.
- `pnpm typecheck:typers`: tipos comprobados por el compilador nativo. La ruta
  de instalación inicial con lockfile congelado se verificó también invocando
  el script desde pnpm en la raíz.
- `pnpm start:typers`: servidor real en 127.0.0.1:3014, redirección a Swagger,
  OpenAPI, catálogo, policy y reserva repetida sin descontar stock dos veces.
  La parada con SIGTERM cerró el puerto.
- `pnpm check`: tipos, lint, 109 unitarias, 131 e2e, build, 26 comprobaciones
  Node y matrices de la referencia aprobados tras añadir la aplicación.

Los paquetes Typers proceden de tarballs locales del commit `efe9894`, con
`compilerWorktreeDirty: false`; el arranque verifica sus archivos contra los
artefactos seleccionados. La aplicación tiene dependencias y lockfile propios.
El lockfile raíz conserva SHA-256
`f59aa36a3e724a8ef5b6aa415a324652890d3b749b7cd4cfb2317fbc23612fcd`.
El inventario de APIs mantiene 31 paquetes, 1131 exports, 2698 miembros y 30
casos manuales; esta app no incrementa automáticamente esa cobertura.

[Informe de la aplicación](typers-application-results.json). Logs locales:
`reports/typers-app-test.log`, `reports/typers-app-start-evidence.json` y
`reports/typers-app-reference-check.log`. Los datos de la app están en memoria
y se reinician con el proceso. Esta entrega no repite las 20 integraciones
externas ni amplía las capacidades del compilador.

## Referencia estándar e integraciones anteriores

Revisión local del 15 de septiembre de 2026. Entorno: macOS arm64, Node 24.20.0, pnpm 12.4.1, TypeScript 6.0.3 y NestJS 12.0.2. Las integraciones y la imagen se ejecutaron con Docker Desktop sobre Linux arm64.

| Comando / escenario                                 | Resultado                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `pnpm check`                                        | Typecheck, lint, 109 unit tests, 131 e2e, build y 26 comprobaciones ESM con Node                       |
| `pnpm format:check`                                 | Formato correcto                                                                                       |
| `pnpm coverage:check`                               | Conteos, identificadores y referencias del inventario coherentes                                       |
| `pnpm infra:up`                                     | Siete servicios disponibles; healthchecks reales para cada uno                                         |
| `pnpm test:integration`                             | 20 pruebas aprobadas de nuevo tras añadir los laboratorios avanzados                                   |
| `.env` + `pnpm migration:run` + `node dist/main.js` | Migración inicial, login y creación/lectura/eliminación HTTP de un proyecto en PostgreSQL              |
| `docker build -t typers-nestjs:demo .`              | Imagen construida desde instalación con lockfile congelado                                             |
| Contenedor en `NODE_ENV=production`                 | Healthcheck, Swagger, asset estático y JWT login/perfil; usuario `node`; TypeScript ausente en runtime |

El corpus contiene **260 pruebas Vitest en 31 archivos**. Pasaron las 109 unitarias, 131 e2e y las 20 integraciones con servicios reales. Las 26 comprobaciones del ESM emitido y las verificaciones manuales de comandos no se suman como tests Vitest. Los seis programas del laboratorio de lenguaje sí están incluidos en las pruebas e2e. La matriz conserva cada caso y su relación con los capítulos.

## Límites de esta evidencia

- La [comparación aislada con Typers](typers-comparison.md) acredita build/typecheck, 26 contratos Node por ruta y los perfiles de lenguaje. No acredita todas las pruebas Vitest ni las integraciones con servicios bajo Typers; conserva los rechazos de watchAssets/incremental del adaptador.
- Las pruebas locales de servicios alojados usan sus SDK reales y destinos controlados. No verifican cuentas de Observe, la interfaz alojada de Devtools ni un despliegue real en AWS/Mau.
- GitHub Actions está configurado, pero todavía no existe un resultado de ejecución remota de estos cambios.
- Throttler 6.5.0 y la dependencia de Commander `@golevelup/nestjs-discovery` 7.0.3 declaran peers anteriores a Nest 12. Los casos de esta demo pasan con las versiones fijadas.
- KafkaJS 2.2.4 emite `TimeoutNegativeWarning` con Node 24 durante el escenario reproducido. En arranque frío puede registrar una espera del coordinador de grupos y recuperarse. Nest registra la desconexión de Redis al cerrar el cliente. Las suites comprueban los resultados y el cierre; no se silencian esos mensajes.
- El cierre del SDK Observe 0.2.0 tiene la limitación de reinicio de worker descrita en [observabilidad](observability.md).
- HMR usa la receta antigua webpack/CommonJS en un workspace temporal. La referencia principal, SWC y Rspack conservan ESM. Ese caso no acredita HMR nativo de ESM.

Los informes temporales de la ejecución no se incorporan al repositorio. Los comandos anteriores, el lockfile, los fixtures y las aserciones permiten volver a producir los resultados.

## Ampliación de negocio y TypeScript

`pnpm typecheck` incluye los contratos positivos y negativos de `*.type-test.ts`. `pnpm test:business:emitted` añade diez comprobaciones nativas a las ocho del smoke original: BigInt, validación, grafo, generador asíncrono, JWT, metadata DI y gasto hasta el pago idempotente. Los reportes JSON de las suites quedan en `reports/`, ignorados por Git.

Se reconstruyó la imagen Docker con los nuevos módulos y se verificaron salud, login JWT y el presupuesto conocido de 71978 unidades mínimas dentro del contenedor en producción. El runtime conserva usuario `node`. Las identidades adicionales requieren contraseñas explícitas para habilitarse en producción.

## Ampliación de APIs y lenguaje

- DI avanzada: 14 e2e; providers durables, aislamiento de tenants/peticiones, LRU, INQUIRER, inyección opcional y mocks selectivos.
- Operaciones: 10 e2e; configuración tipada, reservas con expiración, scheduler dinámico y variantes de versionado.
- Lenguaje: seis e2e que compilan perfiles independientes y ejecutan Node; doce rechazos esperados de tipos. Incluyen augmentation, mixins, JSON import attributes, decoradores estándar, TSX y gestión explícita de recursos.
- `pnpm test:advanced:emitted`: ocho comprobaciones adicionales sobre esos módulos Nest compilados, incluyendo temporizadores reales y su limpieza.
- `pnpm api:check`: prueba del extractor y detección de cambios en exports, miembros, fuentes y evidencia. El checker no convierte referencias en pruebas automáticamente.

El inventario de APIs conserva un alcance explícito: exports raíz de dependencias Nest directas y `@nestjs/testing`, miembros declarados y casos manuales. No cierra las subsecciones del inventario documental ni acredita todas las variantes de cada API.

La imagen `typers-nestjs:demo` se reconstruyó también tras esta ampliación. Pasaron de nuevo salud, login JWT, presupuesto 71978 y usuario sin privilegios, además de la reserva/confirmación del módulo Operations y una cotización HTTP con provider durable dentro del contenedor.

## Demostración específica de Typers

La ejecución integrada del 15 de septiembre de 2026, iniciada a las 18:04:16 UTC,
terminó con código 0. El [informe versionado](typers-features-results.json)
conserva artefactos, hashes, fuentes, comandos, resultados y diagnósticos. El
[índice de funcionalidades](typers-features.md) enlaza cada capacidad con sus
fuentes, pruebas, resultados y guía de inspección manual.

| Ruta | Resultado observado |
| --- | --- |
| Runtime `@typers/core` | Compilación nativa y 11/11 pruebas Node; TypeScript oficial 6.0.3 comprueba también sus contratos. |
| Sintaxis experimental | Compilación nativa y 8/8 pruebas Node, incluidas DI, metadata y HTTP 201/400/404/409 de reservas. El adaptador vuelve a compilar las mismas fuentes y pasan de nuevo esas 8 pruebas. |
| Declaraciones estándar | TypeScript oficial consume las `.d.ts` emitidas desde el perfil experimental. |
| Negativos de sintaxis/tipos | Siete fixtures Typers producen los diagnósticos esperados y código 1. TypeScript oficial, sin el flag exclusivo de Typers en su configuración, rechaza `if-let` con TS1005/1128 y código 2. |
| API nativa | 36 contratos agrupados sync/async correctos; once subrutas cargadas y usadas, tipos públicos comprobados por CLI, JS capturado ejecutado con Node. Se conservan los rechazos de modos de emisión y del completado global que necesita auto-imports. |
| Adaptador Nest | 14 comprobaciones agrupadas correctas, incluidas 8 familias de rechazo con preservación; CLI/API emiten los mismos bytes y pasan HTTP, assets, metadata y DI. |

Las unidades de recuento son diferentes: 11 y 8 son pruebas `node:test`; esas 8
se repiten por otra ruta de compilación. Los 36 contratos API y las 14
comprobaciones de adaptador agrupan aserciones y rechazos. No se suman como una
suite homogénea ni como pruebas Vitest adicionales.

Reproducción desde la raíz:

```sh
pnpm demo:typers \
  --compiler ../typers/built/typers/typers-compiler-7.0.2-typers.0.tgz \
  --core ../typers/built/typers/typers-core-0.1.0-alpha.0.tgz \
  --nest ../typers/built/typers/typers-nest-0.1.0-alpha.0.tgz \
  --report reports/typers-features.json
```

Se puede añadir `--profile runtime|experimental|native-api|nest-adapter`
seleccionando un único nombre. `--prepare-only` conserva el consumidor e imprime
los comandos de inspección sin compilar. Los tarballs deben estar construidos
previamente y las dependencias del laboratorio instaladas con su lockfile.

La medición usa Node 24.20.0, macOS arm64 y el compilador actual procedente de
`efe9894778169f53a3a6a0d3d42e0efa4bae3d7f`, con
`compilerWorktreeDirty: false`. El índice detalla los SHA-256; el informe conserva
63 archivos del snapshot de fixtures y hashes de ambos scripts de coordinación.
Las fuentes se copian a un consumidor aislado y las dependencias fijadas se
enlazan por paquete. Al terminar, el TypeScript oficial 6.0.3 y el lockfile de
referencia conservaron sus hashes. No se cambió de compilador ante un fallo.

La comprobación final de la referencia pasó `pnpm check`: tipos, lint, 109
unitarias, 131 e2e, build, 26 contratos Node y las matrices. También pasó
`pnpm format:check`. Logs locales: `reports/typers-reference-check.log` y
`reports/typers-format-check.log`. Las 20 integraciones con servicios reales
no se repitieron en esta entrega; su evidencia anterior se mantiene separada.
El inventario conserva 31 paquetes, 1131 exports, 2698 miembros y 30 casos
manuales: solo cambian sus fingerprints por la exclusión de los nuevos fixtures
del tsconfig raíz.

El informe específico de Typers se versiona para revisión; stdout/stderr
completos y salidas permanecen en su `runDirectory` local. Los rechazos previstos
mantienen `status: "failed"` y solo cumplen el gate al coincidir con su contrato.
Esta entrega no acredita todas las APIs de Nest, integraciones con BD/brokers
bajo Typers, API clásica, plugins, aliases o editor. La selección/configuración
del adaptador demostrada es un subconjunto explícito de su contrato; las pruebas
de componentes del repositorio del compilador complementan esa evidencia.
