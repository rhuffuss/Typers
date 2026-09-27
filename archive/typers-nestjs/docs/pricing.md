# Presupuestos: lógica funcional y dinero con tipos

`src/business/pricing` contiene un motor puro de presupuestos de servicios, suscripciones y material de onboarding. No necesita Nest, bases de datos, reloj ni aleatoriedad. Su entrada y salida son deterministas: el mismo presupuesto produce el mismo JSON, incluso si cambia el orden de sus líneas.

## API y frontera

```ts
import {
  quote,
  quoteUnknown,
  getPricingCatalog,
} from './business/pricing/index.js';

const result = quote({
  currency: 'EUR',
  plan: 'team',
  items: [{ sku: 'api-build', quantity: 12 }],
  coupon: 'WELCOME10',
  budgetMinor: '100000',
});

if (result.ok)
  console.log(result.value.totals.totalMinor); // '71978'
else console.log(result.error.code, result.error.path);
```

`quote(input: QuoteInput): Result<Quote, PricingError>` valida también a los llamadores TypeScript. `quoteUnknown(input: unknown)` acepta directamente una entrada HTTP desconocida. `parseQuoteInput` permite validar por separado y devuelve una copia inmutable de la entrada. No se convierten strings a cantidades ni se aceptan campos desconocidos. Los errores conservan `code`, `message`, un `path` cuando corresponde y detalles JSON opcionales.

Los importes públicos son strings enteros en unidades mínimas: `'71978'` representa `719,78 EUR` o `719,78 USD`. Se rechazan decimales, signos, espacios, notación exponencial y ceros iniciales. La salida de `quote` y `getPricingCatalog()` se puede serializar con `JSON.stringify`. Los objetos internos `CATALOG` y `COUPONS` contienen `bigint`: para HTTP debe usarse la proyección `getPricingCatalog()`.

## Catálogo y límites

| SKU              | Precio EUR / USD en unidades mínimas | Cantidad máxima         | Categoría         |
| ---------------- | ------------------------------------ | ----------------------- | ----------------- |
| `api-build`      | 6000 / 7000                          | 160                     | servicio por hora |
| `security-audit` | 120000 / 140000                      | 3                       | servicio          |
| `support-seat`   | 2900 / 3200                          | 250                     | suscripción       |
| `onboarding-kit` | 7500 / 8500                          | 20; stock disponible 12 | físico            |
| `workshop`       | 50000 / 60000                        | 10                      | servicio          |

Los precios de ambas monedas son independientes; no se convierten mediante tipos de cambio. Se exige al menos una línea, como máximo cinco y un SKU único por línea. Las cantidades son enteros seguros positivos. Los duplicados se rechazan antes de calcular descuentos: el llamador debe combinar sus cantidades. El stock es un dato fijo de demostración y un presupuesto no reserva existencias.

El límite monetario es `999999999999` unidades mínimas. La fábrica monetaria comprueba entrada, suma, resta y multiplicación; rechaza negativos, desbordamientos y mezclas de moneda. Las multiplicaciones intermedias utilizan BigInt, incluido el cálculo de porcentajes, para evitar pérdida de precisión de coma flotante. Los límites actuales de catálogo mantienen los presupuestos ordinarios por debajo de ese máximo.

## Orden de reglas

1. Cargar precios y ordenar líneas por SKU.
2. Aplicar descuento de plan al neto elegible: `starter` 0%, `team` 5%, `enterprise` 10%. El material físico no participa.
3. Aplicar volumen por SKU, sobre su neto restante: 5% desde 10 unidades, 10% desde 25 y 15% desde 100. Participan `api-build` y `support-seat`.
4. Aplicar, si existe, un único cupón sobre el importe que queda.
5. Limitar la suma de descuentos al 30% del subtotal original, redondeado a unidades mínimas. Se conserva lo aplicado por las políticas anteriores y se reduce la política que alcanzaría el límite.
6. Calcular gastos de servicio y envío sobre importes después de descuentos.
7. Calcular los impuestos ficticios por línea y gasto, sumar el total y compararlo con `budgetMinor`.

