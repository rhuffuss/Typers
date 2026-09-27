# APIs públicas de NestJS: inventario reproducible

**1131 exports raíz de 31 paquetes instalados**, con 2698 miembros públicos declarados. [Datos completos](nest-api-coverage.json) · [Evidencia manual](nest-api-evidence.json).

**Un caso verificado no cierra la API, sus overloads ni todas sus opciones.** Los imports y las referencias AST se conservan separados; ninguna coincidencia de texto promueve una API a verificada.

## Alcance y método

- Todos los @nestjs/* de dependencies directas y @nestjs/testing de devDependencies. Se usan versiones instaladas, no rangos de manifest.
- Solo export raíz "." resuelto como NodeNext/import/types. No se importan ni ejecutan los paquetes para descubrir runtime.
- declared-runtime-value significa valor según declaraciones y sintaxis export; no garantiza presencia/behavior del JavaScript publicado.
- Miembros públicos declarados de clases/interfaces, estáticos, enums y tipos objeto de constantes como NestFactory. Se omiten private/protected, miembros heredados como entradas nuevas y nombres de símbolos computados.
- Firmas de llamadas/construcción y métodos según TypeChecker; un caso no verifica cada overload, genérico, opción ni combinación.
- AST de src/test .ts/.tsx/.mts/.cts y templates TypeScript. Incluye fixtures de tipos y pruebas; no equivale a ejecución de todas las referencias.
- Excluido: Subpaths (incluidos internal, decorators/* y plugins CLI), condiciones browser/react-native y exports de paquetes transitivos no seleccionados.
- Excluido: CLI, schematics y otros @nestjs/* de devDependencies salvo testing.
- Excluido: No inventario exhaustivo del lenguaje TypeScript ni comparación con Typers.
- Excluido: No seguimiento completo de alias asignados a variables, destructuring, reflexión, acceso dinámico a propiedades, imports dinámicos ni cuerpos materializados a partir de strings.

El script usa el TypeChecker de TypeScript 6.0.3 y sigue reexports, aliases y `export type`. No ejecuta imports de paquetes Nest. Un valor declarado para runtime puede requerir una comprobación adicional del JavaScript publicado.

## Estados

| Estado | Exports raíz | Miembros | Significado |
| --- | ---: | ---: | --- |
| `pending` | 818 | 2403 | Sin import ni referencia AST registrada y sin caso manual verificado. |
| `referenced` | 237 | 204 | Import o uso AST identificado. Consultar imports/references y kind: puede ser solo import o solo tipo; no acredita ejecución. |
| `verified-case` | 76 | 91 | Evidencia manual explícita enlaza esta API/version y, cuando procede, miembros concretos con ejemplo, prueba y contrato pasado. No cubre toda la API. |

Hay 620 exports declarados como valores y 511 exclusivos de tipos. 0 exports aparecen solo en imports, sin uso AST identificado. 30 casos manuales sostienen las promociones; se cuentan una vez aunque cubran varios exports.

## Reproducir y detectar cambios

```sh
node scripts/nest-api-inventory.mjs
node scripts/nest-api-inventory.mjs --check
node scripts/nest-api-inventory.mjs --self-test
```

`--check` reconstruye ambos artefactos en memoria y compara su contenido exacto. Falla por drift de versiones/declaraciones, fuentes, evidencia o generador; también detecta rutas, exports, miembros y títulos de tests rotos. Rechaza conservar casos verificados con skip/todo o condiciones skipIf/runIf en tests/describe. No vuelve a ejecutar tests ni cambia estados por su cuenta. Tras un cambio legítimo se revisa la evidencia, se vuelve a generar y se ejecuta el check.

Las rutas y hashes se normalizan para no depender del directorio absoluto del checkout ni de los hashes de carpetas de pnpm. No hay timestamps de generación que produzcan drift por el mero paso del tiempo. La fecha de cada caso es su confirmación explícita.

## Paquetes y versiones

| Paquete | Versión instalada | Exports | pending / referenced / verified-case | Miembros públicos |
| --- | --- | ---: | --- | ---: |
| `@nestjs/apollo` | 14.0.0 | 20 | 13 / 7 / 0 | 21 |
| `@nestjs/axios` | 12.0.1 | 5 | 3 / 2 / 0 | 21 |
| `@nestjs/bullmq` | 12.0.0 | 37 | 31 / 6 / 0 | 58 |
| `@nestjs/cache-manager` | 12.0.0 | 16 | 12 / 4 / 0 | 15 |
| `@nestjs/common` | 12.0.2 | 207 | 123 / 56 / 28 | 484 |
| `@nestjs/config` | 12.0.0 | 19 | 14 / 0 / 5 | 30 |
| `@nestjs/core` | 12.0.2 | 54 | 30 / 14 / 10 | 270 |
| `@nestjs/cqrs` | 12.0.0 | 56 | 41 / 15 / 0 | 66 |
| `@nestjs/devtools-integration` | 12.0.0 | 3 | 2 / 1 / 0 | 1 |
| `@nestjs/event-emitter` | 12.0.1 | 11 | 8 / 3 / 0 | 8 |
| `@nestjs/graphql` | 14.0.0 | 133 | 95 / 38 / 0 | 280 |
| `@nestjs/jwt` | 12.0.2 | 13 | 11 / 2 / 0 | 28 |
| `@nestjs/mapped-types` | 12.0.0 | 10 | 10 / 0 / 0 | 0 |
| `@nestjs/mercurius` | 14.0.0 | 14 | 12 / 2 / 0 | 16 |
| `@nestjs/microservices` | 12.0.2 | 137 | 107 / 21 / 9 | 473 |
| `@nestjs/mongoose` | 12.0.0 | 25 | 19 / 6 / 0 | 30 |
| `@nestjs/observe` | 0.2.0 | 32 | 25 / 7 / 0 | 140 |
| `@nestjs/passport` | 12.0.0 | 14 | 11 / 3 / 0 | 17 |
| `@nestjs/platform-express` | 12.0.2 | 15 | 12 / 3 / 0 | 63 |
| `@nestjs/platform-fastify` | 12.0.2 | 6 | 4 / 0 / 2 | 60 |
| `@nestjs/platform-socket.io` | 12.0.2 | 1 | 0 / 0 / 1 | 6 |
| `@nestjs/platform-ws` | 12.0.2 | 1 | 0 / 0 / 1 | 8 |
| `@nestjs/schedule` | 12.0.2 | 11 | 5 / 3 / 3 | 110 |
| `@nestjs/sequelize` | 12.0.0 | 12 | 9 / 3 / 0 | 9 |
| `@nestjs/serve-static` | 12.0.0 | 13 | 11 / 2 / 0 | 60 |
| `@nestjs/swagger` | 12.0.1 | 160 | 128 / 26 / 6 | 271 |
| `@nestjs/terminus` | 12.0.0 | 35 | 29 / 6 / 0 | 37 |
| `@nestjs/testing` | 12.0.2 | 7 | 3 / 2 / 2 | 17 |
| `@nestjs/throttler` | 6.5.0 | 26 | 24 / 2 / 0 | 33 |
| `@nestjs/typeorm` | 12.0.1 | 19 | 17 / 2 / 0 | 11 |
| `@nestjs/websockets` | 12.0.2 | 19 | 9 / 1 / 9 | 55 |

## Casos explícitos

### providers-async-and-alias

**verified-case** — El contenedor espera la fábrica async y la configuración dinámica, y useExisting conserva la identidad del proveedor.

APIs: `@nestjs/common@12.0.2::Module`; `@nestjs/common@12.0.2::Inject`; `@nestjs/common@12.0.2::ConfigurableModuleBuilder` (`instance:setClassMethodName`, `instance:build`).

Ejemplos: [src/fundamentals/fundamentals.module.ts](../src/fundamentals/fundamentals.module.ts), [src/fundamentals/fundamentals.service.ts](../src/fundamentals/fundamentals.service.ts), [src/fundamentals/demo-settings.module.ts](../src/fundamentals/demo-settings.module.ts), [test/fundamentals.e2e-spec.ts](../test/fundamentals.e2e-spec.ts).

- [test/fundamentals.e2e-spec.ts](../test/fundamentals.e2e-spec.ts): `awaits factories and dynamic configuration, and aliases the same provider`; `pnpm exec vitest run --config vitest.config.e2e.ts test/fundamentals.e2e-spec.ts`.

Límites: Solo useValue, useClass, useFactory async y useExisting presentes en este módulo; no todas las variantes de Provider ni extras del builder.

### provider-forward-reference

**verified-case** — Las dos direcciones del ciclo aislado resuelven las mismas instancias mediante tokens seguros para ESM.

APIs: `@nestjs/common@12.0.2::forwardRef`.

Ejemplos: [src/fundamentals/circular-demo.module.ts](../src/fundamentals/circular-demo.module.ts), [test/fundamentals.e2e-spec.ts](../test/fundamentals.e2e-spec.ts).

- [test/fundamentals.e2e-spec.ts](../test/fundamentals.e2e-spec.ts): `resolves both directions of the isolated forwardRef provider cycle`; `pnpm exec vitest run --config vitest.config.e2e.ts test/fundamentals.e2e-spec.ts`.

Límites: Ciclo de proveedores controlado; no ciclos arbitrarios de módulos ni dependencia del orden de construcción.

### scope-context-resolution

**verified-case** — Singletons, request y transient conservan o separan identidad según consumidor/contexto; ModuleRef crea una clase e inyecta una request manual.

APIs: `@nestjs/core@12.0.2::ModuleRef` (`instance:get`, `instance:resolve`, `instance:create`, `instance:registerRequestByContextId`); `@nestjs/core@12.0.2::ContextIdFactory` (`static:create`, `static:getByRequest`); `@nestjs/core@12.0.2::REQUEST`; `@nestjs/common@12.0.2::Scope` (`value:REQUEST`, `value:TRANSIENT`); `@nestjs/common@12.0.2::Injectable`.

Ejemplos: [src/fundamentals/scope-probes.ts](../src/fundamentals/scope-probes.ts), [src/fundamentals/fundamentals.service.ts](../src/fundamentals/fundamentals.service.ts), [test/fundamentals.e2e-spec.ts](../test/fundamentals.e2e-spec.ts).

- [test/fundamentals.e2e-spec.ts](../test/fundamentals.e2e-spec.ts): `shares singletons, isolates requests and consumers, and reuses explicit contexts`; `pnpm exec vitest run --config vitest.config.e2e.ts test/fundamentals.e2e-spec.ts`.

Límites: Singleton es el scope por defecto, sin una referencia artificial a Scope.DEFAULT. ModuleRef.introspect permanece sin caso.

### lazy-module-cache

**verified-case** — Dos peticiones reutilizan el proveedor cargado con LazyModuleLoader y no ejecutan su hook onModuleInit.

APIs: `@nestjs/core@12.0.2::LazyModuleLoader` (`instance:load`).

Ejemplos: [src/fundamentals/fundamentals.service.ts](../src/fundamentals/fundamentals.service.ts), [src/fundamentals/lazy-report.module.ts](../src/fundamentals/lazy-report.module.ts), [test/fundamentals.e2e-spec.ts](../test/fundamentals.e2e-spec.ts).

- [test/fundamentals.e2e-spec.ts](../test/fundamentals.e2e-spec.ts): `caches a lazy module and leaves its documented lifecycle hook uncalled`; `pnpm exec vitest run --config vitest.config.e2e.ts test/fundamentals.e2e-spec.ts`.

Límites: Un módulo lazy sin controlador nuevo; no arranque automático de hooks ni todas las restricciones de importación lazy.

### discovery-decorator

**verified-case** — DiscoveryService encuentra metadata del decorador del proveedor y los dos controladores registrados.

APIs: `@nestjs/core@12.0.2::DiscoveryService` (`instance:getProviders`, `instance:getControllers`, `instance:getMetadataByDecorator`); `@nestjs/core@12.0.2::DiscoveryService` (`static:createDecorator`).

Ejemplos: [src/fundamentals/fundamentals.service.ts](../src/fundamentals/fundamentals.service.ts), [src/fundamentals/demo-feature.decorator.ts](../src/fundamentals/demo-feature.decorator.ts), [test/fundamentals.e2e-spec.ts](../test/fundamentals.e2e-spec.ts).

- [test/fundamentals.e2e-spec.ts](../test/fundamentals.e2e-spec.ts): `discovers a decorated provider and both registered controllers`; `pnpm exec vitest run --config vitest.config.e2e.ts test/fundamentals.e2e-spec.ts`.

Límites: Búsqueda del corpus local; no escaneo de todos los wrappers, aliases o contenedores externos.

### reflector-http-context

**verified-case** — La metadata de método precede a la de clase; el guard rechaza sin cabecera y el interceptor añade contexto real HTTP.

APIs: `@nestjs/core@12.0.2::Reflector` (`static:createDecorator`); `@nestjs/core@12.0.2::Reflector` (`instance:getAllAndOverride`); `@nestjs/common@12.0.2::ExecutionContext` (`instance:getClass`, `instance:getHandler`); `@nestjs/common@12.0.2::ArgumentsHost` (`instance:getType`, `instance:switchToHttp`); `@nestjs/common@12.0.2::CanActivate` (`instance:canActivate`); `@nestjs/common@12.0.2::NestInterceptor` (`instance:intercept`); `@nestjs/common@12.0.2::CallHandler` (`instance:handle`).

Ejemplos: [src/fundamentals/demo-context.ts](../src/fundamentals/demo-context.ts), [src/fundamentals/fundamentals.controller.ts](../src/fundamentals/fundamentals.controller.ts), [test/fundamentals.e2e-spec.ts](../test/fundamentals.e2e-spec.ts).

- [test/fundamentals.e2e-spec.ts](../test/fundamentals.e2e-spec.ts): `applies method metadata before class metadata in the guard and interceptor`; `pnpm exec vitest run --config vitest.config.e2e.ts test/fundamentals.e2e-spec.ts`.

Límites: getAllAndMerge/getAll/get no están verificados por este caso; el contexto es HTTP.

### testing-provider-override

**verified-case** — overrideProvider sustituye el token y el dependiente async recibe el valor de prueba conservando el alias.

APIs: `@nestjs/testing@12.0.2::Test` (`static:createTestingModule`); `@nestjs/testing@12.0.2::TestingModuleBuilder` (`instance:overrideProvider`, `instance:compile`).

Ejemplos: [test/fundamentals.e2e-spec.ts](../test/fundamentals.e2e-spec.ts).

- [test/fundamentals.e2e-spec.ts](../test/fundamentals.e2e-spec.ts): `supports overriding a token while its async dependent is still resolved by Nest`; `pnpm exec vitest run --config vitest.config.e2e.ts test/fundamentals.e2e-spec.ts`.

Límites: No verifica overrideGuard/Interceptor/Filter/Pipe/Module ni todos los tipos de sustitución.

### lifecycle-explicit-close

**verified-case** — app.init y app.close ejecutan una vez los cinco hooks en el orden observado.

APIs: `@nestjs/common@12.0.2::OnModuleInit` (`instance:onModuleInit`); `@nestjs/common@12.0.2::OnApplicationBootstrap` (`instance:onApplicationBootstrap`); `@nestjs/common@12.0.2::OnModuleDestroy` (`instance:onModuleDestroy`); `@nestjs/common@12.0.2::BeforeApplicationShutdown` (`instance:beforeApplicationShutdown`); `@nestjs/common@12.0.2::OnApplicationShutdown` (`instance:onApplicationShutdown`); `@nestjs/common@12.0.2::INestApplicationContext` (`instance:init`); `@nestjs/common@12.0.2::INestApplication` (`instance:close`).

Ejemplos: [src/fundamentals/lifecycle-probe.service.ts](../src/fundamentals/lifecycle-probe.service.ts), [test/fundamentals.e2e-spec.ts](../test/fundamentals.e2e-spec.ts).

- [test/fundamentals.e2e-spec.ts](../test/fundamentals.e2e-spec.ts): `runs startup and shutdown lifecycle hooks through app.init and app.close`; `pnpm exec vitest run --config vitest.config.e2e.ts test/fundamentals.e2e-spec.ts`.

Límites: Cierre explícito dentro del proceso; no señales del SO, Windows ni errores de todos los hooks.

### inquirer-transient-consumer

**verified-case** — Cada consumidor real obtiene un audit transient que identifica la clase que lo solicitó.

APIs: `@nestjs/core@12.0.2::INQUIRER`; `@nestjs/common@12.0.2::Scope` (`value:TRANSIENT`); `@nestjs/common@12.0.2::Inject`.

Ejemplos: [src/fundamentals-advanced/business.providers.ts](../src/fundamentals-advanced/business.providers.ts), [test/fundamentals-advanced.e2e-spec.ts](../test/fundamentals-advanced.e2e-spec.ts).

- [test/fundamentals-advanced.e2e-spec.ts](../test/fundamentals-advanced.e2e-spec.ts): `injects each real INQUIRER consumer into its own transient audit provider`; `pnpm exec vitest run --config vitest.config.e2e.ts test/fundamentals-advanced.e2e-spec.ts`.

Límites: Dos consumidores locales; no interpretación de INQUIRER como identidad autenticada ni prueba de todos los scopes.

### durable-tenant-context

**verified-case** — Un contexto durable comparte tarifas por tenant y mantiene fresca la identidad de cada petición; concurrencia y evicción LRU aíslan tenants.

APIs: `@nestjs/core@12.0.2::ContextIdFactory` (`static:apply`, `static:create`); `@nestjs/core@12.0.2::ContextIdStrategy` (`instance:attach`); `@nestjs/core@12.0.2::HostComponentInfo` (`instance:isTreeDurable`); `@nestjs/core@12.0.2::REQUEST`; `@nestjs/common@12.0.2::Injectable`; `@nestjs/common@12.0.2::Scope` (`value:REQUEST`).

Ejemplos: [src/fundamentals-advanced/tenant-context.ts](../src/fundamentals-advanced/tenant-context.ts), [src/fundamentals-advanced/harness.ts](../src/fundamentals-advanced/harness.ts), [src/fundamentals-advanced/business.providers.ts](../src/fundamentals-advanced/business.providers.ts), [src/fundamentals-advanced/fundamentals-advanced.module.ts](../src/fundamentals-advanced/fundamentals-advanced.module.ts), [test/fundamentals-advanced.e2e-spec.ts](../test/fundamentals-advanced.e2e-spec.ts).

- [test/fundamentals-advanced.e2e-spec.ts](../test/fundamentals-advanced.e2e-spec.ts): `shares a durable price book within one tenant while request identity stays fresh`; `pnpm exec vitest run --config vitest.config.e2e.ts test/fundamentals-advanced.e2e-spec.ts`.
- [test/fundamentals-advanced.e2e-spec.ts](../test/fundamentals-advanced.e2e-spec.ts): `isolates two tenants and converges simultaneous requests onto the correct durable instances`; `pnpm exec vitest run --config vitest.config.e2e.ts test/fundamentals-advanced.e2e-spec.ts`.
- [test/fundamentals-advanced.e2e-spec.ts](../test/fundamentals-advanced.e2e-spec.ts): `bounds the LRU cache and recreates an evicted tenant without inheriting another tenant price`; `pnpm exec vitest run --config vitest.config.e2e.ts test/fundamentals-advanced.e2e-spec.ts`.
- [test/fundamentals-advanced.e2e-spec.ts](../test/fundamentals-advanced.e2e-spec.ts): `clears context identities on close and resets the public context strategy`; `pnpm exec vitest run --config vitest.config.e2e.ts test/fundamentals-advanced.e2e-spec.ts`.

Límites: Allowlist local de tres tenants y caché de dos contextos; sin autenticación JWT multitenant, GC inmediato, persistencia distribuida ni aislamiento entre workers. ContextIdFactory.apply es global al proceso.

### optional-constructor-property-factory

**verified-case** — Dependencias opcionales ausentes usan fallbacks, las presentes cambian el recibo y una propiedad heredada obligatoria sigue siendo requerida.

APIs: `@nestjs/common@12.0.2::Optional`; `@nestjs/common@12.0.2::Inject`; `@nestjs/common@12.0.2::Provider`.

Ejemplos: [src/fundamentals-advanced/business.providers.ts](../src/fundamentals-advanced/business.providers.ts), [src/fundamentals-advanced/fundamentals-advanced.module.ts](../src/fundamentals-advanced/fundamentals-advanced.module.ts), [test/fundamentals-advanced.e2e-spec.ts](../test/fundamentals-advanced.e2e-spec.ts).

- [test/fundamentals-advanced.e2e-spec.ts](../test/fundamentals-advanced.e2e-spec.ts): `uses constructor/property/factory fallbacks and injects a required inherited property`; `pnpm exec vitest run --config vitest.config.e2e.ts test/fundamentals-advanced.e2e-spec.ts`.
- [test/fundamentals-advanced.e2e-spec.ts](../test/fundamentals-advanced.e2e-spec.ts): `uses supplied optional constructor/property/factory dependencies in the business result`; `pnpm exec vitest run --config vitest.config.e2e.ts test/fundamentals-advanced.e2e-spec.ts`.
- [test/fundamentals-advanced.e2e-spec.ts](../test/fundamentals-advanced.e2e-spec.ts): `fails to build when a required property dependency is absent`; `pnpm exec vitest run --config vitest.config.e2e.ts test/fundamentals-advanced.e2e-spec.ts`.

Límites: Provider es un contrato de tipos utilizado por este módulo; no todas las ramas de su unión. La fábrica usa inject con token optional explícito.

### nest12-optional-inheritance

**verified-case** — Una dependencia requerida de un constructor derivado no hereda la opcionalidad del constructor base en Nest 12.

APIs: `@nestjs/common@12.0.2::Optional`; `@nestjs/common@12.0.2::Inject`.

Ejemplos: [src/fundamentals-advanced/business.providers.ts](../src/fundamentals-advanced/business.providers.ts), [test/fundamentals-advanced.e2e-spec.ts](../test/fundamentals-advanced.e2e-spec.ts).

- [test/fundamentals-advanced.e2e-spec.ts](../test/fundamentals-advanced.e2e-spec.ts): `does not inherit constructor Optional metadata into a required derived dependency in Nest 12`; `pnpm exec vitest run --config vitest.config.e2e.ts test/fundamentals-advanced.e2e-spec.ts`.

Límites: Solo versión instalada; no se ejecutó una comparación con Nest 11 ni con Typers.

### testing-missing-adapter-mocker

**verified-case** — useMocker suministra únicamente el adaptador de crédito ausente y se ejecuta el servicio real de autorización.

APIs: `@nestjs/testing@12.0.2::Test` (`static:createTestingModule`); `@nestjs/testing@12.0.2::TestingModuleBuilder` (`instance:useMocker`, `instance:compile`).

Ejemplos: [src/fundamentals-advanced/business.providers.ts](../src/fundamentals-advanced/business.providers.ts), [test/fundamentals-advanced.e2e-spec.ts](../test/fundamentals-advanced.e2e-spec.ts).

- [test/fundamentals-advanced.e2e-spec.ts](../test/fundamentals-advanced.e2e-spec.ts): `auto-mocks only the missing credit adapter and executes the real authorization service`; `pnpm exec vitest run --config vitest.config.e2e.ts test/fundamentals-advanced.e2e-spec.ts`.

Límites: No mocks automáticos de REQUEST/INQUIRER, miembros privados ni todos los tokens.

### async-factory-bootstrap-failure

**verified-case** — Una fábrica requerida rechazada hace fallar compile sin devolver un módulo utilizable.

APIs: `@nestjs/testing@12.0.2::Test` (`static:createTestingModule`); `@nestjs/testing@12.0.2::TestingModuleBuilder` (`instance:compile`).

Ejemplos: [test/fundamentals-advanced.e2e-spec.ts](../test/fundamentals-advanced.e2e-spec.ts).

- [test/fundamentals-advanced.e2e-spec.ts](../test/fundamentals-advanced.e2e-spec.ts): `propagates a required asynchronous factory failure without creating a usable module`; `pnpm exec vitest run --config vitest.config.e2e.ts test/fundamentals-advanced.e2e-spec.ts`.

Límites: El caso demuestra propagación de un rechazo controlado; no estrategia general de reintentos o rollback de recursos.

### configuration-namespaced-provider

**verified-case** — registerAs produce configuración tipada que se inyecta mediante asProvider y un módulo forRootAsync; datos inválidos rechazan bootstrap.

APIs: `@nestjs/config@12.0.0::registerAs`; `@nestjs/config@12.0.0::ConfigType`; `@nestjs/config@12.0.0::ConfigFactoryKeyHost` (`instance:KEY`, `instance:asProvider`); `@nestjs/config@12.0.0::ConfigModule` (`static:forFeature`); `@nestjs/common@12.0.2::ConfigurableModuleBuilder` (`instance:setClassMethodName`, `instance:build`).

Ejemplos: [src/operations-lab/operations.config.ts](../src/operations-lab/operations.config.ts), [src/operations-lab/operations-lab.module.ts](../src/operations-lab/operations-lab.module.ts), [test/operations-lab.e2e-spec.ts](../test/operations-lab.e2e-spec.ts).

- [test/operations-lab.e2e-spec.ts](../test/operations-lab.e2e-spec.ts): `injects a namespaced ConfigType through asProvider and rejects inventory oversubscription`; `pnpm exec vitest run --config vitest.config.e2e.ts test/operations-lab.e2e-spec.ts`.
- [test/operations-lab.e2e-spec.ts](../test/operations-lab.e2e-spec.ts): `fails bootstrap for an invalid namespaced configuration instead of using a silent default`; `pnpm exec vitest run --config vitest.config.e2e.ts test/operations-lab.e2e-spec.ts`.

Límites: Un namespace y factory validadora; no todas las opciones de carga, factories de clase o schemas. ConfigType es evidencia de tipos más comportamiento del valor, sin reflexión de tipos en runtime.

### configuration-env-precedence

**verified-case** — Dos dotenv respetan prioridad del primer fichero y del shell; validate construye claves anidadas y getOrThrow rechaza la clave ausente.

APIs: `@nestjs/config@12.0.0::ConfigModule` (`static:forRoot`); `@nestjs/config@12.0.0::ConfigService` (`instance:get`, `instance:getOrThrow`).

Ejemplos: [test/operations-lab.e2e-spec.ts](../test/operations-lab.e2e-spec.ts).

- [test/operations-lab.e2e-spec.ts](../test/operations-lab.e2e-spec.ts): `merges two env files with first-file and shell precedence, validates and infers nested keys`; `pnpm exec vitest run --config vitest.config.e2e.ts test/operations-lab.e2e-spec.ts`.

Límites: Se configura cache:true y se prueba precedencia/lectura, sin medir rendimiento ni todos los estados de caché; archivos temporales y claves de entorno aisladas.

### scheduler-dynamic-timeouts

**verified-case** — Un timeout registrado expira la reserva y una confirmación elimina su timeout conservando inventario confirmado.

APIs: `@nestjs/schedule@12.0.2::SchedulerRegistry` (`instance:addTimeout`, `instance:getTimeout`, `instance:getTimeouts`, `instance:deleteTimeout`, `instance:doesExist`).

Ejemplos: [src/operations-lab/reservation-engine.ts](../src/operations-lab/reservation-engine.ts), [test/operations-lab.e2e-spec.ts](../test/operations-lab.e2e-spec.ts).

- [test/operations-lab.e2e-spec.ts](../test/operations-lab.e2e-spec.ts): `expires holds through registered timeouts and cancels the timeout when inventory is confirmed`; `pnpm exec vitest run --config vitest.config.e2e.ts test/operations-lab.e2e-spec.ts`.

Límites: Timers reales de proceso; sin garantía de ejecución durante suspensión ni persistencia tras reinicio.

### scheduler-dynamic-cron

**verified-case** — Un cron dinámico real recupera una reserva cuyo timeout se eliminó; reprogramación válida y parada/borrado respetan el registro.

APIs: `@nestjs/schedule@12.0.2::SchedulerRegistry` (`instance:addCronJob`, `instance:getCronJob`, `instance:getCronJobs`, `instance:deleteCronJob`, `instance:doesExist`); `@nestjs/schedule@12.0.2::CronExpression` (`value:EVERY_SECOND`).

Ejemplos: [src/operations-lab/reservation-engine.ts](../src/operations-lab/reservation-engine.ts), [test/operations-lab.e2e-spec.ts](../test/operations-lab.e2e-spec.ts).

- [test/operations-lab.e2e-spec.ts](../test/operations-lab.e2e-spec.ts): `recovers an expired hold with a real dynamic cron, reschedules and rejects duplicate jobs`; `pnpm exec vitest run --config vitest.config.e2e.ts test/operations-lab.e2e-spec.ts`.

Límites: CronJob.start/stop/setTime pertenecen a cron, fuera del inventario @nestjs. No todas las expresiones, zonas horarias o opciones del scheduler.

### scheduler-dynamic-interval-cleanup

**verified-case** — Un intervalo toma ocho muestras acotadas; app.close elimina intervalos, timeouts y cron y detiene los efectos.

APIs: `@nestjs/schedule@12.0.2::SchedulerRegistry` (`instance:addInterval`, `instance:getInterval`, `instance:getIntervals`, `instance:deleteInterval`, `instance:getCronJobs`, `instance:getTimeouts`, `instance:doesExist`); `@nestjs/schedule@12.0.2::ScheduleModule` (`static:forRoot`).

Ejemplos: [src/operations-lab/reservation-engine.ts](../src/operations-lab/reservation-engine.ts), [src/operations-lab/operations-lab.module.ts](../src/operations-lab/operations-lab.module.ts), [test/operations-lab.e2e-spec.ts](../test/operations-lab.e2e-spec.ts).

- [test/operations-lab.e2e-spec.ts](../test/operations-lab.e2e-spec.ts): `samples bounded inventory history with a dynamic interval and removes all timers on application close`; `pnpm exec vitest run --config vitest.config.e2e.ts test/operations-lab.e2e-spec.ts`.

Límites: 13 métodos públicos declarados de SchedulerRegistry enlazados entre tres casos; eso no verifica todos sus overloads, errores ni combinaciones.

### uri-version-neutral-default-middleware

**verified-case** — Versiones URI 1/2, ruta VERSION_NEUTRAL y versión por defecto resuelven contratos distintos; middleware solo aparece en GET v2.

APIs: `@nestjs/common@12.0.2::Version`; `@nestjs/common@12.0.2::VERSION_NEUTRAL`; `@nestjs/common@12.0.2::VersioningType` (`value:URI`); `@nestjs/common@12.0.2::RequestMethod` (`value:GET`); `@nestjs/common@12.0.2::INestApplication` (`instance:enableVersioning`); `@nestjs/common@12.0.2::MiddlewareConsumer` (`instance:apply`).

Ejemplos: [src/operations-lab/operations.controller.ts](../src/operations-lab/operations.controller.ts), [src/operations-lab/operations-lab.module.ts](../src/operations-lab/operations-lab.module.ts), [test/operations-lab.e2e-spec.ts](../test/operations-lab.e2e-spec.ts).

- [test/operations-lab.e2e-spec.ts](../test/operations-lab.e2e-spec.ts): `serves URI-neutral, multiple-version and default-version routes with version-specific middleware`; `pnpm exec vitest run --config vitest.config.e2e.ts test/operations-lab.e2e-spec.ts`.

Límites: No cubre todos los métodos HTTP, exclusiones de middleware, controladores versionados ni adaptadores.

### header-version-neutral

**verified-case** — La ruta neutral acepta cabecera ausente/desconocida; una ruta versionada rechaza una versión sin soporte.

APIs: `@nestjs/common@12.0.2::VERSION_NEUTRAL`; `@nestjs/common@12.0.2::VersioningType` (`value:HEADER`).

Ejemplos: [src/operations-lab/operations.controller.ts](../src/operations-lab/operations.controller.ts), [test/operations-lab.e2e-spec.ts](../test/operations-lab.e2e-spec.ts).

- [test/operations-lab.e2e-spec.ts](../test/operations-lab.e2e-spec.ts): `serves header-neutral routes with or without an unknown version and rejects an unsupported policy version`; `pnpm exec vitest run --config vitest.config.e2e.ts test/operations-lab.e2e-spec.ts`.

Límites: Cabecera x-api-version y versiones de este controlador; no aliases de cabeceras ni negociación genérica.

### fastify-custom-highest-version

**verified-case** — Fastify elige la mayor versión soportada de preferencias ordenadas y devuelve 404 si ninguna coincide.

APIs: `@nestjs/common@12.0.2::VersioningType` (`value:CUSTOM`); `@nestjs/platform-fastify@12.0.2::FastifyAdapter`; `@nestjs/platform-fastify@12.0.2::NestFastifyApplication` (`instance:inject`).

Ejemplos: [test/operations-lab.e2e-spec.ts](../test/operations-lab.e2e-spec.ts).

- [test/operations-lab.e2e-spec.ts](../test/operations-lab.e2e-spec.ts): `selects the highest supported custom version on Fastify from an ordered client preference list`; `pnpm exec vitest run --config vitest.config.e2e.ts test/operations-lab.e2e-spec.ts`.

Límites: Extractor local validado para una lista de enteros; no todas las diferencias entre Express y Fastify.

### microservice-request-event-hooks

**verified-case** — TCP real y transporte HTTP RPC propio ejecutan request-response, eventos y hooks en orden con aislamiento AsyncLocalStorage.

APIs: `@nestjs/core@12.0.2::NestFactory` (`value:createMicroservice`); `@nestjs/microservices@12.0.2::ClientProxyFactory` (`static:create`); `@nestjs/microservices@12.0.2::ClientProxy` (`instance:send`, `instance:emit`, `instance:connect`, `instance:close`); `@nestjs/microservices@12.0.2::MessagePattern`; `@nestjs/microservices@12.0.2::EventPattern`; `@nestjs/common@12.0.2::INestMicroservice` (`instance:registerPreRequestHook`); `@nestjs/microservices@12.0.2::Transport` (`value:TCP`).

Ejemplos: [src/messaging/messaging.harness.ts](../src/messaging/messaging.harness.ts), [src/messaging/messaging.controller.ts](../src/messaging/messaging.controller.ts), [src/messaging/rpc-context.ts](../src/messaging/rpc-context.ts), [test/messaging.e2e-spec.ts](../test/messaging.e2e-spec.ts).

- [test/messaging.e2e-spec.ts](../test/messaging.e2e-spec.ts): `executes request-response through hooks, guard, interceptor, pipe and handler`; `pnpm exec vitest run --config vitest.config.e2e.ts test/messaging.e2e-spec.ts`.
- [test/messaging.e2e-spec.ts](../test/messaging.e2e-spec.ts): `isolates AsyncLocalStorage correlations for concurrent messages`; `pnpm exec vitest run --config vitest.config.e2e.ts test/messaging.e2e-spec.ts`.
- [test/messaging.e2e-spec.ts](../test/messaging.e2e-spec.ts): `delivers events to the actual controller`; `pnpm exec vitest run --config vitest.config.e2e.ts test/messaging.e2e-spec.ts`.

Límites: Dos variantes parametrizadas TCP/custom HTTP RPC; no todos los brokers, reintentos, garantías de entrega ni opciones de cada ClientProxy.

### microservice-filter-and-stream

**verified-case** — Filtros transforman errores de DTO/guard; el cliente recibe varias respuestas y limita una petición sin respuesta.

APIs: `@nestjs/microservices@12.0.2::RpcException` (`instance:getError`); `@nestjs/common@12.0.2::RpcExceptionFilter` (`instance:catch`); `@nestjs/common@12.0.2::ValidationPipe` (`instance:transform`).

Ejemplos: [src/messaging/rpc-context.ts](../src/messaging/rpc-context.ts), [test/messaging.e2e-spec.ts](../test/messaging.e2e-spec.ts).

- [test/messaging.e2e-spec.ts](../test/messaging.e2e-spec.ts): `returns filter errors for invalid DTOs and denied access`; `pnpm exec vitest run --config vitest.config.e2e.ts test/messaging.e2e-spec.ts`.
- [test/messaging.e2e-spec.ts](../test/messaging.e2e-spec.ts): `streams multiple replies and bounds an unanswered request with timeout`; `pnpm exec vitest run --config vitest.config.e2e.ts test/messaging.e2e-spec.ts`.

Límites: El timeout es operador de RxJS, fuera del inventario Nest; la validación cubre DTOs concretos y ambas variantes TCP/custom.

### hybrid-shared-container

**verified-case** — Los listeners HTTP y microservicio comparten el proveedor del log mediante connectMicroservice y startAllMicroservices.

APIs: `@nestjs/core@12.0.2::NestFactory` (`value:create`); `@nestjs/common@12.0.2::INestApplication` (`instance:connectMicroservice`, `instance:startAllMicroservices`).

Ejemplos: [src/messaging/messaging.harness.ts](../src/messaging/messaging.harness.ts), [test/messaging.e2e-spec.ts](../test/messaging.e2e-spec.ts).

- [test/messaging.e2e-spec.ts](../test/messaging.e2e-spec.ts): `shares the provider container across HTTP and microservice listeners`; `pnpm exec vitest run --config vitest.config.e2e.ts test/messaging.e2e-spec.ts`.

Límites: Aplicación híbrida con TCP y herencia de configuración; no todas las políticas globales ni clustering.

### grpc-four-call-modes

**verified-case** — gRPC real ejecuta unary y streaming de servidor, cliente y bidireccional usando el asset protobuf.

APIs: `@nestjs/microservices@12.0.2::GrpcMethod`; `@nestjs/microservices@12.0.2::GrpcStreamMethod`; `@nestjs/microservices@12.0.2::ClientGrpc` (`instance:getService`); `@nestjs/microservices@12.0.2::Transport` (`value:GRPC`).

Ejemplos: [src/messaging/messaging.controller.ts](../src/messaging/messaging.controller.ts), [src/messaging/messaging.harness.ts](../src/messaging/messaging.harness.ts), [test/messaging.e2e-spec.ts](../test/messaging.e2e-spec.ts).

- [test/messaging.e2e-spec.ts](../test/messaging.e2e-spec.ts): `calls a unary method and consumes a server stream`; `pnpm exec vitest run --config vitest.config.e2e.ts test/messaging.e2e-spec.ts`.
- [test/messaging.e2e-spec.ts](../test/messaging.e2e-spec.ts): `sends a client stream and exchanges a bidirectional stream`; `pnpm exec vitest run --config vitest.config.e2e.ts test/messaging.e2e-spec.ts`.

Límites: Un servicio Calculator local; no metadata avanzada, cancelación, TLS ni todas las variantes de decoradores gRPC.

### socketio-ack-broadcast-lifecycle

**verified-case** — Socket.IO devuelve ack implícito/explicito, broadcast y respuestas Observable, y ejecuta lifecycle del gateway.

APIs: `@nestjs/platform-socket.io@12.0.2::IoAdapter`; `@nestjs/websockets@12.0.2::WebSocketGateway`; `@nestjs/websockets@12.0.2::SubscribeMessage`; `@nestjs/websockets@12.0.2::MessageBody`; `@nestjs/websockets@12.0.2::Ack`; `@nestjs/websockets@12.0.2::WebSocketServer`; `@nestjs/websockets@12.0.2::OnGatewayInit` (`instance:afterInit`); `@nestjs/websockets@12.0.2::OnGatewayConnection` (`instance:handleConnection`); `@nestjs/websockets@12.0.2::OnGatewayDisconnect` (`instance:handleDisconnect`).

Ejemplos: [src/messaging/messaging.harness.ts](../src/messaging/messaging.harness.ts), [src/messaging/socket-gateways.ts](../src/messaging/socket-gateways.ts), [test/messaging.e2e-spec.ts](../test/messaging.e2e-spec.ts).

- [test/messaging.e2e-spec.ts](../test/messaging.e2e-spec.ts): `acknowledges implicitly and explicitly and runs gateway lifecycle`; `pnpm exec vitest run --config vitest.config.e2e.ts test/messaging.e2e-spec.ts`.
- [test/messaging.e2e-spec.ts](../test/messaging.e2e-spec.ts): `broadcasts to another client and emits Observable responses`; `pnpm exec vitest run --config vitest.config.e2e.ts test/messaging.e2e-spec.ts`.

Límites: Clientes reales locales con websocket; sin fallback long-polling, rooms distribuidas, adaptador Redis o todas las firmas de gateway.

### raw-websocket-filter

**verified-case** — El adaptador ws procesa paquetes event/data y broadcast; guard/ValidationPipe producen errores por el filtro del gateway.

APIs: `@nestjs/platform-ws@12.0.2::WsAdapter`; `@nestjs/websockets@12.0.2::WsException` (`instance:getError`).

Ejemplos: [src/messaging/messaging.harness.ts](../src/messaging/messaging.harness.ts), [src/messaging/socket-gateways.ts](../src/messaging/socket-gateways.ts), [src/messaging/socket-support.ts](../src/messaging/socket-support.ts), [test/messaging.e2e-spec.ts](../test/messaging.e2e-spec.ts).

- [test/messaging.e2e-spec.ts](../test/messaging.e2e-spec.ts): `uses event/data packets, broadcasts and runs the interceptor`; `pnpm exec vitest run --config vitest.config.e2e.ts test/messaging.e2e-spec.ts`.
- [test/messaging.e2e-spec.ts](../test/messaging.e2e-spec.ts): `filters validation and guard exceptions over the raw WebSocket`; `pnpm exec vitest run --config vitest.config.e2e.ts test/messaging.e2e-spec.ts`.

Límites: Raw ws y Socket.IO son harness separados; no equivalencia universal de protocolo ni reconexión.

### openapi-module-selection-and-ui

**verified-case** — createDocument selecciona módulos, deepScanRoutes incluye imports propios y setup sirve dos especificaciones e interfaces con selector.

APIs: `@nestjs/swagger@12.0.1::SwaggerModule` (`static:createDocument`, `static:setup`); `@nestjs/swagger@12.0.1::DocumentBuilder` (`instance:setTitle`, `instance:setVersion`, `instance:build`).

Ejemplos: [src/openapi-lab/multiple-documents.ts](../src/openapi-lab/multiple-documents.ts), [test/openapi-documents.e2e-spec.ts](../test/openapi-documents.e2e-spec.ts).

- [test/openapi-documents.e2e-spec.ts](../test/openapi-documents.e2e-spec.ts): `includes only each selected module and its own schemas`; `pnpm exec vitest run --config vitest.config.e2e.ts test/openapi-documents.e2e-spec.ts`.
- [test/openapi-documents.e2e-spec.ts](../test/openapi-documents.e2e-spec.ts): `deepScanRoutes includes the imported revision module without including sibling members`; `pnpm exec vitest run --config vitest.config.e2e.ts test/openapi-documents.e2e-spec.ts`.
- [test/openapi-documents.e2e-spec.ts](../test/openapi-documents.e2e-spec.ts): `serves separate Swagger interfaces and a selector pointing at the served JSON documents`; `pnpm exec vitest run --config vitest.config.e2e.ts test/openapi-documents.e2e-spec.ts`.

Límites: Documentos locales con Express; no todas las opciones de SwaggerModule/DocumentBuilder ni plugins subpath del CLI.

### openapi-generic-schema-and-links

**verified-case** — Un DTO genérico define items con schema explícito; links por operationId/operationRef se resuelven y siguen la respuesta HTTP real.

APIs: `@nestjs/swagger@12.0.1::ApiExtraModels`; `@nestjs/swagger@12.0.1::ApiOkResponse`; `@nestjs/swagger@12.0.1::ApiProperty`; `@nestjs/swagger@12.0.1::getSchemaPath`.

Ejemplos: [src/openapi-lab/multiple-documents.ts](../src/openapi-lab/multiple-documents.ts), [test/openapi-documents.e2e-spec.ts](../test/openapi-documents.e2e-spec.ts).

- [test/openapi-documents.e2e-spec.ts](../test/openapi-documents.e2e-spec.ts): `combines a generic page and explicit item schema, matching the actual response`; `pnpm exec vitest run --config vitest.config.e2e.ts test/openapi-documents.e2e-spec.ts`.
- [test/openapi-documents.e2e-spec.ts](../test/openapi-documents.e2e-spec.ts): `resolves operationId and relative operationRef links and follows their response parameter`; `pnpm exec vitest run --config vitest.config.e2e.ts test/openapi-documents.e2e-spec.ts`.

Límites: No reflexión automática del parámetro T ni validador exhaustivo de todas las especificaciones OpenAPI.

## Índice por export raíz

El JSON conserva declaraciones, firmas, miembros, imports y cada referencia con línea/columna. Esta tabla resume referencias y casos sin presentar el mero uso como prueba.

### @nestjs/apollo 14.0.0

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `ApolloDriver` | class / declared-runtime-value | referenced | 1 / 1 | — |
| `ApolloDriverAsyncConfig` | type-alias / type-only | pending | 0 / 0 | — |
| `ApolloDriverConfig` | interface / type-only | referenced | 1 / 1 | — |
| `ApolloDriverConfigFactory` | type-alias / type-only | pending | 0 / 0 | — |
| `ApolloFederationDriver` | class / declared-runtime-value | referenced | 1 / 2 | — |
| `ApolloFederationDriverAsyncConfig` | type-alias / type-only | pending | 0 / 0 | — |
| `ApolloFederationDriverConfig` | type-alias / type-only | referenced | 1 / 2 | — |
| `ApolloFederationDriverConfigFactory` | type-alias / type-only | pending | 0 / 0 | — |
| `ApolloGatewayDriver` | class / declared-runtime-value | referenced | 1 / 1 | — |
| `ApolloGatewayDriverAsyncConfig` | type-alias / type-only | pending | 0 / 0 | — |
| `ApolloGatewayDriverConfig` | interface / type-only | referenced | 1 / 1 | — |
| `ApolloGatewayDriverConfigFactory` | type-alias / type-only | pending | 0 / 0 | — |
| `AuthenticationError` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ForbiddenError` | class / declared-runtime-value | pending | 0 / 0 | — |
| `Plugin` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `PluginsExplorerService` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ServerRegistration` | interface / type-only | pending | 0 / 0 | — |
| `UserInputError` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ValidationError` | class / declared-runtime-value | pending | 0 / 0 | — |
| `getApolloServer` | variable / declared-runtime-value | pending | 0 / 0 | — |

### @nestjs/axios 12.0.1

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `HttpModule` | class / declared-runtime-value | referenced | 1 / 2 | — |
| `HttpModuleAsyncOptions` | interface / type-only | pending | 0 / 0 | — |
| `HttpModuleOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `HttpModuleOptionsFactory` | interface / type-only | pending | 0 / 0 | — |
| `HttpService` | class / declared-runtime-value | referenced | 1 / 2 | — |

### @nestjs/bullmq 12.0.0

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `BULL_CONFIG_DEFAULT_TOKEN` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `BullModule` | class / declared-runtime-value | referenced | 1 / 7 | — |
| `BullModuleExtraOptions` | interface / type-only | pending | 0 / 0 | — |
| `BullQueueAdvancedProcessor` | interface / type-only | pending | 0 / 0 | — |
| `BullQueueAdvancedSeparateProcessor` | interface / type-only | pending | 0 / 0 | — |
| `BullQueueProcessor` | type-alias / type-only | pending | 0 / 0 | — |
| `BullQueueProcessorCallback` | type-alias / type-only | pending | 0 / 0 | — |
| `BullQueueSeparateProcessor` | type-alias / type-only | pending | 0 / 0 | — |
| `BullRegistrar` | class / declared-runtime-value | pending | 0 / 0 | — |
| `BullRootModuleOptions` | interface / type-only | pending | 0 / 0 | — |
| `InjectFlowProducer` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `InjectQueue` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `JOB_REF` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `OnQueueEvent` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `OnQueueEventMetadata` | interface / type-only | pending | 0 / 0 | — |
| `OnWorkerEvent` | variable / declared-runtime-value | referenced | 1 / 1 | — |
| `OnWorkerEventMetadata` | interface / type-only | pending | 0 / 0 | — |
| `Processor` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `ProcessorDecoratorService` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ProcessorOptions` | interface / type-only | pending | 0 / 0 | — |
| `QueueEventsHost` | class / declared-runtime-value | pending | 0 / 0 | — |
| `QueueEventsListener` | function / declared-runtime-value | pending | 0 / 0 | — |
| `QueueEventsListenerOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `RegisterFlowProducerAsyncOptions` | interface / type-only | pending | 0 / 0 | — |
| `RegisterFlowProducerOptions` | interface / type-only | pending | 0 / 0 | — |
| `RegisterFlowProducerOptionsFactory` | interface / type-only | pending | 0 / 0 | — |
| `RegisterQueueAsyncOptions` | interface / type-only | pending | 0 / 0 | — |
| `RegisterQueueOptions` | interface / type-only | pending | 0 / 0 | — |
| `RegisterQueueOptionsFactory` | interface / type-only | pending | 0 / 0 | — |
| `SharedBullAsyncConfiguration` | interface / type-only | pending | 0 / 0 | — |
| `SharedBullConfigurationFactory` | interface / type-only | pending | 0 / 0 | — |
| `WorkerHost` | class / declared-runtime-value | referenced | 1 / 1 | — |
| `getFlowProducerOptionsToken` | function / declared-runtime-value | pending | 0 / 0 | — |
| `getFlowProducerToken` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `getQueueOptionsToken` | function / declared-runtime-value | pending | 0 / 0 | — |
| `getQueueToken` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `getSharedConfigToken` | function / declared-runtime-value | pending | 0 / 0 | — |

### @nestjs/cache-manager 12.0.0

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `CACHE_KEY_METADATA` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `CACHE_MANAGER` | variable / declared-runtime-value | referenced | 1 / 1 | — |
| `CACHE_MODULE_OPTIONS` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `CACHE_TTL_METADATA` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `Cache` | class / declared-runtime-value | pending | 0 / 0 | — |
| `CacheInterceptor` | class / declared-runtime-value | referenced | 1 / 1 | — |
| `CacheKey` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `CacheKeyFactory` | type-alias / type-only | pending | 0 / 0 | — |
| `CacheManagerOptions` | interface / type-only | pending | 0 / 0 | — |
| `CacheModule` | class / declared-runtime-value | referenced | 1 / 2 | — |
| `CacheModuleAsyncOptions` | interface / type-only | pending | 0 / 0 | — |
| `CacheModuleOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `CacheOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `CacheOptionsFactory` | interface / type-only | pending | 0 / 0 | — |
| `CacheTTL` | variable / declared-runtime-value | referenced | 1 / 1 | — |
| `CacheTTLFactory` | type-alias / type-only | pending | 0 / 0 | — |

### @nestjs/common 12.0.2

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `Abstract` | interface / type-only | pending | 0 / 0 | — |
| `All` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ArgumentMetadata` | interface / type-only | referenced | 1 / 2 | — |
| `ArgumentsHost` | interface / type-only | verified-case | 5 / 16 | `reflector-http-context` |
| `BadGatewayException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `BadRequestException` | class / declared-runtime-value | referenced | 6 / 9 | — |
| `BeforeApplicationShutdown` | interface / type-only | verified-case | 1 / 2 | `lifecycle-explicit-close` |
| `Bind` | function / declared-runtime-value | pending | 0 / 0 | — |
| `Body` | function / declared-runtime-value | referenced | 7 / 18 | — |
| `CallHandler` | interface / type-only | verified-case | 5 / 12 | `reflector-http-context` |
| `CanActivate` | interface / type-only | verified-case | 6 / 14 | `reflector-http-context` |
| `Catch` | function / declared-runtime-value | referenced | 5 / 5 | — |
| `ClassProvider` | interface / type-only | pending | 0 / 0 | — |
| `ClassSerializerContextOptions` | interface / type-only | pending | 0 / 0 | — |
| `ClassSerializerInterceptor` | class / declared-runtime-value | referenced | 4 / 4 | — |
| `ClassSerializerInterceptorOptions` | interface / type-only | pending | 0 / 0 | — |
| `ConfigurableModuleAsyncOptions` | interface / type-only | pending | 0 / 0 | — |
| `ConfigurableModuleBuilder` | class / declared-runtime-value | verified-case | 2 / 6 | `providers-async-and-alias`, `configuration-namespaced-provider` |
| `ConfigurableModuleBuilderOptions` | interface / type-only | pending | 0 / 0 | — |
| `ConfigurableModuleCls` | type-alias / type-only | pending | 0 / 0 | — |
| `ConfigurableModuleHost` | interface / type-only | pending | 0 / 0 | — |
| `ConfigurableModuleOptionsFactory` | type-alias / type-only | pending | 0 / 0 | — |
| `ConflictException` | class / declared-runtime-value | referenced | 4 / 8 | — |
| `ConsoleLogger` | class / declared-runtime-value | referenced | 1 / 1 | — |
| `ConsoleLoggerOptions` | interface / type-only | pending | 0 / 0 | — |
| `ContextType` | type-alias / type-only | pending | 0 / 0 | — |
| `Controller` | function / declared-runtime-value | referenced | 21 / 30 | — |
| `ControllerOptions` | interface / type-only | pending | 0 / 0 | — |
| `Copy` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `CustomDecorator` | type-alias / type-only | pending | 0 / 0 | — |
| `DefaultValuePipe` | class / declared-runtime-value | referenced | 2 / 6 | — |
| `Delete` | variable / declared-runtime-value | referenced | 1 / 2 | — |
| `Dependencies` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `DescriptionAndOptions` | interface / type-only | pending | 0 / 0 | — |
| `DynamicModule` | interface / type-only | referenced | 7 / 7 | — |
| `ExceptionFilter` | interface / type-only | referenced | 2 / 4 | — |
| `ExecutionContext` | interface / type-only | verified-case | 7 / 21 | `reflector-http-context` |
| `ExistingProvider` | interface / type-only | pending | 0 / 0 | — |
| `FactoryProvider` | interface / type-only | pending | 0 / 0 | — |
| `FileTypeValidator` | class / declared-runtime-value | pending | 0 / 0 | — |
| `FileTypeValidatorOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `FileValidator` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ForbiddenException` | class / declared-runtime-value | referenced | 3 / 3 | — |
| `ForwardReference` | interface / type-only | pending | 0 / 0 | — |
| `GatewayTimeoutException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `Get` | variable / declared-runtime-value | referenced | 21 / 64 | — |
| `Global` | function / declared-runtime-value | pending | 0 / 0 | — |
| `GoneException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `Head` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `Header` | function / declared-runtime-value | pending | 0 / 0 | — |
| `Headers` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `HostParam` | function / declared-runtime-value | pending | 0 / 0 | — |
| `HttpCode` | function / declared-runtime-value | referenced | 3 / 9 | — |
| `HttpException` | class / declared-runtime-value | referenced | 2 / 5 | — |
| `HttpExceptionBody` | interface / type-only | pending | 0 / 0 | — |
| `HttpExceptionBodyMessage` | type-alias / type-only | pending | 0 / 0 | — |
| `HttpExceptionOptions` | interface / type-only | pending | 0 / 0 | — |
| `HttpRedirectResponse` | interface / type-only | pending | 0 / 0 | — |
| `HttpServer` | interface / type-only | referenced | 0 / 2 | — |
| `HttpStatus` | enum / declared-runtime-value | referenced | 2 / 6 | — |
| `HttpVersionNotSupportedException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `INestApplication` | interface / type-only | verified-case | 6 / 161 | `lifecycle-explicit-close`, `uri-version-neutral-default-middleware`, `hybrid-shared-container` |
| `INestApplicationContext` | interface / type-only | verified-case | 1 / 78 | `lifecycle-explicit-close` |
| `INestMicroservice` | interface / type-only | verified-case | 2 / 14 | `microservice-request-event-hooks` |
| `ITransportServer` | interface / type-only | pending | 0 / 0 | — |
| `ImATeapotException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `Inject` | function / declared-runtime-value | verified-case | 16 / 29 | `providers-async-and-alias`, `inquirer-transient-consumer`, `optional-constructor-property-factory`, `nest12-optional-inheritance` |
| `Injectable` | function / declared-runtime-value | verified-case | 43 / 77 | `scope-context-resolution`, `durable-tenant-context` |
| `InjectableOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `InjectionToken` | type-alias / type-only | pending | 0 / 0 | — |
| `InternalServerErrorException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `IntrinsicException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `IntrospectionResult` | interface / type-only | pending | 0 / 0 | — |
| `Ip` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `LOG_LEVELS` | variable / declared-runtime-value | referenced | 0 / 242 | — |
| `Lock` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `LogLevel` | type-alias / type-only | pending | 0 / 0 | — |
| `Logger` | class / declared-runtime-value | referenced | 3 / 6 | — |
| `LoggerService` | interface / type-only | pending | 0 / 0 | — |
| `MaxFileSizeValidator` | class / declared-runtime-value | pending | 0 / 0 | — |
| `MaxFileSizeValidatorOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `MessageEvent` | interface / type-only | referenced | 1 / 1 | — |
| `MethodNotAllowedException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `MiddlewareConsumer` | interface / type-only | verified-case | 3 / 6 | `uri-version-neutral-default-middleware` |
| `MisdirectedException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `Mkcol` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `Module` | function / declared-runtime-value | verified-case | 36 / 47 | `providers-async-and-alias` |
| `ModuleMetadata` | interface / type-only | pending | 0 / 0 | — |
| `Move` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `NestApplicationOptions` | interface / type-only | pending | 0 / 0 | — |
| `NestHybridApplicationOptions` | interface / type-only | pending | 0 / 0 | — |
| `NestInterceptor` | interface / type-only | verified-case | 5 / 12 | `reflector-http-context` |
| `NestMiddleware` | interface / type-only | referenced | 2 / 4 | — |
| `NestModule` | interface / type-only | referenced | 3 / 6 | — |
| `Next` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `NotAcceptableException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `NotFoundException` | class / declared-runtime-value | referenced | 7 / 12 | — |
| `NotImplementedException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `OnApplicationBootstrap` | interface / type-only | verified-case | 1 / 2 | `lifecycle-explicit-close` |
| `OnApplicationShutdown` | interface / type-only | verified-case | 2 / 4 | `lifecycle-explicit-close` |
| `OnModuleDestroy` | interface / type-only | verified-case | 3 / 6 | `lifecycle-explicit-close` |
| `OnModuleInit` | interface / type-only | verified-case | 5 / 10 | `lifecycle-explicit-close` |
| `Optional` | function / declared-runtime-value | verified-case | 1 / 2 | `optional-constructor-property-factory`, `nest12-optional-inheritance` |
| `OptionalFactoryDependency` | type-alias / type-only | pending | 0 / 0 | — |
| `Options` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `Param` | function / declared-runtime-value | referenced | 6 / 29 | — |
| `ParamData` | type-alias / type-only | pending | 0 / 0 | — |
| `ParamDecoratorEnhancer` | type-alias / type-only | pending | 0 / 0 | — |
| `ParameterDecoratorOptions` | interface / type-only | pending | 0 / 0 | — |
| `Paramtype` | type-alias / type-only | pending | 0 / 0 | — |
| `ParseArrayOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `ParseArrayPipe` | class / declared-runtime-value | referenced | 1 / 1 | — |
| `ParseArrayPipeOptions` | interface / type-only | pending | 0 / 0 | — |
| `ParseBoolPipe` | class / declared-runtime-value | referenced | 1 / 1 | — |
| `ParseBoolPipeOptions` | interface / type-only | pending | 0 / 0 | — |
| `ParseDatePipe` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ParseDatePipeOptions` | interface / type-only | pending | 0 / 0 | — |
| `ParseEnumPipe` | class / declared-runtime-value | referenced | 1 / 1 | — |
| `ParseEnumPipeOptions` | interface / type-only | pending | 0 / 0 | — |
| `ParseFileOptions` | interface / type-only | pending | 0 / 0 | — |
| `ParseFilePipe` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ParseFilePipeBuilder` | class / declared-runtime-value | referenced | 1 / 3 | — |
| `ParseFloatPipe` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ParseFloatPipeOptions` | interface / type-only | pending | 0 / 0 | — |
| `ParseIntPipe` | class / declared-runtime-value | referenced | 2 / 3 | — |
| `ParseIntPipeOptions` | interface / type-only | pending | 0 / 0 | — |
| `ParseUUIDPipe` | class / declared-runtime-value | referenced | 3 / 25 | — |
| `ParseUUIDPipeOptions` | interface / type-only | pending | 0 / 0 | — |
| `Patch` | variable / declared-runtime-value | referenced | 1 / 2 | — |
| `PayloadTooLargeException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `PipeTransform` | interface / type-only | referenced | 1 / 4 | — |
| `PlainLiteralObject` | interface / type-only | pending | 0 / 0 | — |
| `Post` | variable / declared-runtime-value | referenced | 8 / 21 | — |
| `PreRequestHook` | interface / type-only | pending | 0 / 0 | — |
| `PreconditionFailedException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `Propfind` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `Proppatch` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `Provider` | type-alias / type-only | verified-case | 1 / 1 | `optional-constructor-property-factory` |
| `Put` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `Query` | function / declared-runtime-value | referenced | 3 / 7 | — |
| `QueryMethod` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `RawBody` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `RawBodyRequest` | type-alias / type-only | pending | 0 / 0 | — |
| `Redirect` | function / declared-runtime-value | pending | 0 / 0 | — |
| `Render` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `Req` | variable / declared-runtime-value | referenced | 3 / 5 | — |
| `Request` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `RequestMapping` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `RequestMappingMetadata` | interface / type-only | pending | 0 / 0 | — |
| `RequestMethod` | enum / declared-runtime-value | verified-case | 1 / 2 | `uri-version-neutral-default-middleware` |
| `RequestTimeoutException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `Res` | variable / declared-runtime-value | referenced | 1 / 1 | — |
| `Response` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ResponseDecoratorOptions` | interface / type-only | pending | 0 / 0 | — |
| `RouteConflictPolicy` | interface / type-only | pending | 0 / 0 | — |
| `RouteConflictPolicyLevel` | type-alias / type-only | pending | 0 / 0 | — |
| `RouteParamMetadata` | interface / type-only | pending | 0 / 0 | — |
| `RouteResolutionStrategy` | type-alias / type-only | pending | 0 / 0 | — |
| `RpcExceptionFilter` | interface / type-only | verified-case | 1 / 2 | `microservice-filter-and-stream` |
| `SSE_ABORT_CONTROLLER` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `Scope` | enum / declared-runtime-value | verified-case | 3 / 14 | `scope-context-resolution`, `inquirer-transient-consumer`, `durable-tenant-context` |
| `ScopeOptions` | interface / type-only | pending | 0 / 0 | — |
| `Search` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `SerializeOptions` | variable / declared-runtime-value | referenced | 1 / 1 | — |
| `ServiceUnavailableException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `Session` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `SetMetadata` | variable / declared-runtime-value | referenced | 1 / 1 | — |
| `ShutdownSignal` | enum / declared-runtime-value | pending | 0 / 0 | — |
| `Sse` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `SseSignal` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `StandardSchemaSerializerContextOptions` | interface / type-only | pending | 0 / 0 | — |
| `StandardSchemaSerializerInterceptor` | class / declared-runtime-value | referenced | 1 / 1 | — |
| `StandardSchemaSerializerInterceptorOptions` | interface / type-only | pending | 0 / 0 | — |
| `StandardSchemaValidationPipe` | class / declared-runtime-value | referenced | 2 / 4 | — |
| `StandardSchemaValidationPipeOptions` | interface / type-only | pending | 0 / 0 | — |
| `StreamableFile` | class / declared-runtime-value | referenced | 1 / 1 | — |
| `Type` | interface / type-only | referenced | 1 / 2 | — |
| `UnauthorizedException` | class / declared-runtime-value | referenced | 2 / 2 | — |
| `Unlock` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `UnprocessableEntityException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `UnsupportedMediaTypeException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `UploadedFile` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `UploadedFiles` | function / declared-runtime-value | pending | 0 / 0 | — |
| `UseFilters` | variable / declared-runtime-value | referenced | 5 / 7 | — |
| `UseGuards` | function / declared-runtime-value | referenced | 7 / 10 | — |
| `UseInterceptors` | function / declared-runtime-value | referenced | 7 / 12 | — |
| `UsePipes` | function / declared-runtime-value | referenced | 4 / 7 | — |
| `VERSION_NEUTRAL` | variable / declared-runtime-value | verified-case | 1 / 1 | `uri-version-neutral-default-middleware`, `header-version-neutral` |
| `ValidationError` | interface / type-only | pending | 0 / 0 | — |
| `ValidationErrorFormat` | type-alias / type-only | pending | 0 / 0 | — |
| `ValidationPipe` | class / declared-runtime-value | verified-case | 11 / 12 | `microservice-filter-and-stream` |
| `ValidationPipeOptions` | interface / type-only | pending | 0 / 0 | — |
| `ValueProvider` | interface / type-only | pending | 0 / 0 | — |
| `Version` | function / declared-runtime-value | verified-case | 3 / 9 | `uri-version-neutral-default-middleware` |
| `VersioningOptions` | type-alias / type-only | referenced | 2 / 2 | — |
| `VersioningType` | enum / declared-runtime-value | verified-case | 4 / 13 | `uri-version-neutral-default-middleware`, `header-version-neutral`, `fastify-custom-highest-version` |
| `WebSocketAdapter` | interface / type-only | pending | 0 / 0 | — |
| `WsExceptionFilter` | interface / type-only | referenced | 1 / 2 | — |
| `WsMessageHandler` | interface / type-only | pending | 0 / 0 | — |
| `applyDecorators` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `assignMetadata` | function / declared-runtime-value | pending | 0 / 0 | — |
| `createParamDecorator` | function / declared-runtime-value | referenced | 2 / 2 | — |
| `filterLogLevels` | function / declared-runtime-value | pending | 0 / 0 | — |
| `flatten` | function / declared-runtime-value | pending | 0 / 0 | — |
| `forwardRef` | variable / declared-runtime-value | verified-case | 1 / 2 | `provider-forward-reference` |
| `mixin` | function / declared-runtime-value | pending | 0 / 0 | — |
| `stripProtoKeys` | function / declared-runtime-value | pending | 0 / 0 | — |

### @nestjs/config 12.0.0

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `ConditionalModule` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ConfigChangeEvent` | interface / type-only | pending | 0 / 0 | — |
| `ConfigFactory` | type-alias / type-only | pending | 0 / 0 | — |
| `ConfigFactoryKeyHost` | interface / type-only | verified-case | 0 / 2 | `configuration-namespaced-provider` |
| `ConfigGetOptions` | interface / type-only | pending | 0 / 0 | — |
| `ConfigModule` | class / declared-runtime-value | verified-case | 4 / 7 | `configuration-namespaced-provider`, `configuration-env-precedence` |
| `ConfigModuleOptions` | interface / type-only | pending | 0 / 0 | — |
| `ConfigObject` | type-alias / type-only | pending | 0 / 0 | — |
| `ConfigService` | class / declared-runtime-value | verified-case | 7 / 27 | `configuration-env-precedence` |
| `ConfigType` | type-alias / type-only | verified-case | 1 / 1 | `configuration-namespaced-provider` |
| `NoInferType` | type-alias / type-only | pending | 0 / 0 | — |
| `Parser` | type-alias / type-only | pending | 0 / 0 | — |
| `Path` | type-alias / type-only | pending | 0 / 0 | — |
| `PathImpl` | type-alias / type-only | pending | 0 / 0 | — |
| `PathImpl2` | type-alias / type-only | pending | 0 / 0 | — |
| `PathValue` | type-alias / type-only | pending | 0 / 0 | — |
| `getConfigToken` | function / declared-runtime-value | pending | 0 / 0 | — |
| `getDefaultParser` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `registerAs` | function / declared-runtime-value | verified-case | 1 / 1 | `configuration-namespaced-provider` |

### @nestjs/core 12.0.2

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `APP_FILTER` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `APP_GUARD` | variable / declared-runtime-value | referenced | 1 / 1 | — |
| `APP_INTERCEPTOR` | variable / declared-runtime-value | referenced | 1 / 1 | — |
| `APP_PIPE` | variable / declared-runtime-value | referenced | 1 / 1 | — |
| `AbstractHttpAdapter` | class / declared-runtime-value | referenced | 0 / 3 | — |
| `ApplicationConfig` | class / declared-runtime-value | pending | 0 / 0 | — |
| `BaseExceptionFilter` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ConflictKind` | type-alias / type-only | pending | 0 / 0 | — |
| `ContextId` | interface / type-only | referenced | 1 / 2 | — |
| `ContextIdFactory` | class / declared-runtime-value | verified-case | 4 / 12 | `scope-context-resolution`, `durable-tenant-context` |
| `ContextIdResolver` | interface / type-only | pending | 0 / 0 | — |
| `ContextIdResolverFn` | type-alias / type-only | pending | 0 / 0 | — |
| `ContextIdStrategy` | interface / type-only | verified-case | 1 / 4 | `durable-tenant-context` |
| `CreateDecoratorOptions` | interface / type-only | pending | 0 / 0 | — |
| `DiscoverableDecorator` | type-alias / type-only | pending | 0 / 0 | — |
| `DiscoveryModule` | class / declared-runtime-value | referenced | 1 / 1 | — |
| `DiscoveryOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `DiscoveryService` | class / declared-runtime-value | verified-case | 2 / 6 | `discovery-decorator` |
| `ExternalContextCreator` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ExternalContextOptions` | interface / type-only | pending | 0 / 0 | — |
| `FilterByInclude` | interface / type-only | pending | 0 / 0 | — |
| `FilterByMetadataKey` | interface / type-only | pending | 0 / 0 | — |
| `GraphInspector` | class / declared-runtime-value | referenced | 1 / 4 | — |
| `HostComponentInfo` | interface / type-only | verified-case | 1 / 2 | `durable-tenant-context` |
| `HttpAdapterHost` | class / declared-runtime-value | referenced | 1 / 2 | — |
| `IEntryNestModule` | type-alias / type-only | pending | 0 / 0 | — |
| `INQUIRER` | variable / declared-runtime-value | verified-case | 1 / 1 | `inquirer-transient-consumer` |
| `InitializeOnPreviewAllowlist` | class / declared-runtime-value | pending | 0 / 0 | — |
| `LazyModuleLoader` | class / declared-runtime-value | verified-case | 1 / 2 | `lazy-module-cache` |
| `MetadataScanner` | class / declared-runtime-value | pending | 0 / 0 | — |
| `MiddlewareBuilder` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ModuleRef` | class / declared-runtime-value | verified-case | 1 / 13 | `scope-context-resolution` |
| `ModuleRefGetOrResolveOpts` | interface / type-only | pending | 0 / 0 | — |
| `ModulesContainer` | class / declared-runtime-value | referenced | 1 / 1 | — |
| `NestApplication` | class / declared-runtime-value | pending | 0 / 0 | — |
| `NestApplicationContext` | class / declared-runtime-value | referenced | 0 / 13 | — |
| `NestContainer` | class / declared-runtime-value | referenced | 1 / 2 | — |
| `NestFactory` | variable / declared-runtime-value | verified-case | 27 / 72 | `microservice-request-event-hooks`, `hybrid-shared-container` |
| `ParamsFactory` | interface / type-only | pending | 0 / 0 | — |
| `PartialGraphHost` | class / declared-runtime-value | pending | 0 / 0 | — |
| `REQUEST` | variable / declared-runtime-value | verified-case | 3 / 3 | `scope-context-resolution`, `durable-tenant-context` |
| `ReflectableDecorator` | type-alias / type-only | pending | 0 / 0 | — |
| `Reflector` | class / declared-runtime-value | verified-case | 5 / 11 | `reflector-http-context` |
| `ResolvedRoute` | interface / type-only | pending | 0 / 0 | — |
| `ResolvedRouteHandler` | type-alias / type-only | pending | 0 / 0 | — |
| `RouteConflict` | interface / type-only | pending | 0 / 0 | — |
| `RouteResolutionOptions` | interface / type-only | pending | 0 / 0 | — |
| `RouteTree` | interface / type-only | pending | 0 / 0 | — |
| `RouterModule` | class / declared-runtime-value | referenced | 1 / 2 | — |
| `Routes` | type-alias / type-only | pending | 0 / 0 | — |
| `SerializedGraph` | class / declared-runtime-value | referenced | 1 / 3 | — |
| `SerializedGraphStatus` | type-alias / type-only | pending | 0 / 0 | — |
| `createContextId` | function / declared-runtime-value | pending | 0 / 0 | — |
| `repl` | function / declared-runtime-value | referenced | 1 / 1 | — |

### @nestjs/cqrs 12.0.0

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `ASYNC_CONTEXT_ATTRIBUTE` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `AbstractConstructor` | type-alias / type-only | pending | 0 / 0 | — |
| `AggregateRoot` | class / declared-runtime-value | pending | 0 / 0 | — |
| `AsyncContext` | class / declared-runtime-value | pending | 0 / 0 | — |
| `Command` | class / declared-runtime-value | referenced | 1 / 1 | — |
| `CommandBus` | class / declared-runtime-value | referenced | 1 / 2 | — |
| `CommandHandler` | variable / declared-runtime-value | referenced | 1 / 1 | — |
| `CommandHandlerNotFoundException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `CommandHandlerType` | type-alias / type-only | pending | 0 / 0 | — |
| `CommandResult` | type-alias / type-only | pending | 0 / 0 | — |
| `Constructor` | interface / type-only | pending | 0 / 0 | — |
| `CqrsModule` | class / declared-runtime-value | referenced | 1 / 2 | — |
| `CqrsModuleAsyncOptions` | interface / type-only | pending | 0 / 0 | — |
| `CqrsModuleOptions` | interface / type-only | pending | 0 / 0 | — |
| `CqrsModuleOptionsFactory` | interface / type-only | pending | 0 / 0 | — |
| `EventBus` | class / declared-runtime-value | referenced | 1 / 2 | — |
| `EventHandlerType` | type-alias / type-only | pending | 0 / 0 | — |
| `EventIdProvider` | interface / type-only | pending | 0 / 0 | — |
| `EventOperator` | type-alias / type-only | pending | 0 / 0 | — |
| `EventPublisher` | class / declared-runtime-value | pending | 0 / 0 | — |
| `EventsHandler` | variable / declared-runtime-value | referenced | 1 / 1 | — |
| `IAggregateRoot` | interface / type-only | pending | 0 / 0 | — |
| `ICommand` | interface / type-only | pending | 0 / 0 | — |
| `ICommandBus` | interface / type-only | pending | 0 / 0 | — |
| `ICommandHandler` | type-alias / type-only | referenced | 1 / 1 | — |
| `ICommandPublisher` | interface / type-only | pending | 0 / 0 | — |
| `IEvent` | interface / type-only | referenced | 1 / 1 | — |
| `IEventBus` | interface / type-only | pending | 0 / 0 | — |
| `IEventHandler` | interface / type-only | referenced | 1 / 2 | — |
| `IEventPublisher` | interface / type-only | pending | 0 / 0 | — |
| `IMessageSource` | interface / type-only | pending | 0 / 0 | — |
| `IQuery` | interface / type-only | pending | 0 / 0 | — |
| `IQueryBus` | interface / type-only | pending | 0 / 0 | — |
| `IQueryHandler` | type-alias / type-only | referenced | 1 / 1 | — |
| `IQueryPublisher` | interface / type-only | pending | 0 / 0 | — |
| `IQueryResult` | interface / type-only | pending | 0 / 0 | — |
| `ISaga` | type-alias / type-only | pending | 0 / 0 | — |
| `IUnhandledExceptionPublisher` | interface / type-only | pending | 0 / 0 | — |
| `InvalidCommandHandlerException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `InvalidEventsHandlerException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `InvalidQueryHandlerException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `InvalidSagaException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ObservableBus` | class / declared-runtime-value | pending | 0 / 0 | — |
| `Publishable` | function / declared-runtime-value | pending | 0 / 0 | — |
| `Query` | class / declared-runtime-value | referenced | 1 / 1 | — |
| `QueryBus` | class / declared-runtime-value | referenced | 1 / 2 | — |
| `QueryHandler` | variable / declared-runtime-value | referenced | 1 / 1 | — |
| `QueryHandlerNotFoundException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `QueryHandlerType` | type-alias / type-only | pending | 0 / 0 | — |
| `QueryResult` | type-alias / type-only | pending | 0 / 0 | — |
| `Saga` | variable / declared-runtime-value | referenced | 1 / 1 | — |
| `UnhandledExceptionBus` | class / declared-runtime-value | pending | 0 / 0 | — |
| `UnhandledExceptionInfo` | interface / type-only | pending | 0 / 0 | — |
| `UnsupportedSagaScopeException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `WithAggregateRoot` | function / declared-runtime-value | pending | 0 / 0 | — |
| `ofType` | function / declared-runtime-value | referenced | 1 / 1 | — |

### @nestjs/devtools-integration 12.0.0

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `DevtoolsModule` | class / declared-runtime-value | referenced | 1 / 1 | — |
| `GraphPublisher` | class / declared-runtime-value | pending | 0 / 0 | — |
| `PublishGraphOptions` | type-alias / type-only | pending | 0 / 0 | — |

### @nestjs/event-emitter 12.0.1

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `EVENT_LISTENER_METADATA` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `EVENT_PAYLOAD` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `EventEmitter2` | type-alias / declared-runtime-value | referenced | 1 / 1 | — |
| `EventEmitterModule` | class / declared-runtime-value | referenced | 1 / 2 | — |
| `EventEmitterModuleOptions` | interface / type-only | pending | 0 / 0 | — |
| `EventEmitterReadinessWatcher` | class / declared-runtime-value | pending | 0 / 0 | — |
| `EventPayloadHost` | type-alias / type-only | pending | 0 / 0 | — |
| `OnEvent` | variable / declared-runtime-value | referenced | 1 / 1 | — |
| `OnEventMetadata` | interface / type-only | pending | 0 / 0 | — |
| `OnEventOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `OnEventType` | type-alias / type-only | pending | 0 / 0 | — |

### @nestjs/graphql 14.0.0

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `ARGS_TYPE_METADATA` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `AbstractGraphQLDriver` | class / declared-runtime-value | pending | 0 / 0 | — |
| `AliasDirectiveImport` | interface / type-only | pending | 0 / 0 | — |
| `Args` | function / declared-runtime-value | referenced | 3 / 11 | — |
| `ArgsOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `ArgsType` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `ArgsTypeOptions` | interface / type-only | pending | 0 / 0 | — |
| `ArrayElement` | type-alias / type-only | pending | 0 / 0 | — |
| `AutoSchemaFileValue` | type-alias / type-only | pending | 0 / 0 | — |
| `BaseExplorerService` | class / declared-runtime-value | pending | 0 / 0 | — |
| `BaseTypeOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `BuildFederatedSchemaOptions` | interface / type-only | pending | 0 / 0 | — |
| `BuildSchemaOptions` | interface / type-only | pending | 0 / 0 | — |
| `CLASS_TYPE_METADATA` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `CONTEXT` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `Complexity` | type-alias / type-only | pending | 0 / 0 | — |
| `ComplexityEstimator` | type-alias / type-only | pending | 0 / 0 | — |
| `ComplexityEstimatorArgs` | type-alias / type-only | pending | 0 / 0 | — |
| `Context` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `CustomScalar` | interface / type-only | referenced | 1 / 5 | — |
| `DEFINITIONS_FILE_HEADER` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `DateScalarMode` | type-alias / type-only | pending | 0 / 0 | — |
| `DefinitionsGeneratorOptions` | interface / type-only | pending | 0 / 0 | — |
| `Directive` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `Enhancer` | type-alias / type-only | pending | 0 / 0 | — |
| `EnumOptions` | interface / type-only | pending | 0 / 0 | — |
| `Extensions` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `FIELD_RESOLVER_MIDDLEWARE_METADATA` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `FIELD_TYPENAME` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `Federation2Config` | interface / type-only | pending | 0 / 0 | — |
| `FederationConfig` | type-alias / type-only | pending | 0 / 0 | — |
| `FederationVersion` | type-alias / type-only | pending | 0 / 0 | — |
| `Field` | function / declared-runtime-value | referenced | 2 / 20 | — |
| `FieldMiddleware` | interface / type-only | referenced | 1 / 2 | — |
| `FieldOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `FieldType` | type-alias / type-only | pending | 0 / 0 | — |
| `FileSystemHelper` | class / declared-runtime-value | pending | 0 / 0 | — |
| `Float` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `GRAPHQL_MODULE_ID` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `GRAPHQL_MODULE_OPTIONS` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `GRAPHQL_SDL_FILE_END` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `GRAPHQL_SDL_FILE_HEADER` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `GenerateOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `GqlArgumentsHost` | class / declared-runtime-value | referenced | 1 / 3 | — |
| `GqlContextType` | type-alias / type-only | pending | 0 / 0 | — |
| `GqlExceptionFilter` | interface / type-only | referenced | 1 / 2 | — |
| `GqlExecutionContext` | class / declared-runtime-value | referenced | 1 / 9 | — |
| `GqlModuleAsyncOptions` | interface / type-only | pending | 0 / 0 | — |
| `GqlModuleOptions` | interface / type-only | pending | 0 / 0 | — |
| `GqlOptionsFactory` | interface / type-only | pending | 0 / 0 | — |
| `GqlRequestEndHook` | type-alias / type-only | pending | 0 / 0 | — |
| `GqlRequestEndHookContext` | interface / type-only | pending | 0 / 0 | — |
| `GqlRequestStartHook` | type-alias / type-only | pending | 0 / 0 | — |
| `GqlRequestStartHookContext` | interface / type-only | pending | 0 / 0 | — |
| `GqlSubscriptionService` | class / declared-runtime-value | pending | 0 / 0 | — |
| `GqlSubscriptionServiceOptions` | interface / type-only | pending | 0 / 0 | — |
| `GqlTypeReference` | type-alias / type-only | pending | 0 / 0 | — |
| `GraphQLArgumentsHost` | interface / type-only | pending | 0 / 0 | — |
| `GraphQLAstExplorer` | class / declared-runtime-value | pending | 0 / 0 | — |
| `GraphQLDefinitionsFactory` | class / declared-runtime-value | referenced | 1 / 2 | — |
| `GraphQLDriver` | interface / type-only | pending | 0 / 0 | — |
| `GraphQLExecutionContext` | type-alias / type-only | pending | 0 / 0 | — |
| `GraphQLFactory` | class / declared-runtime-value | pending | 0 / 0 | — |
| `GraphQLFederationDefinitionsFactory` | class / declared-runtime-value | pending | 0 / 0 | — |
| `GraphQLFederationFactory` | class / declared-runtime-value | pending | 0 / 0 | — |
| `GraphQLISODateTime` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `GraphQLModule` | class / declared-runtime-value | referenced | 3 / 10 | — |
| `GraphQLSchemaBuilderModule` | class / declared-runtime-value | referenced | 2 / 2 | — |
| `GraphQLSchemaFactory` | class / declared-runtime-value | referenced | 2 / 4 | — |
| `GraphQLSchemaHost` | class / declared-runtime-value | referenced | 2 / 5 | — |
| `GraphQLTimestamp` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `GraphQLTypesLoader` | class / declared-runtime-value | pending | 0 / 0 | — |
| `GraphQLWsSubscriptionsConfig` | type-alias / type-only | pending | 0 / 0 | — |
| `HideField` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `ID` | variable / declared-runtime-value | referenced | 2 / 7 | — |
| `Info` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `InputType` | function / declared-runtime-value | referenced | 1 / 5 | — |
| `InputTypeOptions` | interface / type-only | pending | 0 / 0 | — |
| `Int` | variable / declared-runtime-value | referenced | 1 / 3 | — |
| `InterfaceType` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `InterfaceTypeOptions` | interface / type-only | pending | 0 / 0 | — |
| `IntersectionType` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `MiddlewareContext` | interface / type-only | referenced | 0 / 2 | — |
| `Mutation` | function / declared-runtime-value | referenced | 2 / 3 | — |
| `MutationOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `NextFn` | type-alias / type-only | pending | 0 / 0 | — |
| `NullableList` | type-alias / type-only | pending | 0 / 0 | — |
| `NumberScalarMode` | type-alias / type-only | pending | 0 / 0 | — |
| `ObjectType` | function / declared-runtime-value | referenced | 2 / 5 | — |
| `ObjectTypeOptions` | interface / type-only | pending | 0 / 0 | — |
| `OmitType` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `PARAM_ARGS_METADATA` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `Parent` | variable / declared-runtime-value | referenced | 3 / 5 | — |
| `PartialType` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `PickType` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `Query` | function / declared-runtime-value | referenced | 4 / 14 | — |
| `QueryOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `RESOLVER_DELEGATE_METADATA` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `RESOLVER_NAME_METADATA` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `RESOLVER_PROPERTY_METADATA` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `RESOLVER_REFERENCE_KEY` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `RESOLVER_REFERENCE_METADATA` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `RESOLVER_TYPE_METADATA` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ResolveField` | function / declared-runtime-value | referenced | 3 / 5 | — |
| `ResolveFieldOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `ResolveProperty` | function / declared-runtime-value | pending | 0 / 0 | — |
| `ResolveReference` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `ResolveTypeFn` | type-alias / type-only | pending | 0 / 0 | — |
| `Resolver` | function / declared-runtime-value | referenced | 4 / 7 | — |
| `ResolverDecoratorHost` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ResolverOptions` | interface / type-only | pending | 0 / 0 | — |
| `ResolverTypeFn` | type-alias / type-only | pending | 0 / 0 | — |
| `ReturnTypeFunc` | type-alias / type-only | pending | 0 / 0 | — |
| `ReturnTypeFuncValue` | type-alias / type-only | pending | 0 / 0 | — |
| `Root` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `SCALAR_NAME_METADATA` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `SCALAR_TYPE_METADATA` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `SUBSCRIPTION_OPTIONS_METADATA` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `SUBSCRIPTION_TYPE` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `Scalar` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `ScalarsTypeMap` | interface / type-only | pending | 0 / 0 | — |
| `SchemaFileConfig` | interface / type-only | pending | 0 / 0 | — |
| `Subscription` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `SubscriptionConfig` | type-alias / type-only | pending | 0 / 0 | — |
| `SubscriptionOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `TypeMetadataStorage` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `Union` | type-alias / type-only | pending | 0 / 0 | — |
| `UnionOptions` | interface / type-only | pending | 0 / 0 | — |
| `addFieldMetadata` | function / declared-runtime-value | pending | 0 / 0 | — |
| `createUnionType` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `extend` | function / declared-runtime-value | pending | 0 / 0 | — |
| `registerEnumType` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `transformSchema` | function / declared-runtime-value | pending | 0 / 0 | — |

### @nestjs/jwt 12.0.2

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `GetSecretKeyResult` | type-alias / type-only | pending | 0 / 0 | — |
| `JsonWebTokenError` | type-alias / declared-runtime-value | pending | 0 / 0 | — |
| `JwtModule` | class / declared-runtime-value | referenced | 1 / 3 | — |
| `JwtModuleAsyncOptions` | interface / type-only | pending | 0 / 0 | — |
| `JwtModuleOptions` | interface / type-only | pending | 0 / 0 | — |
| `JwtOptionsFactory` | interface / type-only | pending | 0 / 0 | — |
| `JwtSecretRequestType` | enum / declared-runtime-value | pending | 0 / 0 | — |
| `JwtService` | class / declared-runtime-value | referenced | 1 / 2 | — |
| `JwtSignOptions` | interface / type-only | pending | 0 / 0 | — |
| `JwtVerifyOptions` | interface / type-only | pending | 0 / 0 | — |
| `NotBeforeError` | type-alias / declared-runtime-value | pending | 0 / 0 | — |
| `TokenExpiredError` | type-alias / declared-runtime-value | pending | 0 / 0 | — |
| `WrongSecretProviderError` | class / declared-runtime-value | pending | 0 / 0 | — |

### @nestjs/mapped-types 12.0.0

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `IntersectionType` | function / declared-runtime-value | pending | 0 / 0 | — |
| `MappedType` | interface / type-only | pending | 0 / 0 | — |
| `OmitType` | function / declared-runtime-value | pending | 0 / 0 | — |
| `PartialType` | function / declared-runtime-value | pending | 0 / 0 | — |
| `PickType` | function / declared-runtime-value | pending | 0 / 0 | — |
| `applyIsOptionalDecorator` | function / declared-runtime-value | pending | 0 / 0 | — |
| `applyValidateIfDefinedDecorator` | function / declared-runtime-value | pending | 0 / 0 | — |
| `inheritPropertyInitializers` | function / declared-runtime-value | pending | 0 / 0 | — |
| `inheritTransformationMetadata` | function / declared-runtime-value | pending | 0 / 0 | — |
| `inheritValidationMetadata` | function / declared-runtime-value | pending | 0 / 0 | — |

### @nestjs/mercurius 14.0.0

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `MercuriusDriver` | class / declared-runtime-value | referenced | 1 / 1 | — |
| `MercuriusDriverAsyncConfig` | type-alias / type-only | pending | 0 / 0 | — |
| `MercuriusDriverConfig` | type-alias / type-only | referenced | 1 / 1 | — |
| `MercuriusDriverConfigFactory` | type-alias / type-only | pending | 0 / 0 | — |
| `MercuriusFederationDriver` | class / declared-runtime-value | pending | 0 / 0 | — |
| `MercuriusFederationDriverAsyncConfig` | type-alias / type-only | pending | 0 / 0 | — |
| `MercuriusFederationDriverConfig` | type-alias / type-only | pending | 0 / 0 | — |
| `MercuriusFederationDriverConfigFactory` | type-alias / type-only | pending | 0 / 0 | — |
| `MercuriusGatewayDriver` | class / declared-runtime-value | pending | 0 / 0 | — |
| `MercuriusGatewayDriverAsyncConfig` | type-alias / type-only | pending | 0 / 0 | — |
| `MercuriusGatewayDriverConfig` | type-alias / type-only | pending | 0 / 0 | — |
| `MercuriusGatewayDriverConfigFactory` | type-alias / type-only | pending | 0 / 0 | — |
| `MercuriusPlugin` | interface / type-only | pending | 0 / 0 | — |
| `MercuriusPlugins` | interface / type-only | pending | 0 / 0 | — |

### @nestjs/microservices 12.0.2

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `AsyncMicroserviceOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `AsyncOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `BaseRpcContext` | class / declared-runtime-value | referenced | 1 / 1 | — |
| `BaseRpcExceptionFilter` | class / declared-runtime-value | pending | 0 / 0 | — |
| `CONTEXT` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `Client` | function / declared-runtime-value | pending | 0 / 0 | — |
| `ClientGrpc` | interface / type-only | verified-case | 1 / 2 | `grpc-four-call-modes` |
| `ClientGrpcProxy` | class / declared-runtime-value | referenced | 0 / 1 | — |
| `ClientKafka` | class / declared-runtime-value | referenced | 1 / 2 | — |
| `ClientKafkaProxy` | interface / type-only | pending | 0 / 0 | — |
| `ClientMqtt` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ClientNats` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ClientOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `ClientProvider` | type-alias / type-only | pending | 0 / 0 | — |
| `ClientProviderOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `ClientProxy` | class / declared-runtime-value | verified-case | 2 / 18 | `microservice-request-event-hooks` |
| `ClientProxyFactory` | class / declared-runtime-value | verified-case | 2 / 8 | `microservice-request-event-hooks` |
| `ClientRMQ` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ClientRedis` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ClientTCP` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ClientsModule` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ClientsModuleAsyncOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `ClientsModuleOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `ClientsModuleOptionsFactory` | interface / type-only | pending | 0 / 0 | — |
| `ClientsProviderAsyncOptions` | interface / type-only | pending | 0 / 0 | — |
| `ConsumerDeserializer` | type-alias / type-only | pending | 0 / 0 | — |
| `ConsumerSerializer` | type-alias / type-only | pending | 0 / 0 | — |
| `Ctx` | variable / declared-runtime-value | referenced | 1 / 2 | — |
| `CustomClientOptions` | interface / type-only | pending | 0 / 0 | — |
| `CustomStrategy` | interface / type-only | pending | 0 / 0 | — |
| `CustomTransportStrategy` | interface / type-only | referenced | 1 / 3 | — |
| `Deserializer` | interface / type-only | pending | 0 / 0 | — |
| `EventDataMethodDecorator` | type-alias / type-only | pending | 0 / 0 | — |
| `EventPattern` | variable / declared-runtime-value | verified-case | 1 / 1 | `microservice-request-event-hooks` |
| `GrpcAbortedException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `GrpcAlreadyExistsException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `GrpcCancelledException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `GrpcDataLossException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `GrpcDeadlineExceededException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `GrpcException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `GrpcExceptionBody` | interface / type-only | pending | 0 / 0 | — |
| `GrpcExceptionFilter` | class / declared-runtime-value | pending | 0 / 0 | — |
| `GrpcFailedPreconditionException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `GrpcInternalException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `GrpcInvalidArgumentException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `GrpcMethod` | function / declared-runtime-value | verified-case | 1 / 2 | `grpc-four-call-modes` |
| `GrpcMethodStreamingType` | enum / declared-runtime-value | pending | 0 / 0 | — |
| `GrpcNotFoundException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `GrpcOptions` | interface / type-only | pending | 0 / 0 | — |
| `GrpcOutOfRangeException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `GrpcPermissionDeniedException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `GrpcResourceExhaustedException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `GrpcService` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `GrpcStatus` | enum / declared-runtime-value | pending | 0 / 0 | — |
| `GrpcStreamCall` | function / declared-runtime-value | pending | 0 / 0 | — |
| `GrpcStreamMethod` | function / declared-runtime-value | verified-case | 1 / 2 | `grpc-four-call-modes` |
| `GrpcUnauthenticatedException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `GrpcUnavailableException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `GrpcUnimplementedException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `GrpcUnknownException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `IncomingEvent` | type-alias / type-only | pending | 0 / 0 | — |
| `IncomingRequest` | type-alias / type-only | pending | 0 / 0 | — |
| `IncomingResponse` | type-alias / type-only | pending | 0 / 0 | — |
| `JsonSocket` | class / declared-runtime-value | pending | 0 / 0 | — |
| `JsonSocketOptions` | interface / type-only | pending | 0 / 0 | — |
| `KafkaContext` | class / declared-runtime-value | referenced | 1 / 5 | — |
| `KafkaHeaders` | enum / declared-runtime-value | pending | 0 / 0 | — |
| `KafkaLogger` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `KafkaOptions` | interface / type-only | referenced | 1 / 3 | — |
| `KafkaParser` | class / declared-runtime-value | pending | 0 / 0 | — |
| `KafkaParserConfig` | interface / type-only | pending | 0 / 0 | — |
| `KafkaReplyPartitionAssigner` | class / declared-runtime-value | pending | 0 / 0 | — |
| `KafkaRetriableException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `KafkaStatus` | enum / declared-runtime-value | pending | 0 / 0 | — |
| `MessageHandler` | interface / type-only | pending | 0 / 0 | — |
| `MessagePattern` | variable / declared-runtime-value | verified-case | 1 / 3 | `microservice-request-event-hooks` |
| `MicroserviceOptions` | type-alias / type-only | referenced | 2 / 4 | — |
| `MqttContext` | class / declared-runtime-value | referenced | 1 / 1 | — |
| `MqttEvents` | type-alias / type-only | pending | 0 / 0 | — |
| `MqttOptions` | interface / type-only | referenced | 1 / 5 | — |
| `MqttRecord` | class / declared-runtime-value | pending | 0 / 0 | — |
| `MqttRecordBuilder` | class / declared-runtime-value | pending | 0 / 0 | — |
| `MqttRecordOptions` | interface / type-only | pending | 0 / 0 | — |
| `MqttStatus` | enum / declared-runtime-value | pending | 0 / 0 | — |
| `MsFundamentalPattern` | type-alias / type-only | pending | 0 / 0 | — |
| `MsObjectPattern` | interface / type-only | pending | 0 / 0 | — |
| `MsPattern` | type-alias / type-only | pending | 0 / 0 | — |
| `MsPatternMatch` | type-alias / type-only | pending | 0 / 0 | — |
| `NatsContext` | class / declared-runtime-value | referenced | 1 / 1 | — |
| `NatsEvents` | type-alias / type-only | pending | 0 / 0 | — |
| `NatsOptions` | interface / type-only | referenced | 1 / 3 | — |
| `NatsRecord` | class / declared-runtime-value | pending | 0 / 0 | — |
| `NatsRecordBuilder` | class / declared-runtime-value | pending | 0 / 0 | — |
| `NatsStatus` | enum / declared-runtime-value | pending | 0 / 0 | — |
| `NestMicroservice` | class / declared-runtime-value | pending | 0 / 0 | — |
| `OutgoingEvent` | type-alias / type-only | pending | 0 / 0 | — |
| `OutgoingRequest` | type-alias / type-only | pending | 0 / 0 | — |
| `OutgoingResponse` | type-alias / type-only | pending | 0 / 0 | — |
| `PacketId` | interface / type-only | pending | 0 / 0 | — |
| `PatternMetadata` | type-alias / type-only | pending | 0 / 0 | — |
| `Payload` | function / declared-runtime-value | referenced | 1 / 3 | — |
| `ProducerDeserializer` | type-alias / type-only | pending | 0 / 0 | — |
| `ProducerSerializer` | type-alias / type-only | pending | 0 / 0 | — |
| `ReadPacket` | interface / type-only | referenced | 1 / 6 | — |
| `RedisContext` | class / declared-runtime-value | referenced | 1 / 1 | — |
| `RedisEvents` | type-alias / type-only | pending | 0 / 0 | — |
| `RedisOptions` | interface / type-only | referenced | 1 / 3 | — |
| `RedisStatus` | enum / declared-runtime-value | pending | 0 / 0 | — |
| `RequestContext` | interface / type-only | pending | 0 / 0 | — |
| `RmqContext` | class / declared-runtime-value | referenced | 1 / 3 | — |
| `RmqEvents` | type-alias / type-only | pending | 0 / 0 | — |
| `RmqOptions` | interface / type-only | referenced | 1 / 5 | — |
| `RmqRecord` | class / declared-runtime-value | pending | 0 / 0 | — |
| `RmqRecordBuilder` | class / declared-runtime-value | pending | 0 / 0 | — |
| `RmqRecordOptions` | interface / type-only | pending | 0 / 0 | — |
| `RmqStatus` | enum / declared-runtime-value | pending | 0 / 0 | — |
| `RpcException` | class / declared-runtime-value | verified-case | 1 / 6 | `microservice-filter-and-stream` |
| `Serializer` | interface / type-only | pending | 0 / 0 | — |
| `Server` | class / declared-runtime-value | referenced | 1 / 4 | — |
| `ServerGrpc` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ServerKafka` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ServerMqtt` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ServerNats` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ServerRMQ` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ServerRedis` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ServerTCP` | class / declared-runtime-value | pending | 0 / 0 | — |
| `TcpClientOptions` | interface / type-only | pending | 0 / 0 | — |
| `TcpContext` | class / declared-runtime-value | referenced | 1 / 1 | — |
| `TcpEvents` | type-alias / type-only | pending | 0 / 0 | — |
| `TcpOptions` | interface / type-only | pending | 0 / 0 | — |
| `TcpSocket` | class / declared-runtime-value | pending | 0 / 0 | — |
| `TcpStatus` | enum / declared-runtime-value | pending | 0 / 0 | — |
| `Transport` | enum / declared-runtime-value | verified-case | 2 / 26 | `microservice-request-event-hooks`, `grpc-four-call-modes` |
| `TransportId` | type-alias / type-only | pending | 0 / 0 | — |
| `WritePacket` | interface / type-only | referenced | 1 / 3 | — |
| `createGrpcMethodMetadata` | function / declared-runtime-value | pending | 0 / 0 | — |
| `getGrpcPackageDefinition` | function / declared-runtime-value | pending | 0 / 0 | — |

### @nestjs/mongoose 12.0.0

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `AsyncModelFactory` | interface / type-only | pending | 0 / 0 | — |
| `CannotDetermineTypeError` | class / declared-runtime-value | pending | 0 / 0 | — |
| `DefinitionsFactory` | class / declared-runtime-value | pending | 0 / 0 | — |
| `DiscriminatorOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `InjectConnection` | variable / declared-runtime-value | referenced | 1 / 1 | — |
| `InjectModel` | variable / declared-runtime-value | referenced | 1 / 2 | — |
| `IsObjectIdPipe` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ModelDefinition` | type-alias / type-only | pending | 0 / 0 | — |
| `MongooseModule` | class / declared-runtime-value | referenced | 1 / 4 | — |
| `MongooseModuleAsyncOptions` | interface / type-only | pending | 0 / 0 | — |
| `MongooseModuleFactoryOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `MongooseModuleOptions` | interface / type-only | pending | 0 / 0 | — |
| `MongooseOptionsFactory` | interface / type-only | pending | 0 / 0 | — |
| `ParseObjectIdPipe` | class / declared-runtime-value | pending | 0 / 0 | — |
| `Prop` | function / declared-runtime-value | referenced | 1 / 7 | — |
| `PropOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `Schema` | function / declared-runtime-value | referenced | 1 / 3 | — |
| `SchemaFactory` | class / declared-runtime-value | referenced | 1 / 6 | — |
| `SchemaOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `Virtual` | function / declared-runtime-value | pending | 0 / 0 | — |
| `VirtualOptions` | interface / type-only | pending | 0 / 0 | — |
| `VirtualsFactory` | class / declared-runtime-value | pending | 0 / 0 | — |
| `getConnectionToken` | function / declared-runtime-value | pending | 0 / 0 | — |
| `getModelToken` | function / declared-runtime-value | pending | 0 / 0 | — |
| `raw` | function / declared-runtime-value | pending | 0 / 0 | — |

### @nestjs/observe 0.2.0

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `CALLER_METADATA_KEY` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `Counter` | class / declared-runtime-value | referenced | 1 / 2 | — |
| `CreateObserveModuleOptions` | interface / type-only | pending | 0 / 0 | — |
| `CustomMetric` | interface / type-only | pending | 0 / 0 | — |
| `Gauge` | class / declared-runtime-value | referenced | 1 / 3 | — |
| `GaugeKind` | type-alias / type-only | pending | 0 / 0 | — |
| `GraphQLResolveInfoLike` | interface / type-only | pending | 0 / 0 | — |
| `JobSnapshot` | interface / type-only | pending | 0 / 0 | — |
| `KeyOf` | type-alias / type-only | pending | 0 / 0 | — |
| `MAX_SERIES_PER_METRIC` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `NodeRuntimeMetrics` | interface / type-only | pending | 0 / 0 | — |
| `OBSERVE_OPTIONS` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ObserveModuleAsyncOptions` | interface / type-only | pending | 0 / 0 | — |
| `ObserveModuleOptionsWithDefaults` | type-alias / type-only | pending | 0 / 0 | — |
| `ObserveOptions` | interface / type-only | referenced | 1 / 1 | — |
| `ObserveOptionsFactory` | interface / type-only | pending | 0 / 0 | — |
| `Path` | type-alias / type-only | pending | 0 / 0 | — |
| `PathImpl` | type-alias / type-only | pending | 0 / 0 | — |
| `PathImpl2` | type-alias / type-only | pending | 0 / 0 | — |
| `PathValue` | type-alias / type-only | pending | 0 / 0 | — |
| `RedactionOptions` | interface / type-only | pending | 0 / 0 | — |
| `RequestSnapshot` | interface / type-only | pending | 0 / 0 | — |
| `SPAN_COLLAPSED_TAG` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `Summary` | class / declared-runtime-value | referenced | 1 / 2 | — |
| `TraceSpan` | interface / type-only | pending | 0 / 0 | — |
| `TraceSpanDelegate` | class / declared-runtime-value | referenced | 0 / 3 | — |
| `TracerService` | class / declared-runtime-value | referenced | 1 / 17 | — |
| `admitsSeries` | function / declared-runtime-value | pending | 0 / 0 | — |
| `createInstanceDecorator` | function / declared-runtime-value | pending | 0 / 0 | — |
| `createObserveModule` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `defaultTraceIdGenerator` | function / declared-runtime-value | pending | 0 / 0 | — |
| `stringifyLabel` | function / declared-runtime-value | pending | 0 / 0 | — |

### @nestjs/passport 12.0.0

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `AbstractStrategy` | class / declared-runtime-value | pending | 0 / 0 | — |
| `AllConstructorParameters` | type-alias / type-only | pending | 0 / 0 | — |
| `AuthGuard` | variable / declared-runtime-value | referenced | 1 / 1 | — |
| `AuthGuardAuthenticateOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `AuthModuleAsyncOptions` | interface / type-only | pending | 0 / 0 | — |
| `AuthModuleOptions` | class / declared-runtime-value | pending | 0 / 0 | — |
| `AuthOptionsFactory` | interface / type-only | pending | 0 / 0 | — |
| `IAuthGuard` | type-alias / type-only | pending | 0 / 0 | — |
| `IAuthModuleOptions` | interface / type-only | pending | 0 / 0 | — |
| `PassportModule` | class / declared-runtime-value | referenced | 1 / 3 | — |
| `PassportSerializer` | class / declared-runtime-value | pending | 0 / 0 | — |
| `PassportStrategy` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `Type` | interface / type-only | pending | 0 / 0 | — |
| `WithoutCallback` | type-alias / type-only | pending | 0 / 0 | — |

### @nestjs/platform-express 12.0.2

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `AnyFilesInterceptor` | function / declared-runtime-value | pending | 0 / 0 | — |
| `ExpressAdapter` | class / declared-runtime-value | referenced | 2 / 2 | — |
| `FileFieldsInterceptor` | function / declared-runtime-value | pending | 0 / 0 | — |
| `FileInterceptor` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `FilesInterceptor` | function / declared-runtime-value | pending | 0 / 0 | — |
| `MulterModule` | class / declared-runtime-value | pending | 0 / 0 | — |
| `MulterModuleAsyncOptions` | interface / type-only | pending | 0 / 0 | — |
| `MulterModuleOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `MulterOptionsFactory` | interface / type-only | pending | 0 / 0 | — |
| `NestExpressApplication` | interface / type-only | referenced | 11 / 34 | — |
| `NestExpressBodyParserOptions` | interface / type-only | pending | 0 / 0 | — |
| `NestExpressBodyParserOptionsFor` | type-alias / type-only | pending | 0 / 0 | — |
| `NestExpressBodyParserOptionsMap` | interface / type-only | pending | 0 / 0 | — |
| `NestExpressBodyParserType` | type-alias / type-only | pending | 0 / 0 | — |
| `NoFilesInterceptor` | function / declared-runtime-value | pending | 0 / 0 | — |

### @nestjs/platform-fastify 12.0.2

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `FastifyAdapter` | class / declared-runtime-value | verified-case | 3 / 3 | `fastify-custom-highest-version` |
| `NestFastifyApplication` | interface / type-only | verified-case | 3 / 18 | `fastify-custom-highest-version` |
| `NestFastifyBodyParserOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `RouteConfig` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `RouteConstraints` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `RouteSchema` | variable / declared-runtime-value | pending | 0 / 0 | — |

### @nestjs/platform-socket.io 12.0.2

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `IoAdapter` | class / declared-runtime-value | verified-case | 1 / 1 | `socketio-ack-broadcast-lifecycle` |

### @nestjs/platform-ws 12.0.2

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `WsAdapter` | class / declared-runtime-value | verified-case | 1 / 1 | `raw-websocket-filter` |

### @nestjs/schedule 12.0.2

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `Cron` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `CronExpression` | enum / declared-runtime-value | verified-case | 2 / 4 | `scheduler-dynamic-cron` |
| `CronOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `Interval` | function / declared-runtime-value | referenced | 2 / 2 | — |
| `ScheduleExplorer` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ScheduleModule` | class / declared-runtime-value | verified-case | 3 / 6 | `scheduler-dynamic-interval-cleanup` |
| `ScheduleModuleAsyncOptions` | interface / type-only | pending | 0 / 0 | — |
| `ScheduleModuleOptions` | interface / type-only | pending | 0 / 0 | — |
| `ScheduleModuleOptionsFactory` | interface / type-only | pending | 0 / 0 | — |
| `SchedulerRegistry` | class / declared-runtime-value | verified-case | 2 / 28 | `scheduler-dynamic-timeouts`, `scheduler-dynamic-cron`, `scheduler-dynamic-interval-cleanup` |
| `Timeout` | function / declared-runtime-value | referenced | 1 / 1 | — |

### @nestjs/sequelize 12.0.0

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `InjectConnection` | variable / declared-runtime-value | referenced | 1 / 1 | — |
| `InjectModel` | variable / declared-runtime-value | referenced | 1 / 2 | — |
| `SequelizeModule` | class / declared-runtime-value | referenced | 1 / 4 | — |
| `SequelizeModuleAsyncOptions` | interface / type-only | pending | 0 / 0 | — |
| `SequelizeModuleOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `SequelizeOptionsFactory` | interface / type-only | pending | 0 / 0 | — |
| `generateString` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `getConnectionName` | function / declared-runtime-value | pending | 0 / 0 | — |
| `getConnectionPrefix` | function / declared-runtime-value | pending | 0 / 0 | — |
| `getConnectionToken` | function / declared-runtime-value | pending | 0 / 0 | — |
| `getModelToken` | function / declared-runtime-value | pending | 0 / 0 | — |
| `handleRetry` | function / declared-runtime-value | pending | 0 / 0 | — |

### @nestjs/serve-static 12.0.0

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `AbstractLoader` | class / declared-runtime-value | pending | 0 / 0 | — |
| `DEFAULT_EXPRESS_RENDER_PATH` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `DEFAULT_FASTIFY_RENDER_PATH` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `DEFAULT_ROOT_PATH` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ExpressLoader` | class / declared-runtime-value | pending | 0 / 0 | — |
| `FastifyLoader` | class / declared-runtime-value | pending | 0 / 0 | — |
| `NoopLoader` | class / declared-runtime-value | pending | 0 / 0 | — |
| `SERVE_STATIC_MODULE_OPTIONS` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ServeStaticModule` | class / declared-runtime-value | referenced | 1 / 2 | — |
| `ServeStaticModuleAsyncOptions` | interface / type-only | pending | 0 / 0 | — |
| `ServeStaticModuleOptions` | interface / type-only | pending | 0 / 0 | — |
| `ServeStaticModuleOptionsFactory` | interface / type-only | pending | 0 / 0 | — |
| `serveStaticProviders` | variable / declared-runtime-value | referenced | 0 / 279 | — |

### @nestjs/swagger 12.0.1

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `ApiAcceptedResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiAmbiguousResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiBadGatewayResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiBadRequestResponse` | variable / declared-runtime-value | referenced | 3 / 3 | — |
| `ApiBasicAuth` | function / declared-runtime-value | pending | 0 / 0 | — |
| `ApiBearerAuth` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `ApiBody` | function / declared-runtime-value | referenced | 2 / 3 | — |
| `ApiBodyOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `ApiCallbacks` | function / declared-runtime-value | pending | 0 / 0 | — |
| `ApiConflictResponse` | variable / declared-runtime-value | referenced | 2 / 3 | — |
| `ApiConsumes` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `ApiContinueResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiCookieAuth` | function / declared-runtime-value | pending | 0 / 0 | — |
| `ApiCreatedResponse` | variable / declared-runtime-value | referenced | 3 / 4 | — |
| `ApiDefaultGetter` | function / declared-runtime-value | pending | 0 / 0 | — |
| `ApiDefaultResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiEarlyhintsResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiExcludeController` | function / declared-runtime-value | pending | 0 / 0 | — |
| `ApiExcludeEndpoint` | function / declared-runtime-value | pending | 0 / 0 | — |
| `ApiExpectationFailedResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiExtension` | function / declared-runtime-value | pending | 0 / 0 | — |
| `ApiExtraModels` | function / declared-runtime-value | verified-case | 2 / 2 | `openapi-generic-schema-and-links` |
| `ApiFailedDependencyResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiForbiddenResponse` | variable / declared-runtime-value | referenced | 1 / 1 | — |
| `ApiFoundResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiGatewayTimeoutResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiGoneResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiHeader` | function / declared-runtime-value | pending | 0 / 0 | — |
| `ApiHeaderOptions` | interface / type-only | pending | 0 / 0 | — |
| `ApiHeaders` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiHideProperty` | function / declared-runtime-value | referenced | 2 / 2 | — |
| `ApiHttpVersionNotSupportedResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiIAmATeapotResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiIncludeEndpoint` | function / declared-runtime-value | pending | 0 / 0 | — |
| `ApiInternalServerErrorResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiLengthRequiredResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiLink` | function / declared-runtime-value | pending | 0 / 0 | — |
| `ApiLinkOptions` | interface / type-only | pending | 0 / 0 | — |
| `ApiMethodNotAllowedResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiMisdirectedResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiMovedPermanentlyResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiNoContentResponse` | variable / declared-runtime-value | referenced | 1 / 2 | — |
| `ApiNonAuthoritativeInformationResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiNotAcceptableResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiNotFoundResponse` | variable / declared-runtime-value | referenced | 2 / 2 | — |
| `ApiNotImplementedResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiNotModifiedResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiOAuth2` | function / declared-runtime-value | pending | 0 / 0 | — |
| `ApiOkResponse` | variable / declared-runtime-value | verified-case | 5 / 22 | `openapi-generic-schema-and-links` |
| `ApiOperation` | function / declared-runtime-value | referenced | 4 / 6 | — |
| `ApiOperationOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `ApiParam` | function / declared-runtime-value | pending | 0 / 0 | — |
| `ApiParamOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `ApiPartialContentResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiPayloadTooLargeResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiPaymentRequiredResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiPermanentRedirectResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiPreconditionFailedResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiPreconditionRequiredResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiProcessingResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiProduces` | function / declared-runtime-value | pending | 0 / 0 | — |
| `ApiProperty` | function / declared-runtime-value | verified-case | 7 / 48 | `openapi-generic-schema-and-links` |
| `ApiPropertyOptional` | function / declared-runtime-value | referenced | 2 / 9 | — |
| `ApiPropertyOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `ApiProxyAuthenticationRequiredResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiQuery` | function / declared-runtime-value | pending | 0 / 0 | — |
| `ApiQueryMetadata` | type-alias / type-only | pending | 0 / 0 | — |
| `ApiQueryOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `ApiRequestTimeoutResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiRequestedRangeNotSatisfiableResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiResetContentResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiResponse` | function / declared-runtime-value | pending | 0 / 0 | — |
| `ApiResponseCommonMetadata` | interface / type-only | pending | 0 / 0 | — |
| `ApiResponseExamples` | interface / type-only | pending | 0 / 0 | — |
| `ApiResponseMetadata` | type-alias / type-only | pending | 0 / 0 | — |
| `ApiResponseNoStatusOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `ApiResponseOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `ApiResponseProperty` | function / declared-runtime-value | pending | 0 / 0 | — |
| `ApiResponseSchemaHost` | interface / type-only | pending | 0 / 0 | — |
| `ApiSchema` | function / declared-runtime-value | pending | 0 / 0 | — |
| `ApiSchemaOptions` | interface / type-only | pending | 0 / 0 | — |
| `ApiSecurity` | function / declared-runtime-value | referenced | 1 / 1 | — |
| `ApiSeeOtherResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiServiceUnavailableResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiSwitchingProtocolsResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiTagOptions` | interface / type-only | pending | 0 / 0 | — |
| `ApiTags` | function / declared-runtime-value | referenced | 6 / 8 | — |
| `ApiTemporaryRedirectResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiTooManyRequestsResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiUnauthorizedResponse` | variable / declared-runtime-value | referenced | 2 / 2 | — |
| `ApiUnprocessableEntityResponse` | variable / declared-runtime-value | referenced | 1 / 1 | — |
| `ApiUnsupportedMediaTypeResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiUriTooLongResponse` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ApiWebhook` | function / declared-runtime-value | pending | 0 / 0 | — |
| `BaseParameterObject` | interface / type-only | pending | 0 / 0 | — |
| `CallbackObject` | type-alias / type-only | pending | 0 / 0 | — |
| `CallbacksObject` | type-alias / type-only | pending | 0 / 0 | — |
| `ComponentsObject` | interface / type-only | referenced | 0 / 3 | — |
| `ContactObject` | interface / type-only | pending | 0 / 0 | — |
| `ContentObject` | type-alias / type-only | pending | 0 / 0 | — |
| `DECORATORS` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `DECORATORS_PREFIX` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `DeepPartial` | type-alias / type-only | pending | 0 / 0 | — |
| `DeepPartialType` | function / declared-runtime-value | pending | 0 / 0 | — |
| `DiscriminatorObject` | interface / type-only | pending | 0 / 0 | — |
| `DocumentBuilder` | class / declared-runtime-value | verified-case | 5 / 26 | `openapi-module-selection-and-ui` |
| `EncodingObject` | type-alias / type-only | pending | 0 / 0 | — |
| `EncodingPropertyObject` | interface / type-only | pending | 0 / 0 | — |
| `ExampleObject` | interface / type-only | pending | 0 / 0 | — |
| `ExamplesObject` | type-alias / type-only | pending | 0 / 0 | — |
| `ExtensionLocation` | type-alias / type-only | pending | 0 / 0 | — |
| `ExternalDocumentationObject` | interface / type-only | pending | 0 / 0 | — |
| `HeaderObject` | type-alias / type-only | pending | 0 / 0 | — |
| `HeadersObject` | type-alias / type-only | pending | 0 / 0 | — |
| `InfoObject` | interface / type-only | referenced | 0 / 2 | — |
| `IntersectionType` | function / declared-runtime-value | pending | 0 / 0 | — |
| `LicenseObject` | interface / type-only | pending | 0 / 0 | — |
| `LinkObject` | interface / type-only | referenced | 0 / 1 | — |
| `LinkParametersObject` | type-alias / type-only | pending | 0 / 0 | — |
| `LinksObject` | type-alias / type-only | pending | 0 / 0 | — |
| `MediaTypeObject` | interface / type-only | referenced | 0 / 1 | — |
| `OAuthFlowObject` | interface / type-only | pending | 0 / 0 | — |
| `OAuthFlowsObject` | interface / type-only | pending | 0 / 0 | — |
| `OmitType` | function / declared-runtime-value | pending | 0 / 0 | — |
| `OpenAPIFormat` | type-alias / type-only | pending | 0 / 0 | — |
| `OpenAPIObject` | interface / type-only | referenced | 1 / 18 | — |
| `OperationIdFactory` | type-alias / type-only | pending | 0 / 0 | — |
| `OperationObject` | interface / type-only | referenced | 1 / 6 | — |
| `ParameterLocation` | type-alias / type-only | pending | 0 / 0 | — |
| `ParameterObject` | interface / type-only | pending | 0 / 0 | — |
| `ParameterStyle` | type-alias / type-only | pending | 0 / 0 | — |
| `PartialType` | function / declared-runtime-value | referenced | 2 / 3 | — |
| `PathItemObject` | interface / type-only | referenced | 0 / 3 | — |
| `PathsObject` | type-alias / type-only | pending | 0 / 0 | — |
| `PickType` | function / declared-runtime-value | pending | 0 / 0 | — |
| `ReferenceObject` | interface / type-only | pending | 0 / 0 | — |
| `RequestBodyObject` | interface / type-only | pending | 0 / 0 | — |
| `ResponseObject` | interface / type-only | referenced | 1 / 4 | — |
| `ResponsesObject` | interface / type-only | pending | 0 / 0 | — |
| `SchemaObject` | interface / type-only | referenced | 2 / 41 | — |
| `SchemasObject` | type-alias / type-only | pending | 0 / 0 | — |
| `ScopesObject` | type-alias / type-only | pending | 0 / 0 | — |
| `SecurityRequirementObject` | type-alias / type-only | pending | 0 / 0 | — |
| `SecuritySchemeObject` | interface / type-only | pending | 0 / 0 | — |
| `SecuritySchemeType` | type-alias / type-only | pending | 0 / 0 | — |
| `ServerObject` | interface / type-only | pending | 0 / 0 | — |
| `ServerVariableObject` | interface / type-only | pending | 0 / 0 | — |
| `StandardJsonSchemaConverter` | type-alias / type-only | pending | 0 / 0 | — |
| `StandardSchemaConversionResult` | interface / type-only | pending | 0 / 0 | — |
| `StandardSchemaConverter` | type-alias / type-only | pending | 0 / 0 | — |
| `StandardSchemaObject` | type-alias / type-only | pending | 0 / 0 | — |
| `SwaggerCustomOptions` | interface / type-only | pending | 0 / 0 | — |
| `SwaggerDocumentOptions` | interface / type-only | pending | 0 / 0 | — |
| `SwaggerModule` | class / declared-runtime-value | verified-case | 5 / 24 | `openapi-module-selection-and-ui` |
| `TagObject` | interface / type-only | pending | 0 / 0 | — |
| `WebhooksObject` | type-alias / type-only | pending | 0 / 0 | — |
| `XmlObject` | interface / type-only | pending | 0 / 0 | — |
| `generateSchema` | function / declared-runtime-value | pending | 0 / 0 | — |
| `getSchemaPath` | function / declared-runtime-value | verified-case | 2 / 3 | `openapi-generic-schema-and-links` |
| `refs` | function / declared-runtime-value | pending | 0 / 0 | — |

### @nestjs/terminus 12.0.0

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `CheckGRPCServiceOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `DiskHealthIndicator` | class / declared-runtime-value | pending | 0 / 0 | — |
| `DiskHealthIndicatorOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `GRPCHealthIndicator` | class / declared-runtime-value | pending | 0 / 0 | — |
| `HealthCheck` | variable / declared-runtime-value | referenced | 1 / 1 | — |
| `HealthCheckAttempt` | class / declared-runtime-value | referenced | 0 / 1 | — |
| `HealthCheckResult` | type-alias / type-only | pending | 0 / 0 | — |
| `HealthCheckService` | class / declared-runtime-value | referenced | 1 / 2 | — |
| `HealthCheckStatus` | type-alias / type-only | pending | 0 / 0 | — |
| `HealthIndicatorFunction` | type-alias / type-only | pending | 0 / 0 | — |
| `HealthIndicatorResult` | type-alias / type-only | pending | 0 / 0 | — |
| `HealthIndicatorService` | class / declared-runtime-value | referenced | 1 / 2 | — |
| `HealthIndicatorStatus` | type-alias / type-only | pending | 0 / 0 | — |
| `HealthServiceCheck` | type-alias / type-only | pending | 0 / 0 | — |
| `HttpHealthIndicator` | class / declared-runtime-value | pending | 0 / 0 | — |
| `InferHealthIndicatorResult` | type-alias / type-only | pending | 0 / 0 | — |
| `InferHealthIndicatorResults` | type-alias / type-only | pending | 0 / 0 | — |
| `MemoryHealthIndicator` | class / declared-runtime-value | referenced | 1 / 2 | — |
| `MicroserviceHealthIndicator` | class / declared-runtime-value | pending | 0 / 0 | — |
| `MicroserviceHealthIndicatorOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `MikroOrmHealthIndicator` | class / declared-runtime-value | pending | 0 / 0 | — |
| `MikroOrmPingCheckSettings` | interface / type-only | pending | 0 / 0 | — |
| `MongooseHealthIndicator` | class / declared-runtime-value | pending | 0 / 0 | — |
| `MongoosePingCheckSettings` | interface / type-only | pending | 0 / 0 | — |
| `PrismaClientPingCheckSettings` | interface / type-only | pending | 0 / 0 | — |
| `PrismaHealthIndicator` | class / declared-runtime-value | pending | 0 / 0 | — |
| `SequelizeHealthIndicator` | class / declared-runtime-value | pending | 0 / 0 | — |
| `SequelizePingCheckSettings` | interface / type-only | pending | 0 / 0 | — |
| `TerminusAsyncModuleOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `TerminusAsyncOptions` | interface / type-only | pending | 0 / 0 | — |
| `TerminusModule` | class / declared-runtime-value | referenced | 1 / 1 | — |
| `TerminusModuleOptions` | interface / type-only | pending | 0 / 0 | — |
| `TerminusOptionsFactory` | interface / type-only | pending | 0 / 0 | — |
| `TypeOrmHealthIndicator` | class / declared-runtime-value | pending | 0 / 0 | — |
| `TypeOrmPingCheckSettings` | interface / type-only | pending | 0 / 0 | — |

### @nestjs/testing 12.0.2

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `MockFactory` | type-alias / type-only | pending | 0 / 0 | — |
| `OverrideBy` | interface / type-only | referenced | 0 / 2 | — |
| `OverrideByFactoryOptions` | interface / type-only | pending | 0 / 0 | — |
| `Test` | class / declared-runtime-value | verified-case | 9 / 34 | `testing-provider-override`, `testing-missing-adapter-mocker`, `async-factory-bootstrap-failure` |
| `TestingModule` | class / declared-runtime-value | referenced | 2 / 9 | — |
| `TestingModuleBuilder` | class / declared-runtime-value | verified-case | 0 / 20 | `testing-provider-override`, `testing-missing-adapter-mocker`, `async-factory-bootstrap-failure` |
| `TestingModuleOptions` | type-alias / type-only | pending | 0 / 0 | — |

### @nestjs/throttler 6.5.0

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `InjectThrottlerOptions` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `InjectThrottlerStorage` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `Resolvable` | type-alias / type-only | pending | 0 / 0 | — |
| `SkipThrottle` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `Throttle` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ThrottlerAsyncOptions` | interface / type-only | pending | 0 / 0 | — |
| `ThrottlerException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `ThrottlerGenerateKeyFunction` | type-alias / type-only | pending | 0 / 0 | — |
| `ThrottlerGetTrackerFunction` | type-alias / type-only | pending | 0 / 0 | — |
| `ThrottlerGuard` | class / declared-runtime-value | referenced | 1 / 1 | — |
| `ThrottlerLimitDetail` | interface / type-only | pending | 0 / 0 | — |
| `ThrottlerModule` | class / declared-runtime-value | referenced | 1 / 2 | — |
| `ThrottlerModuleOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `ThrottlerOptions` | interface / type-only | pending | 0 / 0 | — |
| `ThrottlerOptionsFactory` | interface / type-only | pending | 0 / 0 | — |
| `ThrottlerRequest` | interface / type-only | pending | 0 / 0 | — |
| `ThrottlerStorage` | interface / type-only | pending | 0 / 0 | — |
| `ThrottlerStorageService` | class / declared-runtime-value | pending | 0 / 0 | — |
| `days` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `getOptionsToken` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `getStorageToken` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `hours` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `minutes` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `seconds` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `throttlerMessage` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `weeks` | variable / declared-runtime-value | pending | 0 / 0 | — |

### @nestjs/typeorm 12.0.1

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `DuplicateDataSourceException` | class / declared-runtime-value | pending | 0 / 0 | — |
| `InjectConnection` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `InjectDataSource` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `InjectEntityManager` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `InjectRepository` | variable / declared-runtime-value | referenced | 1 / 1 | — |
| `TypeOrmDataSourceFactory` | type-alias / type-only | pending | 0 / 0 | — |
| `TypeOrmModule` | class / declared-runtime-value | referenced | 1 / 4 | — |
| `TypeOrmModuleAsyncOptions` | interface / type-only | pending | 0 / 0 | — |
| `TypeOrmModuleOptions` | type-alias / type-only | pending | 0 / 0 | — |
| `TypeOrmOptionsFactory` | interface / type-only | pending | 0 / 0 | — |
| `generateString` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `getConnectionToken` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `getCustomRepositoryToken` | function / declared-runtime-value | pending | 0 / 0 | — |
| `getDataSourceName` | function / declared-runtime-value | pending | 0 / 0 | — |
| `getDataSourcePrefix` | function / declared-runtime-value | pending | 0 / 0 | — |
| `getDataSourceToken` | function / declared-runtime-value | pending | 0 / 0 | — |
| `getEntityManagerToken` | function / declared-runtime-value | pending | 0 / 0 | — |
| `getRepositoryToken` | function / declared-runtime-value | pending | 0 / 0 | — |
| `handleRetry` | function / declared-runtime-value | pending | 0 / 0 | — |

### @nestjs/websockets 12.0.2

| Export | Clase de símbolo / disponibilidad | Estado | Imports / referencias AST | Casos |
| --- | --- | --- | ---: | --- |
| `AbstractWsAdapter` | class / declared-runtime-value | pending | 0 / 0 | — |
| `Ack` | function / declared-runtime-value | verified-case | 1 / 1 | `socketio-ack-broadcast-lifecycle` |
| `BaseWsExceptionFilter` | class / declared-runtime-value | pending | 0 / 0 | — |
| `BaseWsInstance` | interface / type-only | pending | 0 / 0 | — |
| `ConnectedSocket` | variable / declared-runtime-value | pending | 0 / 0 | — |
| `ErrorPayload` | interface / type-only | pending | 0 / 0 | — |
| `GatewayMetadata` | interface / type-only | pending | 0 / 0 | — |
| `MessageBody` | function / declared-runtime-value | verified-case | 1 / 7 | `socketio-ack-broadcast-lifecycle` |
| `MessageMappingProperties` | interface / type-only | pending | 0 / 0 | — |
| `OnGatewayConnection` | interface / type-only | verified-case | 1 / 4 | `socketio-ack-broadcast-lifecycle` |
| `OnGatewayDisconnect` | interface / type-only | verified-case | 1 / 4 | `socketio-ack-broadcast-lifecycle` |
| `OnGatewayInit` | interface / type-only | verified-case | 1 / 4 | `socketio-ack-broadcast-lifecycle` |
| `ServerAndEventStreamsHost` | interface / type-only | pending | 0 / 0 | — |
| `SubscribeMessage` | variable / declared-runtime-value | verified-case | 1 / 7 | `socketio-ack-broadcast-lifecycle` |
| `WebSocketGateway` | function / declared-runtime-value | verified-case | 1 / 2 | `socketio-ack-broadcast-lifecycle` |
| `WebSocketServer` | variable / declared-runtime-value | verified-case | 1 / 2 | `socketio-ack-broadcast-lifecycle` |
| `WebSocketServerOptions` | interface / type-only | pending | 0 / 0 | — |
| `WsException` | class / declared-runtime-value | verified-case | 1 / 6 | `raw-websocket-filter` |
| `WsResponse` | interface / type-only | referenced | 1 / 4 | — |

## Límites de interpretación

- Los miembros heredados siguen disponibles en TypeScript pero se inventarían en su declaración original; no se duplica cada método en todas las subclases/interfaces.
- Se identifica el símbolo por TypeChecker. Los casts, valores dinámicos, reexports propios y transformaciones de código pueden dejar usos sin atribuir. Las referencias se clasifican, no se evalúan.
- La evidencia de interfaces y tipos verifica contratos concretos usados por el ejemplo; no prueba todas las asignaciones posibles.
- Las firmas representan las declaraciones instaladas; los cambios en paquetes transitivos quedan cubiertos por el hash del lockfile, sin afirmar que sus APIs estén en este inventario.
- Las promociones de miembros son explícitas. Verificar un export de clase no verifica automáticamente sus métodos, y usar un método no verifica cada overload.
- Los subpaths quedan fuera incluso cuando un patrón wildcard los permite. Esto incluye los plugins CLI de GraphQL/Swagger, que cuentan con pruebas separadas del corpus documental.
- Este inventario no acredita compatibilidad universal con NestJS ni ejecución mediante Typers.
