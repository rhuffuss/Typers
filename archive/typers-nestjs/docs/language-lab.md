# Laboratorio de lenguaje TypeScript

Estos escenarios amplían la referencia de negocio con construcciones que requieren configuración o emisión específica. Sus fuentes están en `src/language-lab/fixtures`; las extensiones `.ts.template` y `.tsx.template` se convierten en TypeScript dentro de un paquete temporal. Así se conserva la configuración de decoradores legacy de Nest y se puede probar por separado el comportamiento de otros perfiles.

No se usan dependencias nuevas. El compilador es el TypeScript oficial instalado en el repositorio; Node ejecuta su JavaScript ESM emitido. Vitest coordina los procesos y comprueba sus resultados, sin transformar las fuentes de los escenarios.

## Ejecución

```sh
pnpm exec vitest run --config vitest.config.e2e.ts test/language-lab.e2e-spec.ts
```

El harness materializa el paquete, compila tres perfiles de ejecución y un perfil de contratos de tipos, ejecuta seis programas con Node y elimina el workspace. Cada proceso tiene un timeout. Los escenarios de archivos crean sus propios directorios temporales y los eliminan incluso ante errores.

Para inspeccionar los artefactos y ejecutarlos manualmente:

```sh
node src/language-lab/prepare-workspace.ts
```

El helper imprime el directorio, los cuatro comandos `tsc -p`, los seis entrypoints Node y el comando de limpieza. Los artefactos manuales permanecen hasta esa limpieza; la prueba automatizada los elimina al terminar.

## Escenarios y evidencia

| Fuente del fixture                                      | Caso de negocio                                           | Comportamiento verificado                                                                                                                                                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/events.ts`, `billing-events.ts`, `events.main.ts` | Registro extensible de eventos de presupuestos y facturas | El plugin amplía el mapa de tipos; publicar antes de registrarlo falla, una factura válida llega al listener, un importe inválido se rechaza y cancelar la suscripción detiene la entrega.                                                   |
| `core/mixins.ts`, `mixins.main.ts`                      | Pedido con versión, auditoría y estados                   | Componer capacidades conserva el identificador y los miembros tipados. Un cambio obsoleto, una cantidad negativa y una edición posterior al envío se rechazan sin alterar el total o la versión. Dos pedidos mantienen estado independiente. |
| `core/imports.main.ts`, `payment-terms.json`            | Condiciones y fecha de vencimiento                        | Node carga JSON con `with { type: 'json' }` conservado en el ESM emitido. Treinta días desde 2026-09-15 producen 2026-10-15.                                                                                                                 |
| `decorators/approval.ts`, `decorators/main.ts`          | Decisión de aprobación con rol y límite                   | Decoradores estándar de clase, método y auto-accessor. Un lector no aprueba, un límite inválido no sustituye el valor previo y un método extraído conserva su receptor mediante `addInitializer`.                                            |
| `report/jsx-runtime.ts`, `report/main.tsx`              | Reporte textual de factura                                | TSX genera un árbol con componentes, fragmentos y elementos tipados. El runtime comprueba importes, moneda y suma; el reporte contiene 120,00 + 15,00 = 135,00 EUR. No monta una interfaz de usuario.                                        |
| `resources/export-session.ts`, `resources/main.ts`      | Exportación de factura con lock y archivo temporal        | `using` y `await using` liberan lock, descriptor y staging en orden inverso. La cancelación no publica el borrador; un lock duplicado falla. Una excepción de negocio seguida de otra al liberar conserva ambas mediante `SuppressedError`.  |

La prueba automatizada contiene **seis casos de comportamiento**. El perfil de contratos contiene **doce rechazos esperados** con `@ts-expect-error`, además de usos positivos. Las directivas que dejan de encontrar un error hacen fallar la compilación. Los archivos `*.type-test.ts` y `*.type-test.tsx` no se emiten ni se ejecutan.

## Configuraciones independientes

| Configuración dentro del fixture | Función                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `tsconfig.base.json`             | NodeNext/ESM, ES2023, comprobación estricta, emisión de declaraciones, resolución JSON y biblioteca `ESNext.Disposable`. |
| `tsconfig.core.json`             | Eventos, mixins, JSON y recursos.                                                                                        |
| `tsconfig.decorators.json`       | Decoradores estándar con `experimentalDecorators: false` y `emitDecoratorMetadata: false`.                               |
| `tsconfig.report.json`           | TSX con `jsx: react-jsx` y `jsxImportSource: @language/report`.                                                          |
| `tsconfig.contracts.json`        | Contratos positivos/negativos con `noEmit`.                                                                              |
| `tsconfig.json`                  | Vista conjunta para herramientas de análisis, también sin emisión.                                                       |

El paquete temporal se llama `@language/report` y publica su propio subpath `./jsx-runtime`: TypeScript encuentra su namespace `JSX` y Node encuentra el runtime emitido mediante `exports`. La transformación automática se llama `react-jsx`, pero el fixture no depende de React.

El retorno público de los mixins usa interfaces de capacidad explícitas. Esto permite emitir declaraciones conservando campos privados `#revision` y `#events` dentro de sus clases: la API pública no intenta exponer esos campos privados de clases anónimas.

