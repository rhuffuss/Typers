# Comparación real con Typers

La medición actual del 15 de septiembre de 2026, iniciada a las 17:56 UTC,
compila una copia del corpus con el
CLI nativo de Typers y ejecuta su JavaScript con Node. El adaptador Nest también
supera la compilación y las pruebas con un perfil explícito sin watch de assets
ni incremental. La configuración original del adaptador falla y queda registrada
como tal. El [informe JSON](typers-comparison.json) conserva versiones, hashes,
configuraciones, comandos, estados y referencias a los diagnósticos completos.
La demostración de las funciones propias de Typers está separada en
[el índice de funcionalidades](typers-features.md): esta comparación mantiene
el corpus de TypeScript estándar como referencia.

## Resultado medido

| Ruta                                            | Build                 | Comprobación de tipos del proyecto completo | Ejecución del JavaScript emitido |
| ----------------------------------------------- | --------------------- | ------------------------------------------- | -------------------------------- |
| TypeScript oficial 6.0.3, referencia instalada  | PASS                  | PASS                                        | 26/26 contratos Node             |
| Typers CLI 7.0.2-typers.0                       | PASS                  | PASS                                        | 26/26 contratos Node             |
| `typers-nest`, configuración original           | FAILED: `watchAssets` | No se solicita en este perfil               | No ejecutada                     |
| `typers-nest`, solo `watchAssets: false`        | FAILED: `incremental` | No se solicita en este perfil               | No ejecutada                     |
| `typers-nest`, perfil soportado                 | PASS                  | No se solicita en este perfil               | 26/26 contratos Node             |
| TypeScript oficial 7.0.2, paquete local copiado | PASS                  | PASS                                        | 26/26 contratos Node             |

Los 26 contratos corresponden a tres programas independientes:

- `scripts/check-emitted.mjs`: 8, incluidos HTTP real, autenticación, validación,
  OpenAPI, GraphQL y assets.
- `scripts/check-business-emitted.mjs`: 10, incluidos reglas de negocio,
  planificación, aprobaciones, auditoría y pago simulado idempotente.
- `scripts/check-advanced-emitted.mjs`: 8, incluidos configuración, versiones,
  programación dinámica, cierre, tenants durables, `INQUIRER` e inyección opcional.

Se importa la salida ESM con Node; Vitest no transforma estas fuentes. El
typecheck utiliza `tsconfig.json --noEmit`, incluidos los contratos de tipos
positivos y negativos del proyecto, no solo las fuentes del build principal.

### Perfiles adicionales de lenguaje

Para cada uno de los tres compiladores —TS 6, Typers CLI y TS 7— se materializa
el mismo laboratorio independiente y se compilan sus cuatro configuraciones:
`core`, `decorators`, `report` y `contracts`. Pasan las cuatro, incluidos los
12 contratos negativos con `@ts-expect-error` del perfil `contracts`.

Los seis programas Node pasan y sus resultados JSON coinciden con la referencia
TS 6 en los seis casos: registro extensible de eventos, mixins, importación JSON
con atributos, decoradores estándar/accessors, TSX con runtime propio y recursos
`using`/`await using` con cancelación y errores suprimidos. Estos perfiles
conservan su configuración separada; Nest sigue usando decoradores legacy y
metadata. Véase [el laboratorio de lenguaje](language-lab.md).

### Comparación de archivos

En este snapshot, Typers CLI frente a TypeScript oficial 7.0.2 produce
**469 archivos con cero diferencias de bytes**. Typers CLI frente al perfil
soportado del adaptador también produce 469 archivos con cero diferencias.
La comparación incluye JavaScript, declaraciones, mapas y assets. No se exige
igualdad de bytes con TS 6 ni se deduce equivalencia general de los compiladores.

El CLI de TypeScript no copia assets de Nest. El script los copia de forma
explícita después del build, usando los patrones string originales de
`nest-cli.json`; esa intervención se registra en el informe. El adaptador
`typers-nest` realiza su propia copia. No se presenta la copia manual como una
capacidad del CLI nativo.

## Configuraciones y rechazos

Cada ruta usa su propio directorio con fuentes reales copiadas. La comparación
nativa mantiene la configuración original, incluido `incremental: true`.

