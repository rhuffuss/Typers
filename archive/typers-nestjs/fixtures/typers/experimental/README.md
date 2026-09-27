# if let Some y reservas HTTP con Nest

Perfil explícito con `experimentalTypersSyntax: true`, independiente de la
aplicación TypeScript estándar. Los archivos `.ts` contienen gramática real de
Typers y se compilan directamente con su núcleo nativo. Los comentarios de tipos
negativos pertenecen a funciones que no se ejecutan.

## Reproducir

Desde la raíz del repositorio:

```sh
pnpm demo:typers \
  --compiler ../typers/built/typers/typers-compiler-7.0.2-typers.0.tgz \
  --core ../typers/built/typers/typers-core-0.1.0-alpha.0.tgz \
  --nest ../typers/built/typers/typers-nest-0.1.0-alpha.0.tgz \
  --profile experimental
```

Dentro de `profiles/experimental` en el consumidor temporal que imprime el
orquestador, se pueden ejecutar sus partes:

```sh
node ../../node_modules/.bin/typers -p tsconfig.json --pretty false
node --test experimental.test.mjs
node ../../node_modules/typescript/bin/tsc -p tsconfig.consumer.json --pretty false
node ../../node_modules/.bin/typers -p negative/wrong-pattern/tsconfig.json --pretty false
```

La última orden **debe fallar** con `TS180001`. El orquestador conserva los siete
rechazos de sintaxis/tipos y distingue el fallo esperado de un fallo de su gate.
TypeScript oficial 6 solo comprueba [consumer.mts](consumer.mts), que importa las
declaraciones emitidas sin contener gramática experimental.

## Índice de capacidades demostradas

| Capacidad experimental disponible                      | Fuente                                                                       | Resultado esperado y comprobado                                                                              |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `Some(identifier)` con bloque y `else`                 | [src/semantics.ts](src/semantics.ts), `inspect`                              | Some conserva payload; None ejecuta ausencia.                                                                |
| Valores falsy y operandos conocidos                    | `inspect`, `knownVariants`                                                   | `0`, `false`, `''`, `null`, `undefined`, `NaN` siguen presentes; None conocido compila.                      |
| Evaluación única                                       | `evaluateOnce`, [src/nest-app.ts](src/nest-app.ts)                           | Una llamada al proveedor por expresión; una lectura al reservar.                                             |
| Protocolo estructural y narrowing                      | `structural`, [src/type-contracts.ts](src/type-contracts.ts)                 | Productor estructural externo aceptado; payload inferido como string/number.                                 |
| Some contextual, constructor importado con otro nombre | `hygieneAndShadowing` y resto de `semantics.ts`                              | La variable local `Some` no se llama como constructor del patrón.                                            |
| Higiene, ámbitos y anidamiento                         | `hygieneAndShadowing`, contratos de tipos                                    | Temporales no capturan nombres `__typers_iflet_*`, incluso declarados después; binding limitado a su bloque. |
| Binding const, sin inmutabilidad profunda              | `typeContracts`, `mutatePayload`                                             | Reasignar binding se rechaza; modificar un objeto mutable sigue permitido.                                   |
| `await` explícito                                      | `asynchronous`                                                               | Valor presente, ausencia y rechazo conservan semántica de promesas.                                          |
| Flujo normal de JavaScript                             | `controlFlow`                                                                | `return`, `break`, `continue`, `finally`, `this` y `arguments` conservan resultado.                          |
| Emisión CommonJS                                       | [src/commonjs.cts](src/commonjs.cts)                                         | `.cts` emite `.cjs` ejecutable; Some(0) devuelve 0 y None devuelve -1.                                       |
| Declaraciones y mapas                                  | [experimental.test.mjs](experimental.test.mjs), [consumer.mts](consumer.mts) | Firma genérica conservada, temporales no expuestos y fuente original incluida en mapa; TS6 consume dts.      |
| Nest real, decoradores y DI                            | [src/nest-app.ts](src/nest-app.ts)                                           | `design:paramtypes` permite inyección por clase y HTTP real devuelve 201/400/404/409.                        |