El perfil estándar genera los helpers de decoradores de TypeScript, comprobados en el archivo emitido, y no genera `design:paramtypes`. No se aplica a los módulos Nest. Los decoradores de parámetro se incluyen como rechazo de compilación en este perfil, mientras siguen presentes y válidos en la referencia legacy de Nest.

`using` y `await using` se compilan con destino ES2023; la emisión de TypeScript implementa el protocolo de liberación mediante `Symbol.dispose` y `Symbol.asyncDispose`. La prueba acredita esa salida en Node 24, no la ejecución directa de sintaxis TypeScript ni que todos los motores acepten sintaxis nativa `using`.

## Análisis focalizado

Desde la raíz del repositorio:

```sh
pnpm exec tsc --noEmit
pnpm exec oxlint --type-aware src/language-lab/prepare-workspace.ts test/language-lab.e2e-spec.ts
```

Después de materializar el fixture y entrar en el directorio impreso:

```sh
node node_modules/typescript/bin/tsc -p tsconfig.contracts.json
node_modules/.bin/oxlint --type-aware --ignore-pattern '**/*.type-test.*' src
```

Los casos negativos se comprueban con TypeScript y se excluyen del lint de código ejecutable. Hay una excepción local documentada para `unbound-method`: el decorador `@Bound` instala el binding en runtime, y la prueba Node verifica precisamente la llamada separada del objeto. No se sustituye por una arrow function ni se cambia de compilador.

## Fuentes y límites

- [Declaration merging y module augmentation](https://www.typescriptlang.org/docs/handbook/declaration-merging.html): ampliar el tipo del registro no registra código en runtime; el plugin hace ambas cosas explícitamente.
- [Mixins](https://www.typescriptlang.org/docs/handbook/mixins.html): composición de clases con restricciones sobre las capacidades del constructor base.
- [Decoradores estándar en TypeScript 5.0](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html): contextos, inicializadores y separación respecto a decoradores experimentales.
- [Gestión explícita de recursos](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html): liberación síncrona/asíncrona y errores suprimidos.
- [Atributos de importación](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-3.html): conservación de atributos que interpreta el runtime.
- [JSX](https://www.typescriptlang.org/docs/handbook/jsx.html): elementos intrínsecos, componentes y tipos del runtime.

Los eventos no son un broker distribuido y sus plugins no se cargan desde terceros. Los pedidos y decisiones son simulaciones. La exportación demuestra recursos locales, sin base de datos ni pagos. Quedan fuera otros tipos de decorador, publicación de paquetes, JSX de bibliotecas externas y otras variantes de importación o disposición. La [comparación independiente](typers-comparison.md) ejecutó estos perfiles con Typers y TypeScript 7, con resultados JSON iguales a la referencia TypeScript 6 para los seis programas. Esa medición no cubre otras configuraciones del lenguaje.
