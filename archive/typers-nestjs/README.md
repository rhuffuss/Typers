# Typers × NestJS

Aplicación de demostración y laboratorios ejecutables para probar Typers contra NestJS. Generada con **Nest CLI
12.0.1**, usa **NestJS 12.0.2, pnpm 12.4.1, ESM y Vitest 4.1.11**. El build de referencia utiliza TypeScript oficial
6.0.3. Node probado: **24.20.0**.

**Para ver una app NestJS usando las nuevas funciones de Typers, abre
[`apps/typers`](apps/typers/README.md) y ejecuta `pnpm start:typers`.**

La aplicación principal usa Express y ofrece usuarios, proyectos y tareas con PostgreSQL/TypeORM. Los flujos de negocio
añaden presupuestos comerciales, planificación de entregas y aprobación de gastos con roles separados. Los laboratorios
amplían los casos del compilador: inyección y metadatos, GraphQL, otros ORM, WebSockets, microservicios, colas,
compiladores, observabilidad y despliegue.

La [matriz de documentación](docs/nest-coverage.md) registra cada capítulo, fuentes, implementación, pruebas y límites.
**Un caso verificado por capítulo no significa que todas sus APIs, opciones o combinaciones estén cubiertas.** Los
servicios alojados conservan sus requisitos de cuenta. La compatibilidad con Typers se mide por ruta;
consulta [la comparación ejecutada y sus límites](docs/typers.md).

## Arrancar la aplicación NestJS escrita con Typers

El código de la aplicación está en **[`apps/typers/src`](apps/typers/src)**:
catálogo, presupuestos y reservas con módulos, controladores, servicios y
repositorios NestJS. Usa `@typers/core` y `if let Some` en sus flujos de negocio.

```sh
pnpm start:typers
```

