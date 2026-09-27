# CLI, compiladores y aplicaciones sin HTTP

Estos laboratorios ejercitan el CLI oficial sobre programas Nest reales: inyección de dependencias, metadatos de decoradores, ejecución ESM y respuestas HTTP. Son variantes de compilación independientes del build principal con TypeScript.

## Evidencia ejecutable

```sh
pnpm exec vitest run --config vitest.config.e2e.ts test/tooling.e2e-spec.ts
```

| Caso       | Comportamiento que verifica                                                                                                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SWC        | `nest build` produce ESM, conserva `design:paramtypes` e inyecta `BuildMessageService` en un controlador; Node responde por HTTP.                                                                                |
| Rspack     | `nest build api` y `nest build worker` compilan dos proyectos del mismo workspace; ambos usan una biblioteca Nest mediante `@tooling/shared`. El API responde por HTTP y el worker crea/cierra un contexto Nest. |
| Schematics | El CLI genera un módulo, un provider y un recurso REST. El código generado compila y sus rutas GET/POST responden en un servidor real.                                                                           |
| Watch      | `nest start --watch` con SWC arranca un proceso; editar su fuente cambia la respuesta de `swc-initial` a `swc-rebuilt`.                                                                                          |
| Standalone | El JavaScript emitido de `src/standalone/main.ts` resuelve `WorkspacesService`, consulta el proyecto de ejemplo y termina.                                                                                       |
| Commander  | El comando `projects --limit 1` usa el provider Nest y aplica la opción.                                                                                                                                         |
| REPL       | Una sesión real resuelve `get(WorkspacesService)`, ejecuta una consulta y termina mediante `.exit`.                                                                                                              |

Las pruebas crean puertos efímeros y workspaces temporales. Cierran procesos, incluidos los hijos del watcher, y eliminan sus directorios. Las pruebas standalone compilan esos entrypoints en un directorio temporal propio; no requieren que exista `dist`. Fuerzan el repositorio en memoria, sin servicios externos.

## SWC con ESM

```sh
pnpm exec nest build --config nest-cli.swc.json
node dist-tooling-swc/src/tooling-lab/swc-only/main.js
# Desarrollo, con recompilación y reinicio:
pnpm exec nest start --config nest-cli.swc.json --watch
```

El proceso imprime `TOOLING_URL`; `GET /tooling` devuelve el mensaje y los tipos usados para inyección. `PORT` es opcional y vale `0` por defecto, para que el sistema asigne un puerto libre.

`nest-cli.swc.json` limita `sourceRoot` al fixture. `.swcrc` habilita decoradores legacy y emisión de metadatos, y conserva módulos ESM. `tsconfig.swc.json` usa `rootDir: "."`, por lo que el output conserva `src/tooling-lab/swc-only`; esta estructura permite que `nest start` encuentre el entrypoint. No se mueven archivos emitidos a posteriori.

