# Runtime Result/Option aplicado a presupuestos

Perfil aislado, escrito en TypeScript estándar, construido realmente por Typers.
La aplicación de referencia en `src/` no importa este paquete. El runtime local
es `@typers/core@0.1.0-alpha.0`: continúa siendo experimental y privado.

## Reproducir

Desde la raíz del repositorio, con los tres tarballs actuales:

```sh
pnpm demo:typers \
  --compiler ../typers/built/typers/typers-compiler-7.0.2-typers.0.tgz \
  --core ../typers/built/typers/typers-core-0.1.0-alpha.0.tgz \
  --nest ../typers/built/typers/typers-nest-0.1.0-alpha.0.tgz \
  --profile runtime
```

El orquestador imprime la carpeta temporal reproducible e identifica los
artefactos por hash. Dentro de su `profiles/runtime`, los pasos individuales son:

```sh
node ../../node_modules/.bin/typers -p tsconfig.json --pretty false
node --test runtime.test.mjs
node ../../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit --pretty false
```

La última orden usa TypeScript oficial 6 para comprobar tipos del perfil estándar.
La ejecución Node importa exclusivamente `dist/src/budget.js` y el `.cjs` emitido
por Typers; no existe un transformer Vitest ni compilación alternativa del JS.

## Índice revisable

| Capacidad disponible                        | Fuente                                                                     | Resultado / contrato                                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Ok`, `Err`, `Result<T,E>`                  | [src/budget.ts](src/budget.ts)                                             | Presupuesto válido: 3 × 1001 céntimos, descuento 10 %, total 2703; error tipado al superar el límite. |
| `Some`, `None`, `Option<T>`, `fromNullable` | [src/budget.ts](src/budget.ts)                                             | Descuento explícito `0` conserva presencia; descuento omitido o `null` es ausencia.                   |
| Validación de `unknown`                     | [src/budget.ts](src/budget.ts)                                             | JSON inválido devuelve `INVALID_INPUT`; las uniones no validan datos externos por sí solas.           |
| Protocolo estructural                       | `decodeStock` en [src/budget.ts](src/budget.ts)                            | `{kind:'some',value:0}` válido; payload de texto, payload ausente y etiqueta desconocida se rechazan. |
| Los cinco exports runtime, ESM y CommonJS   | [runtime.test.mjs](runtime.test.mjs), [src/commonjs.cts](src/commonjs.cts) | Inventario exacto, payloads falsy, referencias, `None` congelado y reservas con presencia/ausencia.   |
| Los seis tipos públicos                     | [src/type-contracts.ts](src/type-contracts.ts)                             | `Some<T>`, `None`, `Option<T>`, `Ok<T>`, `Err<E>`, `Result<T,E>`, narrowing y `NonNullable<T>`.       |
| Contratos negativos de tipos                | [src/type-contracts.ts](src/type-contracts.ts)                             | `@ts-expect-error` exige readonly, narrowing, variantes correctas y tipos de payload/error.           |
| Excepciones y promesas normales             | `quoteFromProvider` y `quoteFromAsyncProvider`                             | Un throw o rechazo de dependencia se propaga; `Result` no lo captura.                                 |

`runtime.test.mjs` contiene **11 contratos Node**. La ejecución local con los
tarballs reconstruidos del compilador en `efe9894` pasó los 11, la compilación
nativa y la comprobación de tipos con TypeScript oficial 6. El informe del
orquestador conserva la identificación exacta de cada ejecución nueva.

## Inspección manual

1. Lee `parseQuoteInput`: valida números, céntimos decimales y descuento antes de
   crear valores de dominio; el dinero usa `bigint` para conservar precisión.
2. Lee `createQuote`: sigue `Result` con `kind` y usa `Option` para distinguir el
   descuento ausente del descuento explícito cero. El descuento redondea hacia
   abajo a céntimos enteros.
3. Compara `src/budget.ts` con `dist/src/budget.js` y `dist/src/budget.d.ts` del
   consumidor temporal. Inspecciona también `dist/src/commonjs.cjs`.
4. Cambia un ejemplo o un contrato negativo y vuelve a ejecutar el perfil. Los
   comentarios `@ts-expect-error` deben fallar si el error esperado desaparece.

## Límites reales

- Los payloads conservan su referencia y mutabilidad habitual; `readonly` no es
  congelación profunda. Solo el valor compartido `None` está congelado.
- `Some(undefined)` y `Some(null)` son presencia. `fromNullable` convierte esos
  dos valores a ausencia; conserva `0`, `false`, cadena vacía y `NaN`.
- La identidad de `None` pertenece a una instancia del módulo. La prueba cruza
  ESM/CJS usando `kind`, sin exigir identidad referencial entre distribuciones.
- No hay `unwrap`, `map`, `mapErr`, `andThen`, captura automática ni propagación
  con `?`. Ningún ejemplo define esos métodos como si pertenecieran al runtime.
- Este perfil no demuestra sintaxis propia. Esa prueba está separada en
  [experimental](../experimental/README.md).
