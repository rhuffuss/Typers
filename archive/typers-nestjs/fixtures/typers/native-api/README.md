# Consumidor de la API nativa de Typers

Este perfil usa las once subrutas **experimentales** de `@typers/compiler`. Abre proyectos reales mediante los clientes sync y async; el proceso que analiza, comprueba, imprime y emite es el binario instalado de Typers. El script no proporciona `tsserverPath` ni utiliza TypeScript oficial como alternativa.

El grupo de empaquetado también carga la entrada raíz mediante `require('@typers/compiler')`: verifica `version: '7.0.2'`, `versionMajorMinor: '7.0'`, `upstreamVersion: '7.0.2'` y `typersVersion` igual a la versión instalada. Comprueba expresamente que no exporta `createProgram`, `sys` ni `getParsedCommandLineOfConfigFile`. Esa entrada ofrece identificación; la API nativa se importa por sus subrutas. Los valores observados quedan en `rootPackage` del informe.

El harness principal copia este directorio a su consumidor temporal y coloca los paquetes locales en el `node_modules` del consumidor. Una vez preparado ese consumidor, desde su raíz:

```sh
node profiles/native-api/run.mjs
node node_modules/@typers/compiler/bin/typers.cjs -p profiles/native-api/tsconfig.contracts.json --pretty false
```

La primera orden imprime JSON y termina con código cero solo cuando todas las aserciones pasan. La segunda comprueba las declaraciones instaladas, incluyendo tres `@ts-expect-error` que deben seguir siendo errores de tipos: fachada clásica inexistente, opciones de emisión por llamada inexistentes y uso de una promesa sin `await`.

## Inspección manual

1. Abre [src/budget.ts](src/budget.ts): la regla acepta un gasto de 200 sobre 1200, rechaza 1300 y valida cantidades inválidas. El runner consulta su AST, símbolo `maximumBudget`, tipo `number`, referencias, firma y completado de miembros de `Number`.
2. Abre [src/capacity.ts](src/capacity.ts): `if let Some(capacity)` extrae capacidad presente y devuelve cero ante ausencia. Está dentro del perfil `experimentalTypersSyntax`; el caso se compila por la API y se ejecuta como JavaScript real en Node.
3. Sigue [run.mjs](run.mjs), especialmente `inspectClient`: las llamadas reales y sus resultados esperados están juntas. Sync devuelve valores; async devuelve promesas, y el script comprueba esa diferencia antes de hacer `await` común.
4. Compara [tsconfig.errors.json](tsconfig.errors.json) y [tsconfig.blocked.json](tsconfig.blocked.json). Ambos ven [src/invalid-budget.ts](src/invalid-budget.ts), que produce TS2322. El primero emite con errores; `noEmitOnError` bloquea al segundo. El consumidor conserva el diagnóstico real en JSON.
5. Sigue `inspectVirtualSnapshots`: cambia únicamente el filesystem virtual de 1200 a 1500, notifica el cambio y emite ambas vistas. La anterior conserva 1200; la nueva usa 1500; el archivo en disco permanece idéntico.

## Funcionalidad → ejemplo → evidencia

Todas las filas se ejecutan con `node profiles/native-api/run.mjs`, salvo el contrato de declaraciones.

