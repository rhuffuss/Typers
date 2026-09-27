# Build nativo de Nest y assets

Este perfil usa el paquete local `@typers/nest` y el compilador identificado como
`@typers/compiler` dentro del consumidor preparado. Las fuentes son TypeScript
estándar con decoradores legacy y metadata; el perfil `experimental` demuestra
por separado el mismo adaptador con `if let Some`.

## Ejecutar

Desde `typers-nestjs`, usa `pnpm demo:typers` con los tres tarballs y
`--profile nest-adapter`; el [índice completo](../../../docs/typers-features.md)
contiene el comando y las opciones de preparación. Después, desde la raíz del
consumidor temporal que imprime el harness:

```sh
node profiles/nest-adapter/run.mjs
```

El runner crea un directorio `runs-*` nuevo bajo el perfil por invocación.
Conserva los casos y salidas para revisión. No modifica la aplicación de
referencia ni reconstruye el compilador. Cada build usa la API nativa instalada;
la comparación adicional invoca el CLI real `typers-nest build --json`.

## Fuente → contrato

| Fuente | Qué inspeccionar | Resultado esperado |
| --- | --- | --- |
| [src/app.ts](src/app.ts) | Constructor sin token `@Inject` explícito, servicio y controlador de política de gastos. | El JS emitido conserva `design:paramtypes`; Nest resuelve el servicio y devuelve la política del asset por HTTP 200. Una ruta ausente devuelve 404. |
| [src/policies/expenses.json](src/policies/expenses.json) | Datos consumidos por el servicio desde su ubicación emitida. | Moneda EUR, umbral 500000 y revisores `approver`/`finance`. Copiar el asset es responsabilidad del adaptador. |
| [nest-cli.json](nest-cli.json) | Configuración raíz, proyecto `review.api`, patrones y opciones de assets. | Selección por nombre, sustitución de arrays y uso de config/override explícitos según los casos del runner. |
| [tsconfig.json](tsconfig.json), [base](tsconfig.base.json) | NodeNext/ESM, strict, rootDir/outDir, declaraciones y ambos mapas. | JS, declaraciones y mapas; el CLI y `buildNest` producen los mismos bytes en los casos comparados. |
| [run.mjs](run.mjs) | API `buildNest`, CLI, HTTP y aserciones antes/después. | El proceso solo termina correctamente cuando pasan los contratos y coinciden los rechazos previstos. |
| [src/templates](src/templates), [src/downloads](src/downloads) | Directorio, archivo oculto, exclusión privada y destino alternativo. | Copia `.revision`, excluye `templates/private`, conserva los bytes `00 ff 0d 0a 80` generados por el runner en el asset binario. |

El JSON final conserva cada comprobación, rechazo, diagnóstico y rutas de la
primera emisión. El harness guarda stdout/stderr completos y la identidad de
paquetes y fuentes. La evidencia integrada se consulta desde el índice general.

## Rechazos y conservación de salidas

`run.mjs` crea una salida previa antes de provocar errores. Comprueba que el
directorio de build mantiene los mismos hashes después de `noEmit`, TS2322 o
errores de configuración/rutas. Los casos incluyen plugins, watchAssets, builder
SWC, aliases `paths`, solapamiento de assets con fuentes, una configuración
heredada situada dentro de outDir y un symlink de asset.

Los fallos esperados conservan `status: "failed"` y su diagnóstico. El runner
falla si el rechazo desaparece o cambia fuera del contrato esperado: no usa un
compilador alternativo para superar una configuración no admitida.

`deleteOutDir` limpia el outDir del compilador solo después de compilar y validar
destinos. Los directorios alternativos de assets/declaraciones se escriben sin
limpieza recursiva propia. Esa preparación no proporciona rollback ante un fallo
de IO durante la escritura ni soporte de ejecuciones concurrentes.

## Inspección HTTP manual

El primer build queda en el subdirectorio `root` de la ejecución `runs-*`. Su
ruta exacta se obtiene de `firstBuild.emittedFiles` en el JSON del runner. Tras
entrar en ese directorio, puedes mantener su aplicación emitida abierta:

```sh
node --input-type=module -e 'const {createPolicyApp} = await import("./dist/app.js"); const app = await createPolicyApp(); await app.listen(3015, "127.0.0.1");'
```

En otra terminal:

```sh
curl -i http://127.0.0.1:3015/expenses/policy
curl -i http://127.0.0.1:3015/missing
```

Devuelven HTTP 200 con la política y HTTP 404 respectivamente. Cierra el proceso
con Ctrl+C. El runner automatizado usa puertos efímeros y `app.close()`.

## Límites

Estos contratos prueban un build explícito de un proyecto por invocación. No
acreditan el comando original `nest build`, los plugins Swagger/GraphQL, aliases,
watch, otros builders o un grafo de proyectos. Un proyecto nombrado no equivale
a `--all` ni a referencias TypeScript.

El ejemplo demuestra el contrato de assets presente en sus fuentes, no todos
los patrones de minimatch ni cada combinación de configuración. El adaptador
exige `outDir` y, con assets, `rootDir` explícitos. Las opciones y restricciones
completas están en el [paquete original](../../../../typers/packages/nest/README.md).