`typeCheck: true` solicita también la comprobación TypeScript. SWC transpila, pero no comprueba tipos por sí mismo. [Receta oficial SWC](https://docs.nestjs.com/recipes/swc).

## Workspace Rspack: dos aplicaciones y una biblioteca

```sh
node src/tooling-lab/prepare-workspace.ts --build
```

Este comando crea un workspace temporal completo, comprueba los tipos y construye `api` y `worker`. Imprime su ubicación y los comandos para arrancar el API y eliminar el directorio cuando termine la revisión. El comando termina sin arrancar servidores. Los artefactos permanecen disponibles hasta eliminarlos; en caso de error del build se limpia el workspace.

Para preparar las fuentes sin construirlas:

```sh
node src/tooling-lab/prepare-workspace.ts
```

Dentro del directorio impreso:

```sh
node node_modules/@nestjs/cli/bin/nest.js build api --config nest-cli.rspack.json
node node_modules/@nestjs/cli/bin/nest.js build worker --config nest-cli.rspack.json
node dist-tooling-rspack/apps/api/main.js
# En otro terminal, o tras cerrar el API:
node dist-tooling-rspack/apps/worker/main.js
```

La configuración declara tres proyectos: `api`, `worker` y `shared`. El alias TypeScript `@tooling/shared` resuelve a `libs/shared/src/index.ts`; Rspack integra la biblioteca en cada aplicación. `rspack.config.mjs` conserva los ajustes de Nest para ESM, metadatos y dependencias externas, y cambia únicamente el directorio de salida. El CLI recibe esa configuración mediante `compilerOptions.builder.options.configPath`.

Las fuentes se guardan como `.ts.template` y se materializan como `.ts`. Así el alias del workspace independiente no afecta al compilador del proyecto principal. El workspace reutiliza las dependencias ya instaladas mediante un enlace a `node_modules`; no instala paquetes.

La prueba ejecuta `tsc --noEmit` por separado: un bundle válido por sí solo no demuestra que el programa sea correcto para el comprobador de tipos. El modo monorepo y sus bibliotecas siguen la estructura descrita en [Workspaces](https://docs.nestjs.com/cli/monorepo) y [Libraries](https://docs.nestjs.com/cli/libraries).

## Generación oficial

La prueba invoca estos comandos sobre un proyecto temporal ESM:

```sh
nest generate module generated --no-spec
nest generate provider generated/registry --no-spec
nest generate resource notes --type rest --crud true --no-spec
```

El recurso es el scaffold oficial: devuelve los mensajes de ejemplo de Nest, no persiste notas. El manifiesto temporal declara previamente `@nestjs/mapped-types`, ya instalado en el repositorio, para evitar que el schematic lance una instalación automática. Los tipos de transporte y CRUD se pasan como argumentos para evitar preguntas interactivas. [CLI usage](https://docs.nestjs.com/cli/usages), [CRUD generator](https://docs.nestjs.com/recipes/crud-generator).

## Alcance para Typers

Estos casos establecen una referencia con TypeScript, SWC y Rspack. No se ha ejecutado Typers en estos pipelines ni se afirma compatibilidad. La comparación futura debe comprobar al menos resolución ESM y alias, metadatos `design:paramtypes`, decoradores de clase/método/parámetro, imports de tipos, ejecución del resultado e integración con los plugins del CLI.

La prueba watch verifica recompilación y reinicio del proceso. El laboratorio HMR descrito a continuación comprueba por separado la sustitución de módulos dentro del mismo proceso.

Los plugins OpenAPI y GraphQL se verifican en sus laboratorios específicos mediante TypeScript. Quedan pendientes sus combinaciones con SWC/Rspack, source maps bajo debugger, todos los flags del CLI y todas las variantes de schematics. Las pruebas de [standalone](https://docs.nestjs.com/standalone-applications), [Commander](https://docs.nestjs.com/recipes/nest-commander) y [REPL](https://docs.nestjs.com/recipes/repl) verifican los entrypoints concretos de esta demo.

## HMR real: webpack/CommonJS en un workspace aislado

La receta oficial actual conserva `module.hot` para webpack/CommonJS; Nest 12 marca ese builder como obsoleto. Este fixture reproduce esa variante de forma explícita en un paquete temporal `type: commonjs`. La aplicación principal y el resto de laboratorios ESM conservan su configuración. [Receta oficial Hot reload](https://docs.nestjs.com/recipes/hot-reload).

```sh
pnpm exec vitest run --config vitest.config.e2e.ts test/hmr.e2e-spec.ts
```

La prueba compila mediante **Nest CLI y webpack**, arranca HTTP y edita `src/message.ts` dos veces. Verifica:

- Respuestas sucesivas `hmr-initial`, `hmr-second` y `hmr-third` en el mismo puerto.
- El mismo PID en las tres respuestas: no se reinicia Node.
- Un identificador de instancia Nest nuevo tras cada cambio.
- Los hooks `onModuleDestroy` y `onApplicationShutdown` de cada instancia anterior ejecutados antes de servir la siguiente.
- Una sola instancia activa después de cada actualización; el provider libera su temporizador al destruirse.
- Cierre del compilador, comprobador de tipos y aplicación al finalizar; el endpoint deja de responder y se elimina el directorio temporal.

Para explorar el caso manualmente:

```sh
node src/tooling-lab/hmr/prepare-workspace.ts
```

El helper imprime un directorio temporal y los comandos para arrancar el watcher y limpiarlo. Dentro de ese directorio:

```sh
node node_modules/@nestjs/cli/bin/nest.js build --config nest-cli.hmr.json --watch
```

Consulta `HMR_URL` seguido de `/hmr` y edita `src/message.ts` en el workspace impreso. `nest-cli.hmr.json`, `webpack.hmr.cjs` y `tsconfig.hmr.json` están diseñados para ese workspace materializado; no se ejecutan directamente sobre las fuentes del proyecto principal.

La configuración usa `webpack/hot/poll?100`, `HotModuleReplacementPlugin`, `WatchIgnorePlugin` y `RunScriptWebpackPlugin` con `autoRestart: false`, siguiendo la receta. En el entrypoint, `module.hot.dispose` guarda la promesa de `app.close()` en `module.hot.data`; la nueva instancia la espera antes de escuchar. `forceCloseConnections` permite cerrar conexiones HTTP anteriores. El puerto asignado inicialmente también pasa por `module.hot.data`, lo que permite usar un puerto efímero y reutilizarlo en cada actualización.

Las fuentes con extensión `.ts.template` se materializan como TypeScript dentro del paquete CommonJS. Conservan imports relativos `.js`; `extensionAlias` resuelve esos imports hacia `.ts` al construir. `ts-loader` y el comprobador TypeScript proporcionado por el builder trabajan sobre el `tsconfig.hmr.json` propio. Las dependencias provienen del `node_modules` del repositorio, sin instalar paquetes durante la prueba.

Este caso verifica la variante **con CLI**, dos reemplazos y el ciclo de vida de Nest. La variante sin CLI, la conservación de estado de negocio, los assets y el HMR ESM/Rspack siguen fuera de esta prueba. Tampoco se afirma compatibilidad de `module.hot` o webpack con Typers.
