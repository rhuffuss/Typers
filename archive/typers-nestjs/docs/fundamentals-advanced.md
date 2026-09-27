# DI avanzada: tenants, consumidores y dependencias opcionales

Laboratorio independiente en `src/fundamentals-advanced`. Amplía los casos de DI
con cotizaciones por tenant, recibos opcionalmente personalizados y autorización
de crédito. El módulo se generó con el CLI instalado:

```sh
pnpm exec nest generate module fundamentals-advanced --skip-import --no-spec
```

No se importa desde la aplicación principal. No necesita bases de datos ni
servicios externos. La comparación de compiladores se registra por separado en
[Typers](typers.md).

## Tenant durable y petición efímera

`AllowedTenantContextStrategy` implementa `ContextIdStrategy.attach()` y se
registra con `ContextIdFactory.apply()`. Solo acepta los tenants `acme`, `globex`
e `initech`; ausencia, valores desconocidos o ambiguos producen 403 antes de
crear entradas. `HostComponentInfo.isTreeDurable` elige el contexto compartido o
el contexto original de la petición.

`TenantRateBook` usa `@Injectable({ scope: Scope.REQUEST, durable: true })`. Su
provider `TENANT_PAYLOAD` también es durable y obtiene `REQUEST` mediante una
factory. Copia únicamente `{ tenantId }`, congelado; no retiene el objeto de la
primera petición, cabeceras ni identidad de usuario. El controlador y
`RequestAuditContext` tienen `durable: false`: cada petición conserva su propio
UUID y etiqueta aunque comparta el mismo libro de precios.

| Tenant    | Precio por unidad en céntimos EUR | Total para dos unidades |
| --------- | --------------------------------- | ----------------------- |
| `acme`    | 1250                              | 2500                    |
| `globex`  | 2000                              | 4000                    |
| `initech` | 1750                              | 3500                    |

La cotización admite de 1 a 1000 unidades enteras. La respuesta expone
`rateBookId`, `requestId`, `requestTag` y `contextFields` para observar la DI en
este laboratorio. La configuración de precios es inmutable y separada del
contexto; una expulsión no pierde registros de negocio ni cambia los precios.

La caché LRU mantiene como máximo **dos identidades de contexto**. Una tercera
entrada expulsa la menos reciente. Volver al tenant expulsado crea otro libro de
precios, siempre con su configuración. `lab.close()` cierra Nest, vacía la caché
y aplica una estrategia ordinaria que devuelve contextos independientes.

**Límites:** `ContextIdFactory.apply()` es global al proceso. Este harness exige
ser el único propietario de la estrategia y debe ejecutarse en un proceso
dedicado; no preserva una estrategia personalizada ajena. La eliminación de
referencias permite la recolección por JavaScript, pero no garantiza cuándo
ocurre ni afirma hooks de destrucción por cada provider request-scoped. Los
providers durables del ejemplo no poseen sockets ni conexiones. La allowlist
acota y valida la selección de tenant; la cabecera de esta demo no autentica
usuarios ni comprueba su pertenencia a una organización.

## INQUIRER y dependencias opcionales

`ConsumerAudit` es transient e inyecta `INQUIRER`. `PurchaseReviewService` y
`CreditReviewService` reciben instancias diferentes que registran el tipo
consumidor y la acción de revisión. Las pruebas comparan el constructor real
recibido, los nombres y los IDs de auditoría. No exigen igualdad `===` entre el
objeto de construcción de INQUIRER y la instancia final obtenida con `app.get()`.

`ExpenseReceiptService` tiene un prefijo opcional por constructor.
`ReceiptPresenter`, su base, usa inyección por propiedad: símbolo monetario
obligatorio y pie opcional. El ejemplo prueba tanto ausencia como presencia de
ambos providers opcionales. La factory de `REMINDER_SCHEDULE` recibe una
dependencia obligatoria y otra declarada `{ token, optional: true }`, manteniendo
un plazo de siete días por defecto o sumando la extensión configurada.

También se comprueban dos fallos de wiring: una propiedad requerida ausente y
un constructor derivado que no repite `@Optional()`. Este último es un caso
específico de Nest 12: el decorador opcional del constructor base no hace opcional
una dependencia requerida declarada en el constructor de la subclase.

## Testing y factory fallida

El módulo normal registra un adaptador local de crédito con `useClass`.
La prueba de `Test.createTestingModule().useMocker()` omite ese adaptador y crea
un doble exclusivamente para `ProjectCreditClient`. `CreditAuthorizationService`
conserva su lógica real: valida el importe, compara saldo y rechaza saldo inválido
o indisponibilidad del adaptador. Se verifica el mock registrado mediante `get()`
y se cierra el módulo. INQUIRER y REQUEST se ejercitan con Nest real, sin mocks.

Una prueba adicional comprueba que el rechazo de una factory asíncrona requerida
impide compilar el módulo y conserva el error original.

## Ejecutar

```sh
pnpm exec vitest run --config vitest.config.e2e.ts test/fundamentals-advanced.e2e-spec.ts
pnpm typecheck
pnpm exec oxlint --type-aware src/fundamentals-advanced test/fundamentals-advanced.e2e-spec.ts
```

Las 14 pruebas incluyen HTTP real con puerto aleatorio, solicitudes simultáneas,
aislamiento, expulsión LRU, validación, cierre, identidad del consumidor,
dependencias presentes/ausentes, mocks selectivos y errores de construcción.

Para inspección manual después de `pnpm build`, en una terminal dedicada:

```sh
pnpm start:di
```

En otra terminal:

```sh
curl 'http://127.0.0.1:3008/api/tenant-quotes?units=2' \
  -H 'x-tenant-id: acme' -H 'x-demo-request-tag: first-person'
curl http://127.0.0.1:3008/api/di/audit
curl http://127.0.0.1:3008/api/di/receipt
curl 'http://127.0.0.1:3008/api/di/credit?amountMinor=10001'
```

Ctrl+C invoca `lab.close()`. Para probar configuración explícita, pasa
`{ receiptPrefix: 'expense', receiptFooter: 'Retain for review', reminderExtraDays: 3 }`
a la factory del harness.

## Fuentes oficiales

- [INQUIRER y providers durables](https://docs.nestjs.com/fundamentals/injection-scopes).
- [Providers opcionales e inyección por propiedad](https://docs.nestjs.com/providers).
- [Factories e inject opcional](https://docs.nestjs.com/fundamentals/custom-providers).
- [Testing y useMocker](https://docs.nestjs.com/fundamentals/testing#auto-mocking).
- [Migración Nest 12 y Optional](https://docs.nestjs.com/migration-guide).
