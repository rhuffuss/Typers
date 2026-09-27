# Uso como banco de pruebas de Typers

## Aplicación real con las funcionalidades propias

Abre [`apps/typers/src`](../apps/typers/src) para ver una app NestJS que usa
Result/Option e `if let Some` en catálogo, presupuestos y reservas. Para iniciarla
desde la raíz de este repositorio:

```sh
pnpm start:typers
```

Swagger está en [http://127.0.0.1:3014/docs](http://127.0.0.1:3014/docs).
La [guía de la app](../apps/typers/README.md) contiene preparación de tarballs,
archivos por capacidad y peticiones manuales. Usa `build:typers` para emitir,
`typecheck:typers` para comprobar tipos y `test:typers` para compilar y ejecutar
Node sobre la salida. `typers:refresh` actualiza los paquetes y el lock propios
cuando cambian los tarballs; los comandos habituales detectan ese cambio y lo
indican. La instalación, dependencias y lock de `apps/typers` son independientes
de la referencia raíz.

La [evidencia de la aplicación](typers-application-results.json) registra las
13 pruebas Node aprobadas y el arranque real con Swagger y HTTP. Conserva su
propia procedencia y no reemplaza los informes previos de comparación.

`fixtures/typers` sigue siendo útil para casos mínimos de regresión y consumidores
de la API del compilador. Esos fixtures no sustituyen a esta aplicación. WebStorm
puede iniciar el script con pnpm; el soporte de edición para la nueva sintaxis
sigue pendiente aunque el compilador Typers la acepte.

## Funcionalidades propias: casos aislados de validación

La [guía funcional](typers-features.md) añade perfiles independientes para
Result/Option, `if let Some`, API nativa sync/async y adaptador Nest. Ejecuta
`pnpm demo:typers --help` para ver las opciones. Su evidencia está separada de
la comparación del corpus estándar y conserva los errores de funciones excluidas.
Por decisión del usuario, cada avance posterior de Typers debe actualizar aquí
su ejemplo y validación, además de las pruebas del repositorio del compilador.

## Comparación local ejecutada

La [medición reproducible](typers-comparison.md) y su [informe con hashes](typers-comparison.json) registran el corpus en un consumidor temporal, conservando TypeScript 6 en este repositorio.

| Ruta                                          | Resultado del snapshot                                                                                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript 6.0.3 de referencia                | Build, typecheck y 26 comprobaciones Node correctos.                                                                                                |
| Typers 7.0.2-typers.0, CLI nativo             | Build, typecheck y las mismas 26 comprobaciones Node correctos.                                                                                     |
| `typers-nest` con configuración original      | Rechazo de `watchAssets: true`; al desactivarlo se observa el rechazo de `incremental: true`. Son builds fallidos registrados.                      |
| `typers-nest` con perfil explícito compatible | Desactivando ambas opciones, build con assets y 26 comprobaciones Node correctos.                                                                   |
| TypeScript oficial 7.0.2                      | Build, typecheck y 26 comprobaciones Node correctos; los 469 archivos de salida coinciden byte a byte con Typers CLI y con el perfil del adaptador. |

Los tres compiladores también pasan los cuatro perfiles de lenguaje. Los seis programas emitidos por Typers y TypeScript 7 producen los mismos resultados JSON que TypeScript 6. Las doce expectativas negativas de tipos se comprueban mediante el perfil de contratos.

Esta comparación cubre el snapshot identificado y esos contratos. Las 260 pruebas Vitest del repositorio se ejecutaron en la referencia; no se han repetido todas, ni los brokers o bases de datos, sobre la salida Typers. Tampoco acredita el Nest CLI original, sus plugins ni watch. Las funcionalidades propias de Typers se verifican separadamente en la guía anterior.

## Referencia estable

El build principal usa Nest CLI y TypeScript oficial, fijados en el lockfile.
Esta ruta establece el comportamiento de referencia. Consulta su identidad:

```sh
pnpm compiler:report
pnpm check
pnpm infra:up
pnpm test:integration
```

`pnpm test:emitted` importa el JavaScript ESM emitido y lo ejecuta con Node;
no utiliza el transformador TypeScript de Vitest. Comprueba ocho contratos HTTP,
autenticación/validación, assets, OpenAPI y GraphQL sobre la aplicación compilada.

Las pruebas Vitest de fuentes verifican comportamientos amplios del framework;
por sí solas no prueban que esas fuentes hayan sido compiladas por Typers.
Los fixtures Swagger y GraphQL invocan plugins reales del compilador y ejecutan
sus artefactos con Node. SWC y Rspack tienen pruebas independientes.

## Rutas independientes del compilador experimental

La documentación consultada de `../typers/docs/typers` distingue:

1. CLI nativo y JavaScript/declaraciones emitidos.
2. API nativa `unstable/*`, consultas y emisión programática.
3. Adaptador explícito `typers-nest build`.
4. Comando original Nest CLI y plugins que necesitan la API clásica.
5. Parsers de Vitest/Vite, SWC, Oxc y editores.

El éxito en una ruta no acredita las otras. El adaptador documentado rechaza
plugins, aliases, incremental, referencias y watch. El Nest CLI original sigue
requiriendo API clásica. Estas restricciones son precisamente casos que este
repositorio permite investigar; no se eliminan los ejemplos para ocultar fallos.

Para probar una salida alternativa compatible con la estructura del build:

```sh
node scripts/check-emitted.mjs dist-typers
```

Primero hay que emitir esa carpeta con el compilador elegido, copiando también
los assets según `nest-cli.json`. El comando falla si faltan archivos o contratos.
No ejecuta un compilador alternativo automáticamente cuando la salida falla.

Los paquetes Typers del repositorio hermano son experimentales y locales.
La app `apps/typers` instala tarballs explícitos `file:` con hashes comprobados;
tras reconstruirlos, `pnpm typers:refresh` actualiza su instalación. No usa un
enlace a las fuentes del compilador como dependencia de ejecución. La comparación
histórica copia sus tarballs a un consumidor aislado y registra
hashes, versiones, configuración y comandos. Las dependencias de la aplicación
se enlazan por paquete al árbol pnpm fijado; no es una instalación limpia
independiente de todas las dependencias. El runtime Result/Option también conserva su perfil aislado ejecutable;
la referencia principal conserva TypeScript estándar.

## Datos y errores

El dominio usuarios/proyectos/tareas ofrece éxito, ausencia, validación inválida,
credenciales inválidas, permisos insuficientes, duplicados, rollback y relaciones.
Sirve para comparar futuras adaptaciones a Result/Option sin alterar el contrato
observable HTTP. Mensajería añade eventos, Observable/Promise, streaming,
timeouts, guards, contexto asíncrono y cierre de recursos.

La [matriz](nest-coverage.md) enlaza casos con la documentación oficial. Un caso
verificado por capítulo no equivale a cobertura exhaustiva de todos sus ejemplos
ni a compatibilidad universal con NestJS.