El adaptador original devuelve código 1 y este diagnóstico:

```text
Typers Nest: compilerOptions.watchAssets is not supported by typers-nest build
```

Al cambiar únicamente `watchAssets` a `false`, devuelve código 1:

```text
Typers Nest: api: client error: typersEmitProject does not support incremental, composite, or project references; use the Typers CLI for build graphs and build information
```

El perfil soportado cambia exactamente dos opciones en las copias temporales:

```json
{
  "nest-cli.json": { "compilerOptions.watchAssets": false },
  "tsconfig.json": { "compilerOptions.incremental": false }
}
```

Es un resumen de los cambios, no un archivo de configuración utilizable. El
informe incluye los objetos completos. Se mantienen todos los módulos, fuentes,
decoradores, assets y restantes opciones. No se elimina código para ocultar
incompatibilidades ni se cambia automáticamente de compilador al fallar.

## Identidad y aislamiento

Se ejecutó con Node 24.20.0 sobre macOS arm64, pnpm 12.4.1 y estos tarballs locales:

El snapshot contiene 267 archivos de fuentes, tests, scripts y configuración. Su
SHA-256 de manifiesto es
`8a900ef4bf2fcf62f3da0dc5778e81daf78abc31aa3b48e5063e78e2736efa9e`;
la medición comenzó a las `2026-09-15T17:56:05.828Z`. El inventario completo de
archivos se conserva como `source-manifest.json` en `runDirectory`.

| Paquete            | Versión          | SHA-256 del tarball                                                |
| ------------------ | ---------------- | ------------------------------------------------------------------ |
| `@typers/compiler` | `7.0.2-typers.0` | `ef37a6350d19cab6b113077d1c460e7ef22d5da9dd2364b7c6b97d9d4c849b15` |
| `@typers/core`     | `0.1.0-alpha.0`  | `9c1571d8c4d7f64afc5b1841a92a2a6c27835a7472ef4bf3f270753070e25a45` |
| `@typers/nest`     | `0.1.0-alpha.0`  | `38c6b942bc9fefa75a1f0d514e8969220e68d1dfeaec5593518b727d0ce6fe72` |

La identidad embebida del compilador indica `upstreamVersion: 7.0.2`,
`upstreamCommit: 1e4744d68260a7cb91b62b12edc3f6a2187faaf1`,
`sourceCommit: efe9894778169f53a3a6a0d3d42e0efa4bae3d7f` y
`compilerWorktreeDirty: false`. El ejecutable nativo tiene SHA-256
`5057f05cdcadd8ff8c0dce28ae737ae9758b7300822886b71bcc8af3f1e83651`.
Estos datos identifican el código y los artefactos reconstruidos de esta
medición. El paquete oficial también declara versión 7.0.2; la coincidencia
de versión no acredita por sí sola el mismo commit upstream.

La medición anterior, con 265 archivos y `compilerWorktreeDirty: true`, se
conserva localmente en `reports/typers-comparison-previous.json`. El informe
versionado actual es una copia exacta de `reports/typers-comparison-current.json`;
sus resultados sustituyen la fotografía anterior sin eliminar su respaldo.

El script copia fuentes, tests, scripts, configuraciones y artefactos a un
directorio temporal independiente. Incluye el cliente Prisma generado y excluye
`.env`. Los perfiles ejecutan la aplicación en memoria con `NODE_ENV=test`; se
eliminan las variables `OBSERVE_*` de sus procesos. No se envían reportes externos.

Las dependencias ya instaladas se enlazan por paquete a su ubicación real en el
árbol de pnpm. Se registran sus versiones, hashes de `package.json` y el hash del
lockfile. No se copia ni se verifica byte a byte todo ese árbol: repetir en otro
equipo requiere instalar el lockfile y disponer de los artefactos de su plataforma.
Las fuentes y salidas gestionadas son copias sin symlinks. El compilador Typers
se resuelve por su nombre explícito, `--compiler @typers/compiler`; la dependencia
`typescript` de la aplicación sigue siendo la oficial 6.0.3.