| Superficie                        | Ejemplo revisable                                                                  | Aserción y resultado esperado                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `unstable/sync`, `unstable/async` | `inspectClient`, `tsconfig.json`                                                   | Proyecto abierto, configuración y diagnósticos vacíos; forma sync/Promise comprobada                |
| AST y `ast/is`                    | `src/budget.ts`                                                                    | `SourceFile`, declaración, identificador `maximumBudget`                                            |
| Checker: símbolos, tipos, firmas  | `inspectClient`                                                                    | `number`, firma `amount` → `Allocation`, referencias resolubles y completado `Number.isSafeInteger` |
| `ast/factory`                     | Unión sintética en `inspectClient`                                                 | Printer nativo devuelve `string \| number`                                                          |
| `ast/visitor`                     | Visita de hijos de la unión                                                        | Sustituye `number` por `boolean`, devuelve `string \| boolean`                                      |
| `ast/clone`                       | Clon de la unión transformada                                                      | Objeto diferente, impresión idéntica                                                                |
| `ast/utils`                       | `formatSyntaxKind`                                                                 | Nombres de nodos y tokens comprobados                                                               |
| `ast/scanner`                     | `const remaining: number = 1200;`                                                  | Siete tokens esperados de TypeScript estándar                                                       |
| `proto`                           | Conversión de archivo↔URI                                                          | Recupera el mismo archivo mediante un identificador URI                                             |
| `fs`                              | `inspectVirtualSnapshots`                                                          | Crear, consultar, actualizar y retirar archivo virtual; lectura nativa del overlay                  |
| Snapshot                          | Vistas antes/después del cambio                                                    | 1200 / 1500, vista retenida sigue en 1200; liberación comprobada                                    |
| `typersEmitProject`               | `tsconfig.json`                                                                    | 8 salidas: dos módulos × JS, declaración y ambos mapas; ordenadas y con hashes                      |
| Ejecución del resultado           | `budget.ts`, `capacity.ts`                                                         | Node ejecuta el texto JS capturado: aceptación, rechazo, validación, presencia y ausencia           |
| Captura sin escrituras            | `assertNoOutputsWritten`                                                           | No se crean directorios de salida ni build info; no se guardan los archivos capturados              |
| Cadena de configuración           | `tsconfig.base.json` y variantes                                                   | `configFileNames` incluye las configuraciones heredadas; también con emisión bloqueada              |
| `noEmit`                          | `tsconfig.no-emit.json`                                                            | `emitSkipped: true`, sin salidas ni errores                                                         |
| Errores con emisión               | `tsconfig.errors.json`                                                             | TS2322 y salidas a la vez; no se considera build limpio                                             |
| `noEmitOnError`                   | `tsconfig.blocked.json`                                                            | TS2322, emisión bloqueada, cuatro configuraciones registradas                                       |
| Solo declaraciones                | `tsconfig.declarations.json`                                                       | Cuatro salidas `.d.ts`/`.d.ts.map`, sin JS                                                          |
| Rechazos explícitos               | `tsconfig.incremental.json`, `tsconfig.composite.json`, `tsconfig.references.json` | Error de API real y mensaje guardado; ninguna emisión correcta inventada                            |
| Timing                            | `collectTiming`, `getTimingInfo`, `resetTimingInfo`                                | Solicitudes y bytes registrados; reinicio de contadores verificado                                  |
| Declaraciones públicas            | [contracts.mts](contracts.mts), `tsconfig.contracts.json`                          | CLI nativo comprueba tipos positivos y tres errores esperados                                       |

## Resultado medido

La ejecución con los tarballs actuales pasa **36 contratos agrupados**, incluidos clientes sync/async y ambas vistas virtuales; el CLI pasa además `contracts.mts`. El informe guarda el diagnóstico TS2322, las tres familias de rechazo de emisión, los hashes de salidas y ejemplos completos de JS/declaraciones/mapas en `clients.sync.main.capturedExamples`. El harness conserva esa evidencia junto a la identidad del artefacto. Estos números no son cobertura de todos los métodos públicos.

La consulta de completado global al final de `budget.ts` produce el rechazo real `completion list needs auto imports`. Se conserva en `queries.globalCompletionRejection`, y su caso negativo falla si ese contrato cambia. La consulta independiente de miembros de `Number` sí encuentra `isSafeInteger`. Por tanto, este ejemplo no acredita auto-imports ni un servicio de lenguaje completo.

## Alcance real

El informe cuenta **contratos de comportamiento agrupados**, no métodos públicos cubiertos ni todas las aserciones. Inventaría los once módulos y el número de exports de ejecución que carga; un export enumerado no acredita todas sus opciones, overloads ni combinaciones.

`printNode` imprime AST; no compila un proyecto. El visitor de este ejemplo transforma un nodo sintético y no se instala como plugin de emisión. El scanner solo demuestra tokens estándar: no añade soporte a Oxlint/Oxfmt ni representa `if-let` como nodo propio. El AST de la sintaxis experimental está normalizado por el compilador y no se presenta como formato sin pérdida del original.

No se ejercitan conexión a una sesión LSP (`fromLSPConnection`), sockets propios, herramientas internas de perfiles CPU/heap (`api.internal`), todas las consultas del checker, concurrencia de snapshots ni consumo de memoria en proyectos grandes. Estos son límites de la demostración. Incremental, composite y referencias son rechazos específicos de `typersEmitProject`; no describen un rechazo universal del CLI.

El overlay virtual delega solo `readFile`; `undefined` deja que el proceso lea en disco configuraciones, `package.json` y bibliotecas. Esto conserva el modo ESM de NodeNext. El filesystem virtual completo devuelve `false` ante archivos ausentes: delegar todos sus callbacks ocultaría deliberadamente archivos reales y exigiría poblar ese filesystem completo.

La API no ofrece `createProgram` clásico, callbacks remotos `writeFile`, emisión selectiva o configuración distinta por llamada. No ejecuta plugins Nest, reescritura de aliases, copiado de assets ni watch. La demostración del adaptador Nest usa su perfil independiente.