Abre [Swagger](http://127.0.0.1:3014/docs). El comando compila con Typers y
arranca Nest en memoria, sin Docker ni credenciales. Para WebStorm: configuración
**npm**, gestor **pnpm**, `package.json` raíz, comando **run**, script
**start:typers**. Las [peticiones HTTP](apps/typers/requests.http) están preparadas
para ejecutarlas también desde el IDE.

| Capacidad aplicada                                                                     | Archivo que debes mirar                                                                                                                                     |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Result`, `Ok`, `Err`: presupuesto válido o error de negocio                           | [quotes.service.ts](apps/typers/src/quotes/quotes.service.ts)                                                                                               |
| `Option`, `Some`, `None`, `fromNullable`: cupón y nota opcionales; validación del JSON | [quote-input.ts](apps/typers/src/quotes/quote-input.ts)                                                                                                     |
| `if let Some`: stock presente, ausencia y repetición idempotente                       | [reservations.service.ts](apps/typers/src/reservations/reservations.service.ts)                                                                             |
| `Option` al consultar productos y `Result` al reservar stock                           | [catalog.repository.ts](apps/typers/src/catalog/catalog.repository.ts)                                                                                      |
| Resultado tipado convertido a respuestas HTTP 200/201/400/404/409                      | [domain-result.ts](apps/typers/src/http/domain-result.ts), [controladores](apps/typers/src/reservations/reservations.controller.ts)                         |
| Build nativo, metadatos Nest y copia de assets                                         | [nest-cli.json](apps/typers/nest-cli.json), [bootstrap.ts](apps/typers/src/bootstrap.ts), [policy.controller.ts](apps/typers/src/http/policy.controller.ts) |

Comandos desde la raíz:

```sh
pnpm build:typers       # Emite apps/typers/dist y copia assets.
pnpm typecheck:typers   # Comprueba las fuentes con Typers sin emitir.
pnpm test:typers        # Compila y ejecuta pruebas HTTP con Node sobre dist.
pnpm typers:refresh     # Actualiza paquetes/lock de la app al cambiar los tarballs.
```

La app tiene `package.json`, dependencias y lockfile propios. La carpeta `src`
raíz y su TypeScript oficial siguen siendo la referencia. Consulta la
[guía de la aplicación](apps/typers/README.md) para preparar los tarballs locales
si faltan, recorrer la API y conocer límites. WebStorm todavía puede señalar
`if let` como sintaxis inválida: instalar Typers no adapta el parser del IDE.

La [evidencia de esta aplicación](docs/typers-application-results.json) registra
13 pruebas Node aprobadas sobre emisión Typers y arranque HTTP real. Los
resultados anteriores de fixtures y referencia se conservan por separado.

### Casos aislados del compilador

`fixtures` significa aquí **casos de prueba pequeños y controlados**. Se conservan
para detectar fallos concretos y probar la API del compilador; la aplicación que
debes abrir para ver un desarrollo NestJS está en `apps/typers`. La
[guía de funcionalidades](docs/typers-features.md) enlaza ambas capas y mantiene
la evidencia de las comprobaciones anteriores.

- [Presupuestos con Result/Option](fixtures/typers/runtime/src/budget.ts): BigInt,
  validación, errores tipados y diferencia entre cero y ausencia.
- [Reservas HTTP con if-let](fixtures/typers/experimental/src/nest-app.ts): DI,
  éxito 201, ausencia 404, stock insuficiente 409 y entrada inválida 400.
- [API del compilador](fixtures/typers/native-api/run.mjs): consultas, snapshots
  y emisión de JavaScript/declaraciones/mapas en memoria.
- [Adaptador](fixtures/typers/nest-adapter/run.mjs): CLI/API, configuración,
  assets y conservación de salidas ante errores.

Con los tres tarballs construidos en el repositorio hermano:

```sh
pnpm demo:typers \
  --compiler ../typers/built/typers/typers-compiler-7.0.2-typers.0.tgz \
  --core ../typers/built/typers/typers-core-0.1.0-alpha.0.tgz \
  --nest ../typers/built/typers/typers-nest-0.1.0-alpha.0.tgz
```

`demo:typers` conserva un consumidor temporal con las fuentes, salida y
diagnósticos completos; imprime su ruta para inspeccionarlo. `--profile runtime`,
`experimental`, `native-api` o `nest-adapter` selecciona una parte.
`--prepare-only` prepara el consumidor y muestra comandos manuales. La aplicación
principal conserva TypeScript oficial; los perfiles Typers están aislados.

## Aplicación de referencia: arranque con PostgreSQL

Requisitos: Node 24, pnpm 12 y Docker Compose. Desde la raíz del repositorio:

```sh
pnpm install --frozen-lockfile
cp .env.example .env
docker compose --profile postgres up -d --wait
pnpm build
pnpm migration:run
pnpm start:prod
```

Abre [Swagger](http://127.0.0.1:3000/docs), [GraphQL](http://127.0.0.1:3000/graphql)
o [salud](http://127.0.0.1:3000/api/v1/health). OpenAPI está en `/openapi.json`. REST usa `/api/v1`; el ejemplo de
versionado también expone `/api/v2/techniques/version`.

PostgreSQL empieza sin proyectos. Haz login y crea uno desde Swagger. Las migraciones son explícitas; `synchronize` y
`migrationsRun` están desactivados. `pnpm migration:revert` elimina las tablas de la migración inicial y sus datos:
úsalo solo cuando quieras revertir ese laboratorio.

### Prueba rápida sin servicios externos

```sh
pnpm install --frozen-lockfile
pnpm build
DEMO_DATABASE=memory pnpm start:prod
```

La variante en memoria incluye un proyecto inicial y pierde cambios al reiniciar. La variable de shell tiene prioridad
sobre `.env`. En desarrollo: `pnpm start:dev` después del primer `pnpm build`.

### Cuentas de demostración

| Rol                     | Email                 | Contraseña local          |
| ----------------------- | --------------------- | ------------------------- |
| Administrador y miembro | `admin@typers.local`  | `TypersDemo-Admin-2026!`  |
| Lector                  | `reader@typers.local` | `TypersDemo-Reader-2026!` |

```sh
curl -s http://127.0.0.1:3000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@typers.local","password":"TypersDemo-Admin-2026!"}'
```

Usa `access_token` en **Authorize** de Swagger. Las lecturas de proyectos son públicas; las escrituras requieren
roles. [Contratos REST](src/workspaces/README.md) · [Autenticación y autorización](src/security/README.md).

## Laboratorios

Las pruebas crean aplicaciones, hacen peticiones reales y cierran sus recursos. Las alternativas se aíslan para poder
reproducir un fallo del compilador sin arrancar toda la infraestructura.

| Área                       | Casos incluidos                                                                                                                                        | Guía                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Overview / Fundamentals    | Controllers, providers, módulos, middleware, guards, pipes, filtros, interceptors, scopes, lifecycle, DI circular, módulos dinámicos y lazy, discovery | [Fundamentals](src/fundamentals/README.md), [HTTP](docs/http-lab.md)       |
| REST / Security            | CRUD, DTOs, mapped types, JWT/Passport, roles, scrypt, AES-GCM, Helmet, CORS, CSRF y límite de peticiones                                              | [Workspaces](src/workspaces/README.md), [Security](src/security/README.md) |
| Techniques                 | Configuración, caché, CQRS, eventos, scheduling, ALS, HTTP client, Standard Schema/Zod, uploads, streaming, SSE, raw body, MVC, cookies y sesiones     | [Técnicas](docs/techniques.md)                                             |
| Persistencia               | PostgreSQL/TypeORM con migraciones y transacciones; Mongoose, Sequelize, MikroORM y Prisma                                                             | [Alternativas](docs/persistence-labs.md)                                   |
| GraphQL                    | Apollo code first, Mercurius schema first, suscripciones, federation, tipos avanzados, plugins, SDL y generación de definiciones                       | [GraphQL](docs/graphql.md)                                                 |
| WebSockets / Microservices | Socket.IO, ws, TCP, Redis, MQTT, NATS, RabbitMQ, Kafka, gRPC, transporte propio y aplicación híbrida                                                   | [Mensajería](docs/messaging.md)                                            |
| Colas                      | BullMQ: producer, worker, progreso, reintentos, eventos y flow padre/hijo                                                                              | [Prueba Redis](test/integration/queues.integration-spec.ts)                |
| CLI / Recipes              | SWC ESM, Rspack con dos aplicaciones y biblioteca, aliases, generación CRUD, watch, HMR, standalone, Commander y REPL                                  | [Tooling](docs/tooling.md)                                                 |
| OpenAPI                    | Documento principal, bearer auth, DTOs, respuestas; plugin CLI real, inferencia, mapped/generic types y API key                                        | [OpenAPI](docs/openapi.md), [plugin CLI](test/openapi-plugin.e2e-spec.ts)  |
| Fastify                    | HTTP, validación, JWT y multipart con plugins nativos                                                                                                  | [Fixture](src/platform/fastify-lab.ts), [prueba](test/fastify.e2e-spec.ts) |
| Observability / Devtools   | SDK Observe real con collector local, spans, métricas, logs, errores, propagación HTTP y grafo Nest                                                    | [Observabilidad](docs/observability.md)                                    |
| Deployment / FAQ           | Docker, Lambda con evento API Gateway local, HTTP+HTTPS, keep-alive y errores DI                                                                       | [Deployment](docs/deployment-lab.md), [HTTP](docs/http-lab.md)             |

## Auditoría de APIs y laboratorios avanzados

La [matriz de APIs por versión](docs/nest-api-coverage.md) inventaría los exports raíz y miembros públicos declarados de
los paquetes Nest instalados. Distingue referencias en el código de casos con evidencia explícita. `pnpm api:inventory`
regenera el inventario; `pnpm api:check` detecta cambios y comprueba el extractor. Los subpaths, overloads y
combinaciones pendientes conservan sus límites.

| Laboratorio                                  | Casos añadidos                                                                                     | Ejecución                                       |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [DI avanzada](docs/fundamentals-advanced.md) | Tenants durables, petición aislada, LRU, INQUIRER, inyección opcional/por propiedad y useMocker    | `pnpm start:di` después del build; puerto 3008  |
| [Operaciones](docs/operations-lab.md)        | Reservas de inventario, configuración tipada, cron/intervalos/timeouts dinámicos y versiones HTTP  | `pnpm start:operations`; Swagger en puerto 3007 |
| [Lenguaje](docs/language-lab.md)             | Module augmentation, mixins, JSON import attributes, decoradores estándar, TSX y using/await using | `pnpm test:language` o `pnpm language:prepare`  |

Los dos servidores alternativos escuchan en loopback. Sus datos están en memoria y sus contratos se verifican también
sobre JavaScript emitido: `pnpm test:advanced:emitted` añade ocho comprobaciones con Node.

## Lógica de negocio y variedad TypeScript

[Flujos y ejemplos HTTP](docs/business.md) · [Mapa de estilos y tipos](docs/typescript-patterns.md).

- Presupuestos: composición funcional, dinero BigInt tipado por moneda, descuentos, reparto y validación.
- Planificación: dependencias, capacidad diaria, costes, plazos y generadores de reportes/lotes cancelables.
- Gastos: agregado OOP, estados tipados, quórum por importe, auditoría, control de versión y pagos simulados
  idempotentes.

`pnpm test:business`, `pnpm typecheck:business` y `pnpm test:business:emitted` verifican comportamiento, contratos
positivos/negativos de tipos y ejecución ESM. Las cuentas miembro, aprobador y finanzas se describen en la guía de
negocio.

## Verificación

```sh
pnpm check              # Prisma, tipos, lint, unit, e2e, build, Node ESM y matrices
pnpm format:check
pnpm infra:up           # los siete servicios locales
pnpm test:integration   # 20 pruebas reales; activa todos los perfiles de test
pnpm infra:down         # conserva el volumen PostgreSQL
```

`pnpm check` no necesita Docker ni cuentas externas. Sus pruebas fuerzan memoria cuando corresponde, aunque exista
`.env`. Observabilidad espera una muestra real del SDK y tarda unos 32 segundos. Tooling ejecuta el CLI y Node en
directorios temporales. Las integraciones crean esquemas, bases, colas o tópicos propios y los limpian al terminar.

Comandos individuales:

```sh
pnpm generate:prisma                 # antes de typecheck/test en checkout nuevo
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm test:emitted                    # requiere build; ocho contratos sobre dist con Node
pnpm coverage:check                 # coherencia de la matriz documental
pnpm api:check                      # extractor y vigencia del inventario de APIs
pnpm compiler:report                # versiones y rutas de los compiladores instalados
pnpm exec vitest run --config vitest.config.e2e.ts test/graphql.e2e-spec.ts
```

GitHub Actions ejecuta la referencia y las integraciones con Compose. [ci.yml](.github/workflows/ci.yml) está preparado;
la ejecución remota requiere subir estos archivos.

El corpus registra **260 pruebas Vitest en 31 archivos**: 109 unitarias, 131 e2e y 20 integraciones, todas aprobadas en
esta revisión. También pasan **26 comprobaciones ESM con Node** sobre el build principal. Los seis escenarios de
lenguaje ya están incluidos en el conteo e2e. [Detalle de verificación y límites](docs/validation.md).

## Perfiles Docker Compose

| Perfil             | Servicio(s)                         | Puerto en `127.0.0.1` |
| ------------------ | ----------------------------------- | --------------------- |
| `postgres`         | PostgreSQL                          | 55432                 |
| `mongo`            | MongoDB                             | 57017                 |
| `redis` / `queues` | Redis                               | 56379                 |
| `mqtt`             | Mosquitto                           | 51883                 |
| `nats`             | NATS                                | 54222                 |
| `rabbitmq`         | RabbitMQ                            | 56720                 |
| `kafka`            | Kafka                               | 59092                 |
| `databases`        | PostgreSQL y MongoDB                | Los anteriores        |
| `brokers`          | Redis, MQTT, NATS, RabbitMQ y Kafka | Los anteriores        |
| `all`              | Todos                               | Los anteriores        |

Ejemplo: `docker compose --profile redis up -d --wait`. Para pruebas individuales y variables que cambian los destinos,
consulta persistencia y mensajería. `pnpm test:integration` usa estos puertos y acepta variables de entorno. Las
imágenes están fijadas por digest. MongoDB 7.0.43 evita la incompatibilidad de MongoDB 8 con el kernel del Docker de
este equipo; el motivo figura en Compose.

## Entrypoints alternativos

```sh
pnpm build
pnpm start:fastify              # puerto 3001
pnpm start:graphql:schema       # Mercurius; consulta su guía
pnpm start:graphql:federation   # dos subgrafos y gateway
pnpm standalone
pnpm commander projects --limit 2
pnpm repl                      # get(WorkspacesService), .exit
pnpm build:swagger             # dist-swagger
pnpm build:graphql             # dist-graphql-plugin
pnpm build:swc
pnpm start:swc --watch
pnpm build:rspack               # workspace temporal; imprime ubicación y limpieza
pnpm build:observe
pnpm start:devtools             # grafo local; introspección opt-in
```

Cada proceso HTTP se ejecuta en su terminal y se cierra con Ctrl+C. `pnpm start:observe` requiere credenciales reales y
envía telemetría al endpoint configurado; las pruebas no lo hacen. `pnpm start:tls` requiere `TLS_KEY_PATH` y
`TLS_CERT_PATH`. Sus guías describen las variables y los límites verificados.

## Imagen de la aplicación

```sh
docker build -t typers-nestjs:demo .
docker run --rm -p 127.0.0.1:3000:3000 \
  -e DEMO_DATABASE=memory \
  -e JWT_SECRET -e SESSION_SECRET \
  -e DEMO_ADMIN_PASSWORD -e DEMO_READER_PASSWORD \
  typers-nestjs:demo
```

Exporta antes esos cuatro secretos en tu terminal. `JWT_SECRET` y `SESSION_SECRET` requieren al menos 32 caracteres; las
contraseñas deben ser explícitas en producción. La imagen ejecuta JavaScript ESM compilado como usuario `node`, sin
dependencias de desarrollo, con comprobación HTTP de salud. Para PostgreSQL, configura una `DATABASE_URL` accesible
desde el contenedor, aplica la migración y usa `DEMO_DATABASE=postgres`.

La imagen arranca en producción, con cookies seguras. Para ejercitar **sesiones y CSRF en el HTTP local** añade
`-e NODE_ENV=development` al comando Docker; REST con JWT no depende de esas cookies. El laboratorio TLS es
independiente y no configura un proxy HTTPS para la aplicación principal.

## Alcance y decisiones

- Es un banco de pruebas, con cuentas de ejemplo y sesiones/caché en memoria. No incluye registro, recuperación de
  contraseña ni persistencia de sesiones para varias réplicas.
- El índice incluye API Reference, migración, cursos, Discover y Support sin presentarlos como funciones ejecutables.
  Las variantes pendientes se detallan en la matriz.
- Las versiones fijadas tienen avisos de peers en Throttler y una dependencia de Commander. Sus rutas reales se prueban
  con Nest 12; esa evidencia no cubre todas sus APIs.
- Observe 0.2.0 reinicia su worker durante el cierre en el caso reproducido. El laboratorio usa un proceso aislado y
  documenta ese límite; no acredita el dashboard SaaS ni un cierre con vaciado garantizado.
- Typers CLI y el perfil explícito del adaptador pasan la comparación local del corpus. El Nest CLI original, plugins y
  otras combinaciones conservan sus límites; [informe y reproducción](docs/typers-comparison.md).

La comparación adicional con Typers CLI y TypeScript 7 produjo **469 archivos idénticos** en el snapshot y pasó los 26
contratos Node por ruta. El adaptador necesita un perfil explícito sin `watchAssets` ni `incremental`; los rechazos de
la configuración original permanecen registrados. [Detalle](docs/typers-comparison.md).

[Arquitectura y scaffold](docs/architecture.md) · [Matriz completa](docs/nest-coverage.md) · [Comparar Typers](docs/typers.md) · [Documentación oficial](https://docs.nestjs.com/)