Cada ajuste informa cuánto solicitó la política, cuánto se aplicó y si encontró el tope. Un cupón inválido, incompatible o por debajo del mínimo devuelve un error; no se ignora silenciosamente.

### Cupones

| Cupón       | Descuento             | Mínimo original | Restricciones                                     |
| ----------- | --------------------- | --------------- | ------------------------------------------------- |
| `WELCOME10` | 10%                   | 5000            | servicios y suscripciones; cualquier plan         |
| `TEAM20`    | 20%                   | 50000           | servicios y suscripciones; planes team/enterprise |
| `SAVE2500`  | 2500 unidades mínimas | 20000           | cualquier categoría y plan                        |

Los porcentajes se aplican sobre el importe restante. Un descuento de 5% seguido de 10% no equivale a 15% del subtotal original. Los descuentos agregados se reparten proporcionalmente entre las líneas elegibles; el método de mayores restos conserva exactamente cada céntimo y resuelve empates por SKU.

### Gastos e impuestos ficticios

Los servicios añaden un gasto del 2% de su neto, con mínimo 1500 y máximo 7500; `enterprise` queda exento. Las suscripciones y kits por sí solos no generan este gasto.

El envío estándar cuesta 1200 y es gratuito cuando el neto físico alcanza 30000. El exprés cuesta 2500 incluso superando ese umbral. Solicitar exprés sin artículos físicos es un error. Un cupón puede reducir el neto por debajo del envío gratuito: el ahorro final será entonces menor que el cupón.

**Las tasas son inventadas para ejercitar el compilador y las reglas de negocio; no representan normativa fiscal.** Se asignan 20% a servicios, 10% a suscripciones y 5% a kits; el gasto de servicio usa 20% y el envío 5%. Los impuestos se calculan después de descuentos y se redondean por línea. No se modelan jurisdicciones, exenciones ni facturas fiscales.

La regla de redondeo es siempre half-up: una fracción exacta de media unidad mínima sube a la siguiente. Los totales incluyen desglose de impuesto de líneas, gasto de servicio y envío. El presupuesto máximo admite igualdad y rechaza incluso una unidad mínima de exceso, incluidos impuestos y gastos.

## Estilos TypeScript ejercitados

- Funciones puras y composición `andThen` con `Result<T, E>` discriminado por `ok`.
- Políticas con unión discriminada y comprobación exhaustiva mediante `never`.
- Dinero genérico `Money<C>` con una marca `unique symbol`, datos `readonly` y `bigint`.
- `NoInfer<C>` en operaciones binarias: el segundo operando no puede ampliar EUR a EUR | USD para aceptar una mezcla. La comprobación de moneda en runtime protege también a llamadores cuyo tipo ya es la unión.
- Catálogos `as const satisfies Record<...>`, claves derivadas con `keyof`, acceso indexado, tipos literales, guardas de `unknown` y estrechamiento con `in`.
- Estrategias con `map`/`reduce`, builders locales y salida inmutable; destructuring, spreads condicionales y plantillas de strings.
- `pricing.type-test.ts` contiene aserciones positivas y negativas con `@ts-expect-error`. Vitest no ejecuta ese archivo. TypeScript lo comprueba junto con la aplicación; perder una restricción hace fallar las directivas que dejan de encontrar el error esperado. La función exportada del fixture no debe invocarse: contiene expresamente operaciones inválidas.

## Verificación

```sh
pnpm exec vitest run src/business/pricing
pnpm exec tsc --noEmit
pnpm exec oxlint --type-aware src/business/pricing
```

Las pruebas verifican importes completos conocidos, umbrales, orden de descuentos, topes, reparto proporcional, monedas, gastos, stock, presupuesto máximo, serialización, copias inmutables y errores de entrada. Un barrido de proporciones comprueba que las asignaciones conservan el total sin sobregirar ninguna línea.

Este motor usa TypeScript estándar como referencia. Su ejecución con Typers, los cambios de catálogo persistentes, las reservas de stock, los pagos y la fiscalidad real requieren trabajos independientes.
