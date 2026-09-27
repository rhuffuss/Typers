# Variedad de TypeScript aplicada al negocio

El corpus combina NestJS con reglas de negocio que producen resultados comprobables. Cada estilo tiene una función concreta: cálculo puro en presupuestos, algoritmos y streams en planificación, objetos con invariantes en gastos y coordinación por inyección en HTTP.

## Mapa de estilos y construcciones

| Estilo / construcción                                                              | Uso concreto                                                                                         | Fuente                                                                                                                    |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Funcional y composición                                                            | Descuentos ordenados, reparto proporcional y cálculo sin efectos externos                            | [Pricing](../src/business/pricing/quote.ts), [políticas](../src/business/pricing/policies.ts)                             |
| `bigint` y marca `unique symbol`                                                   | Dinero exacto; el tipo diferencia EUR y USD                                                          | [Money](../src/business/pricing/money.ts)                                                                                 |
| Genéricos restringidos y `NoInfer`                                                 | El segundo operando no amplía la moneda inferida para permitir mezclas                               | [Money](../src/business/pricing/money.ts), [contratos](../src/business/pricing/pricing.type-test.ts)                      |
| `as const`, `satisfies`, `keyof`, acceso indexado                                  | Catálogo de SKU, planes, categorías y cupones comprobado sin perder literales                        | [Catálogo](../src/business/pricing/catalog.ts)                                                                            |
| `unknown`, guardas, narrowing y copia de entrada                                   | Validación real de HTTP y llamadas directas al dominio                                               | [Entrada de presupuesto](../src/business/pricing/validation.ts), [entrada del plan](../src/business/planning/input.ts)    |
| Uniones discriminadas y `never`                                                    | Resultados de éxito/error, políticas, errores de planificación y comandos con payload correlacionado | [Resultados](../src/business/pricing/result.ts), [adaptador](../src/business/business.service.ts)                         |
| Tipos condicionales con `infer`                                                    | Extraer valor/error de un resultado y crear contratos derivados                                      | [Tipos del plan](../src/business/planning/types.ts), [frontera HTTP](../src/business/business-errors.ts)                  |
| Mapped types y utilidades `Pick`, `Extract`, `Parameters`, `ReturnType`, `Awaited` | Proyecciones de tareas, errores por código y comandos derivados de métodos del workflow              | [Tipos del plan](../src/business/planning/types.ts), [comandos](../src/business/business.service.ts)                      |
| Recursión de tipos y datos `readonly`                                              | Describir planes anidados de solo lectura y preservar arrays en contratos                            | [DeepReadonly](../src/business/planning/types.ts)                                                                         |
| Template literal types                                                             | Claves de reportes `day:N/task:ID` y variables `DEMO_ROLE_PASSWORD`                                  | [Reportes](../src/business/planning/reporting.ts), [identidades](../src/security/demo-users.service.ts)                   |
| Imperativo y estructuras de datos                                                  | Grafo de dependencias, detección de ciclos y asignación diaria mediante mapas y conjuntos            | [Planificador](../src/business/planning/planner.ts)                                                                       |
| Generadores e iteración perezosa                                                   | Recorrer asignaciones y seleccionar campos sin materializar otro informe completo                    | [Reportes](../src/business/planning/reporting.ts)                                                                         |
| `AsyncIterable`, `async function*`, `for await`, cancelación                       | Procesar planes por lotes y cerrar el productor al abortar                                           | [Lotes](../src/business/planning/reporting.ts)                                                                            |
| OOP y encapsulación con `#private`                                                 | Proteger el estado de un gasto y producir nuevos snapshots en cada transición                        | [Agregado](../src/business/approvals/expense-request.ts)                                                                  |
| Clase abstracta, herencia, `override`, getters y `protected`                       | Identidad/versionado del agregado y políticas de aprobación sustituibles                             | [Agregado](../src/business/approvals/expense-request.ts), [política](../src/business/approvals/approval-policy.ts)        |
| Sobrecargas                                                                        | Construir un importe de gasto desde parámetros o desde un objeto                                     | [ExpenseMoney](../src/business/approvals/approval-policy.ts)                                                              |
| Typestate y parámetro `this`                                                       | Una solicitud conocida como borrador no admite pago en el comprobador de tipos                       | [Agregado](../src/business/approvals/expense-request.ts), [contratos](../src/business/approvals/expense.type-test.ts)     |
| Interfaces estructurales y composición                                             | Sustituir repositorio y política; coordinar cambios sin ligar el dominio a Nest                      | [Repositorio](../src/business/approvals/expense.repository.ts), [workflow](../src/business/approvals/expense.workflow.ts) |
| Promesas y concurrencia                                                            | Comparación atómica de versión, claves de pago y reintentos sin eventos duplicados                   | [Repositorio](../src/business/approvals/expense.repository.ts)                                                            |
| Decoradores legacy, DI y DTOs con herencia                                         | Llevar las reglas a Nest, autenticar actores y validar comandos HTTP                                 | [Módulo](../src/business/business.module.ts), [DTOs](../src/business/business.dto.ts)                                     |
| Imports/exports ESM y `import type`                                                | Separar dependencias de runtime y contratos borrados; ejecutar salida con Node                       | [Smoke ESM](../scripts/check-business-emitted.mjs)                                                                        |

