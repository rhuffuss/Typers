# Aplicación NestJS escrita con Typers

Esta es una aplicación de catálogo, presupuestos y reservas: módulos Nest,
controladores HTTP, servicios de negocio y repositorios en memoria. Su código
vive en `apps/typers/src` y se compila con el compilador nativo de Typers mediante
su adaptador Nest. El servidor ejecuta el JavaScript emitido.
Su `package.json` propio declara `@typers/core`, `@typers/compiler` y
`@typers/nest` desde los tarballs locales del repositorio hermano. No tiene una
dependencia directa de `typescript` ni usa el compilador de referencia para
compilar estas fuentes.

## Arrancar e inspeccionar

Desde la raíz de `typers-nestjs`:

```sh
pnpm start:typers
```

El script prepara las dependencias de esta app si faltan, compila y arranca el
servidor. Abre [Swagger](http://127.0.0.1:3014/docs)
para enviar peticiones; el [documento OpenAPI](http://127.0.0.1:3014/openapi.json)
contiene sus esquemas. No requiere Docker, base de datos, login ni credenciales.
Escucha en `127.0.0.1:3014`. Puedes elegir otro puerto con
`PORT=3015 pnpm start:typers`. Ctrl+C cierra Nest.

En WebStorm, crea una configuración de tipo **npm**, selecciona el gestor **pnpm**,
el `package.json` raíz, el comando **run** y el script **start:typers**.
También puedes ejecutar las peticiones de [requests.http](requests.http)
directamente desde el cliente HTTP del IDE.

### Comandos de desarrollo

Todos se ejecutan desde la raíz de `typers-nestjs`:

| Comando                 | Acción                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `pnpm start:typers`     | Compila con el adaptador nativo y arranca `dist/main.js`.                               |
| `pnpm build:typers`     | Emite JavaScript, declaraciones, mapas y assets en `apps/typers/dist`.                  |
| `pnpm typecheck:typers` | Comprueba tipos con el CLI Typers y `--noEmit`.                                         |
| `pnpm test:typers`      | Compila y ejecuta las pruebas Node contra la aplicación emitida.                        |
| `pnpm typers:refresh`   | Reinstala los tarballs locales y actualiza el lock de la app después de reconstruirlos. |

El [script de coordinación](../../scripts/typers-app.mjs) identifica los tres
tarballs por SHA-256 y compara los archivos instalados con su contenido. Si
cambian los artefactos o dependencias de la app, pide `typers:refresh`. Cada
build correcto genera `apps/typers/reports/build.json` con la identidad del
compilador, los paquetes y las fuentes. Esto describe el build; los resultados
de las pruebas corresponden a la ejecución concreta de `test:typers`.

### Preparación en un checkout nuevo o si faltan tarballs

La raíz de `typers-nestjs` debe tener sus dependencias instaladas con
`pnpm install --frozen-lockfile`. La app tiene su propio `package.json`,
`pnpm-lock.yaml`, `pnpm-workspace.yaml` y `node_modules`: los comandos anteriores
instalan sus dependencias de forma independiente y comprueban que el lock y
el TypeScript de la referencia raíz se conservan.

Se esperan estos archivos del repositorio hermano `typers`:

- `built/typers/typers-compiler-7.0.2-typers.0.tgz`
- `built/typers/typers-core-0.1.0-alpha.0.tgz`
- `built/typers/typers-nest-0.1.0-alpha.0.tgz`

Si faltan o has modificado el compilador/runtime/adaptador, constrúyelos desde
**la raíz de `typers`**, con Node 24, npm y el toolchain Go del repositorio
(la guía actual usa Go 1.27):

```sh
npm --prefix tsc ci --ignore-scripts --no-audit --no-fund
node tooling/build-compiler.mjs
npm pack ./packages/compiler --pack-destination ./built/typers
npm pack ./packages/core --pack-destination ./built/typers
npm pack ./packages/nest --pack-destination ./built/typers
```

Estos son los scripts reales del repositorio del compilador: `build-compiler.mjs`
construye el binario y la API nativa; el `prepack` de `packages/core` compila el
runtime con ese binario. Los paquetes no están publicados en npm. El compilador
incluye un binario para la plataforma de construcción. Consulta también la
[guía del compilador](../../../typers/docs/typers/getting-started.md).

Vuelve a **la raíz de `typers-nestjs`** y ejecuta:

```sh
pnpm typers:refresh
pnpm start:typers
```

## Código que conviene leer, en este orden

| Archivo                                                                                | Qué aporta a la aplicación                                                                                                       |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [quotes/quotes.service.ts](src/quotes/quotes.service.ts)                               | Presupuesto con `Result`, propagación de errores, cupón opcional y dinero BigInt.                                                |
| [quotes/quote-input.ts](src/quotes/quote-input.ts)                                     | Convierte JSON desconocido a datos validados: `Err` ante entrada inválida y `Some`/`None`/`fromNullable` para campos opcionales. |
| [reservations/reservations.service.ts](src/reservations/reservations.service.ts)       | Coordina validación, presupuesto, stock e idempotencia sin excepciones HTTP.                                                     |
| [catalog/catalog.repository.ts](src/catalog/catalog.repository.ts)                     | `Option` expresa producto encontrado o ausente; `Result` expresa si puede descontarse stock.                                     |
| [catalog/catalog.controller.ts](src/catalog/catalog.controller.ts)                     | `if let Some(product)` extrae el producto; la rama `else` responde 404.                                                          |
| [reservations/reservations.controller.ts](src/reservations/reservations.controller.ts) | Entrega el resultado del servicio y consulta reservas con `if let Some`.                                                         |
| [http/domain-result.ts](src/http/domain-result.ts)                                     | Traduce `Result.Ok` a respuesta HTTP y cada error tipado a 400, 404 o 409.                                                       |
| [http/api-contracts.ts](src/http/api-contracts.ts)                                     | Swagger explícito para descubrir y ejecutar la API, sin plugin de compilación.                                                   |
| [app.module.ts](src/app.module.ts), [bootstrap.ts](src/bootstrap.ts)                   | Módulos, DI real de Nest, OpenAPI y ciclo de vida.                                                                               |
| [assets/policy.json](src/assets/policy.json)                                           | Asset copiado por el adaptador; `/api/policy` lo lee desde el directorio emitido.                                                |

`Result`, `Option`, `Ok`, `Err`, `Some`, `None` y `fromNullable` proceden del
paquete real `@typers/core`. `if let Some` es sintaxis experimental de Typers y
requiere `experimentalTypersSyntax` en la configuración. La inyección por
constructor usa los metadatos emitidos por Typers.

La CLI y el adaptador aparecen en el proceso de build y la configuración. Los
consumidores programáticos sync/async, scanner, checker y `typersEmitProject`
son herramientas de desarrollo del compilador: sus ejemplos completos siguen
en el [consumidor de API nativa](../../fixtures/typers/native-api/run.mjs).

## Recorrido manual

1. `GET /api/products`: `WIDGET` cuesta `1001` céntimos y tiene cuatro unidades;
   `EMPTY` cuesta `500` y tiene cero unidades. Cero stock no significa ausencia.
2. `POST /api/quotes` con `{"sku":"WIDGET","quantity":2,"coupon":"SAVE10"}`:
   subtotal `2002`, descuento `200`, total `1802`. El cálculo usa BigInt; HTTP
   representa los importes como strings. Crear un presupuesto no descuenta stock.
3. Compara el cupón `ZERO` con omitir `coupon`: el primero conserva un descuento
   presente de `0`; el segundo es ausencia y devuelve `discountPercent: null`.
4. `POST /api/reservations` con
   `{"sku":"WIDGET","quantity":2,"idempotencyKey":"order-demo-1"}`:
   crea una reserva y deja dos unidades disponibles. Repetir exactamente la
   petición devuelve la misma reserva. Cambiar la cantidad con la misma clave
   produce 409 y no modifica el stock.
5. Consulta `GET /api/reservations/reservation-1`. Un identificador inexistente
   produce 404. Reservar `EMPTY` produce 409; `quantity: 0` produce 400.

## Comprobaciones y límites

```sh
pnpm test:typers
```

Las pruebas abren un puerto efímero, ejercitan HTTP y cierran la aplicación.
Se ejecutan con Node sobre JavaScript emitido por Typers.

La [verificación de esta entrega](../../docs/typers-application-results.json)
registra **13 pruebas Node aprobadas**, además del arranque del servidor en
3014, acceso real a Swagger/API y cierre con SIGTERM. Incluye inventario,
presupuestos, ausencia frente a cero, entradas inválidas, stock, idempotencia,
metadatos de DI, runtime instalado, OpenAPI, assets y salida JS/declaraciones.
No añade esas pruebas a los recuentos históricos de Vitest o de fixtures.

Los datos son locales a una instancia y se reinician al arrancar; no hay pagos,
autenticación ni persistencia. La idempotencia conserva su historial solamente
durante la vida del proceso. `start:typers` realiza un build y un arranque;
después de editar, detén el proceso y vuelve a ejecutarlo. La sintaxis experimental
puede aparecer como error en el parser de WebStorm; no se configura aquí un
plugin de lenguaje para el IDE. Aliases, `match`, `?` y plugins de compilación
siguen fuera de las capacidades demostradas.

La carpeta `fixtures/typers` conserva casos pequeños para comprobar el compilador
de forma aislada. Esta carpeta `apps/typers` contiene la aplicación que puedes
ejecutar y modificar como proyecto NestJS. La referencia TypeScript estándar
permanece en la carpeta `src` raíz.