La compilación nativa, los **8 contratos Node** y el consumidor de declaraciones
con TypeScript oficial 6 pasaron con los tarballs reconstruidos de `efe9894`.
El informe principal registra las ejecuciones y hashes actuales. Los tests
arrancan Nest en loopback y puerto efímero y siempre cierran la aplicación.

## Inspeccionar la aplicación real

El servicio de reservas mantiene stock en memoria. Result representa fallos de
dominio; Option diferencia un SKU desconocido de otro existente con stock cero.
El DTO de entrada es `unknown`: `parseReservation` valida la frontera antes de
introducir tipos de dominio. Una nota vacía explícita conserva `Some('')`.

Desde el perfil temporal ya compilado:

```sh
node dist/src/main.js
```

En otra terminal:

```sh
curl -i http://127.0.0.1:3014/stock/EMPTY
curl -i http://127.0.0.1:3014/stock/MISSING
curl -i http://127.0.0.1:3014/reservations \
  -H 'content-type: application/json' \
  -d '{"sku":"WIDGET","units":2,"note":""}'
curl -i http://127.0.0.1:3014/reservations \
  -H 'content-type: application/json' \
  -d '{"sku":"WIDGET","units":3}'
curl -i http://127.0.0.1:3014/reservations \
  -H 'content-type: application/json' \
  -d '{"sku":"WIDGET","units":0}'
```

Resultados, en ese orden y con proceso recién iniciado:

1. **200**, `{ "kind": "some", "value": 0 }`.
2. **404**, `{ "code": "UNKNOWN_SKU", "sku": "MISSING" }`.
3. **201**, reserva `reservation-1`, `remaining: 2`, nota `{kind:'some',value:''}`.
4. **409**, `INSUFFICIENT_STOCK`, `available: 2`; conserva el stock.
5. **400**, `INVALID_INPUT`, `field: 'units'`; no consulta el repositorio.

Cierra con Ctrl+C. `PORT=3015 node dist/src/main.js` permite elegir otro puerto.
Los datos se reinician al arrancar; no se pretende persistencia ni transacciones
distribuidas. La aplicación no necesita Docker ni servicios externos.

## Rechazos que se conservan

Cada carpeta contiene `case.ts` y `tsconfig.json` independientes con `noEmit`.
Ejecuta el compilador con `-p negative/<nombre>/tsconfig.json`. Todos los casos
siguientes terminaron con código 1; el gate exige su diagnóstico correspondiente:

| Carpeta                                                         | Capacidad ausente o entrada inválida | Códigos observados                 |
| --------------------------------------------------------------- | ------------------------------------ | ---------------------------------- |
| [disabled](negative/disabled/case.ts)                           | `if let` con opción desactivada      | TS1005, tres diagnósticos          |
| [wrong-operand](negative/wrong-operand/case.ts)                 | `unknown` sin refinar                | TS1360                             |
| [wrong-pattern](negative/wrong-pattern/case.ts)                 | Patrón `Ok(value)`                   | TS180001                           |
| [destructuring](negative/destructuring/case.ts)                 | `Some({ count })`                    | TS180001, TS180002, TS1128, TS1434 |
| [missing-block](negative/missing-block/case.ts)                 | Rama sin llaves                      | TS180002                           |
| [promise-without-await](negative/promise-without-await/case.ts) | Promise sin `await` explícito        | TS1360                             |
| [missing-payload](negative/missing-payload/case.ts)             | Etiqueta `some` sin `value`          | TS1360                             |

El diagnóstico actual del último caso muestra `Property '(Missing)'`; el informe
conserva ese texto. Los errores adicionales de destructuring corresponden a la
recuperación del parser tras el patrón no admitido.

## Límites

Solo existe el patrón `Some(identifier)`. No hay match general, patrones
Ok/Err/None, destructuring, while-let, let-else, `?`, espera implícita ni captura
automática de excepciones. El alias del import del constructor es TypeScript
estándar; no demuestra reescritura nativa de rutas `paths`.

Los mapas se verifican como artefactos con fuente original y mappings; no se
afirma depuración completa ni soporte de nodos if-let públicos en el AST.
Oxlint/Oxfmt y los parsers externos requieren adaptación propia. El consumidor
del perfil se compila por Typers y sus tests corren Node sobre el JS emitido.
El soporte de un adaptador de build no convierte el comando original `nest build`
en compatible con la API nativa.