Los laboratorios existentes añaden interfaces GraphQL, mapped DTOs de Swagger, proveedores asíncronos, enums, decoradores de parámetros, `Observable`, RxJS, streams, errores con clases, módulos dinámicos y APIs basadas en callbacks. No se fuerza un único estilo a todo el proyecto.

Los esquemas de respuesta OpenAPI también usan `Record<keyof DomainType, SchemaObject>` para comprobar que se describen todas las propiedades de los contratos, incluidos versiones y eventos. [Schemas de respuestas](../src/business/business-response.schemas.ts).

## Tres niveles de evidencia

1. **Tipos:** `pnpm typecheck:business` comprueba implementaciones y archivos `*.type-test.ts`. Hay ejemplos válidos y negativos con `@ts-expect-error`: monedas incompatibles, estados ilegales, claves de proyección inexistentes y comandos incompletos. Estas fuentes no se ejecutan ni se emiten al build de la aplicación.
2. **Comportamiento:** `pnpm test:business` comprueba reglas, umbrales, redondeos, invariantes, concurrencia, cancelación y errores. `test/business.e2e-spec.ts` comprueba los flujos HTTP con usuarios y roles distintos.
3. **Emisión:** `pnpm test:business:emitted` ejecuta diez comprobaciones sobre el JavaScript ESM emitido con Node. Incluye BigInt, generadores asíncronos, metadatos de inyección y el ciclo completo del gasto. Acepta un directorio de salida alternativo para comparar compiladores.

Los informes JSON de Vitest quedan en `reports/unit.json`, `reports/e2e.json` y `reports/integration.json`, fuera de Git. Un resultado verde de Vitest sobre fuentes no demuestra por sí solo que Typers haya emitido ese código.

## Perfiles de lenguaje adicionales

El [laboratorio de lenguaje](language-lab.md) compila fuentes independientes con TypeScript oficial y ejecuta su ESM mediante Node. Sus seis pruebas están incluidas en la suite e2e. El perfil de contratos añade doce rechazos esperados, que no se cuentan como pruebas de runtime.

| Construcción                                                    | Uso de negocio                                                                                                                |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Declaration merging, module augmentation y namespace `JSX`      | Registro extensible de eventos y tipos del reporte. Registrar un tipo también requiere registrar y validar su implementación. |
| Mixins de clases y capacidades estructurales                    | Pedido que combina versionado y auditoría con estado privado por instancia.                                                   |
| `with { type: 'json' }`                                         | Condiciones de pago y cálculo de vencimiento a partir de un JSON cargado por Node.                                            |
| Decoradores estándar, auto-accessors, `addInitializer`          | Aprobación con roles, límites y método ligado al receptor. Perfil separado de los decoradores legacy de Nest.                 |
| TSX, componentes y fragmentos                                   | Reporte textual de factura con comprobación de moneda y totales. Runtime propio sin React.                                    |
| `using`, `await using`, `Symbol.dispose`, `Symbol.asyncDispose` | Exportación de factura con lock, archivos reales, rollback por cancelación y `SuppressedError`.                               |

La [DI avanzada](fundamentals-advanced.md) añade herencia con inyección opcional, factories y genéricos de estrategias de contexto. [Operaciones](operations-lab.md) añade inferencia de claves anidadas con `ConfigType` y contratos negativos de configuración.

## Límites del inventario

Este mapa contiene construcciones realmente utilizadas. No declara cobertura exhaustiva del lenguaje. Los nuevos perfiles aislados cubren las construcciones de la tabla siguiente; siguen pendientes otros tipos de decoradores, bibliotecas JSX externas y más interacciones entre tipos condicionales, sobrecargas y resolución de módulos.

Los tipos se borran: un `readonly`, una marca monetaria o el estado genérico de una solicitud no valida por sí solo un JSON. Las fronteras validan entradas y los métodos comprueban las transiciones también en runtime. `any`, casts dobles o supresiones globales no se utilizan para simular garantías de negocio.

Los Result de estos dominios son uniones estructurales de TypeScript estándar. La
[demostración de Typers](typers-features.md) añade presupuestos y reservas
independientes que sí importan `@typers/core` y usan `if let Some`. Conserva esta
referencia y permite comparar los contratos explícitamente. La comparación del
corpus estándar permanece en su [guía separada](typers-comparison.md).