El paquete oficial opcional se copia junto con su binario de plataforma y se
registra su manifiesto de archivos. No se escribe en el repositorio hermano, no
se reemplaza el compilador de referencia y no se modifica el `dist` raíz. La
medición verifica al final que siguen intactos el manifiesto del TypeScript de
referencia y el lockfile. Los hashes y el manifiesto del snapshot identifican la
medición concreta, aunque posteriormente se edite documentación o scripts.

## Reproducir

Requiere Node 24, dependencias del proyecto ya instaladas con su lockfile,
`pnpm generate:prisma` ejecutado y tarballs construidos previamente. El script no
instala paquetes, descarga herramientas ni reconstruye el proyecto hermano.

```sh
node scripts/compare-typers.mjs --help

node scripts/compare-typers.mjs \
  --compiler ../typers/built/typers/typers-compiler-7.0.2-typers.0.tgz \
  --core ../typers/built/typers/typers-core-0.1.0-alpha.0.tgz \
  --nest ../typers/built/typers/typers-nest-0.1.0-alpha.0.tgz \
  --upstream ../typers/tooling/node_modules/typescript \
  --report reports/typers-comparison-current.json
```

Las rutas de los tres tarballs son obligatorias. `--upstream` es opcional y
selecciona un paquete oficial ya instalado: si se omite, no se ejecuta esa ruta y
su comparación de archivos queda `not-run`. Se puede repetir la medición con
nuevos tarballs sin modificar las fuentes de la aplicación. El informe versionado
se generó con el comando anterior y después se copió a `docs/typers-comparison.json`.

### Interpretar el resultado y conservar diagnósticos

`completed: true` significa que terminó la medición, no que todos los builds
pasaran. Los dos rechazos siguen teniendo `status: "failed"`, código 1 y
diagnósticos. `summary` separa builds, programas de comprobación, perfiles de
lenguaje, rechazos esperados y resultados inesperados.

El proceso devuelve código **0** únicamente si pasan los perfiles requeridos de
compilación/ejecución/lenguaje, se conservan las referencias y los dos rechazos
esperados coinciden con sus diagnósticos concretos. Un fallo inesperado, timeout,
programa requerido no ejecutado, discrepancia JSON o error del harness devuelve
**1**. Un cambio futuro que permita una de las configuraciones hoy rechazadas
también exige revisar la expectativa. La comparación de bytes es informativa;
una diferencia de emisión no constituye automáticamente un error semántico.

El script imprime `runDirectory` y conserva allí las copias, compiladores,
manifiestos y stdout/stderr completos, también cuando falla. El JSON versionado
incluye hashes y extractos; los logs completos permanecen locales en esa carpeta
y no se suben al repositorio. Los procesos tienen límites temporales y se cierran
si los exceden. La carpeta temporal se puede borrar expresamente después de
revisarla; el script la conserva deliberadamente.

## Límites de la evidencia

- Este corpus usa TypeScript estándar. No ejercita el runtime Result/Option
  ni la sintaxis `if let Some` de Typers. Sus ejemplos y validaciones se documentan
  por separado en [la demostración de funcionalidades](typers-features.md).
- Se ejercita la API nativa de emisión a través del adaptador real; no se prueba
  toda la API `unstable/*` ni se implementa una API clásica de TypeScript.
- No acredita `nest build` original con Typers, sus plugins Swagger/GraphQL,
  builders SWC/Rspack, watch, aliases ni referencias entre proyectos.
- Los contratos Node ejecutan aplicaciones locales en memoria. Las suites con
  PostgreSQL, MongoDB, Redis, RabbitMQ, Kafka y servicios externos no se repiten
  bajo este compilador en esta medición.
- Ni los capítulos de documentación ni los símbolos del inventario equivalen
  a todas las APIs de Nest verificadas con Typers. Cada caso necesita su evidencia.
- Las duraciones son una ejecución local sin protocolo de benchmark; no sirven
  para afirmar una mejora de rendimiento.

Contratos de referencia leídos en el repositorio hermano:
[adaptador Nest](../../typers/packages/nest/README.md),
[documentación Typers](../../typers/docs/typers/README.md) y su estado/API nativa.
La [guía de uso del corpus](typers.md) distingue las rutas de compatibilidad.
