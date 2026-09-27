# Negocio: presupuestos, entregas y gastos

La aplicación incluye tres dominios conectados a proyectos existentes. El módulo se generó con Nest CLI (`module`, `controller`, `service`) y después se implementaron sus reglas. Los cálculos permiten comparar estilos de TypeScript; los casos HTTP incluyen autenticación, DTOs, errores, inyección y serialización.

## Flujos disponibles

Las rutas cuelgan de `/api/v1/projects/:projectId/business`. Todas requieren JWT y un proyecto existente. Un proyecto archivado permite consultar gastos ya existentes, pero no calcular nuevas propuestas ni cambiar su estado.

| Método / ruta               | Flujo                   | Reglas                                                                                                                                                       |
| --------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST `quotes`               | Presupuesto comercial   | Catálogo, cantidades, disponibilidad, plan, volumen, cupón, límite de descuento, distribución de céntimos, costes, impuestos de ejemplo y presupuesto máximo |
| POST `plans`                | Simulación de entrega   | Dependencias, ciclos, prioridad, capacidad diaria compartida, esfuerzo divisible, fecha mínima de inicio, plazos, coste y advertencias                       |
| POST `expenses`             | Borrador de gasto       | Importe entero, moneda, solicitante obtenido del JWT y proyecto fijado por la ruta                                                                           |
| GET `expenses/:id`          | Consulta y auditoría    | Solo solicitante o revisores; un gasto de otro proyecto devuelve 404                                                                                         |
| POST `expenses/:id/submit`  | Presentar solicitud     | Solo solicitante; fija los requisitos de aprobación de la política                                                                                           |
| POST `expenses/:id/approve` | Registrar aprobación    | Personas diferentes, sin autoaprobación, quórum y roles según importe                                                                                        |
| POST `expenses/:id/reject`  | Rechazar                | Motivo obligatorio y estado terminal                                                                                                                         |
| POST `expenses/:id/pay`     | Registrar pago simulado | Finanzas/admin, estado aprobado, control de versión y clave de idempotencia                                                                                  |

Los presupuestos y planes son simulaciones: no alteran las tareas persistidas del proyecto. Los gastos y su auditoría viven en un repositorio de memoria, incluso cuando los proyectos usan PostgreSQL. Se pierden al reiniciar. La versión y la idempotencia se coordinan dentro de una instancia; este repositorio no ofrece atomicidad distribuida ni una transacción conjunta con PostgreSQL. El pago registra un recibo local y no realiza transferencias.

## Probar un flujo completo en Swagger

Primero crea un proyecto mediante `/api/v1/projects` usando el administrador. Usa el UUID devuelto en las rutas de negocio. Si utilizas el repositorio en memoria, existe el proyecto `00000000-0000-4000-8000-000000000010`.

| Identidad local         | Contraseña                  | Papel en el flujo                                      |
| ----------------------- | --------------------------- | ------------------------------------------------------ |
| `member@typers.local`   | `TypersDemo-Member-2026!`   | Solicita y presenta el gasto                           |
| `approver@typers.local` | `TypersDemo-Approver-2026!` | Revisa solicitudes de otras personas                   |
| `finance@typers.local`  | `TypersDemo-Finance-2026!`  | Revisa y registra pagos                                |
| `admin@typers.local`    | `TypersDemo-Admin-2026!`    | Administración y revisión; tampoco puede autoaprobarse |

Estas tres cuentas nuevas se crean en desarrollo/test. En producción cada una exige su propia `DEMO_MEMBER_PASSWORD`, `DEMO_APPROVER_PASSWORD` o `DEMO_FINANCE_PASSWORD` para habilitarse. También admiten la variable `DEMO_<ROLE>_EMAIL`. Las cuentas originales mantienen su configuración.

1. Haz login como miembro y crea un gasto con `{ "title": "Security review", "amountMinor": 12000, "currency": "EUR" }`.
2. Presenta el gasto con `{ "expectedVersion": 1 }`. Conserva siempre la nueva `version` de la respuesta.
3. Cambia el token de Swagger al aprobador y aprueba con la versión actual.
4. Cambia al usuario de finanzas y llama a `pay` con `{ "expectedVersion": 3, "idempotencyKey": "security-review-payment-001" }`.
5. Repite exactamente el mismo pago: devuelve el mismo recibo y auditoría. Reutilizar la clave con una versión o solicitud diferente devuelve 409.

Para probar el quórum mayor, solicita más de 500000 unidades mínimas: necesitarás aprobador, finanzas y administrador distintos del solicitante. Consulta [aprobaciones](approvals.md) para umbrales, transiciones y las garantías del repositorio.

## Presupuestos y planes

Ejemplo de presupuesto:

```json
{
  "currency": "EUR",
  "plan": "team",
  "items": [{ "sku": "api-build", "quantity": 12 }],
  "coupon": "WELCOME10"
}
```

El resultado monetario utiliza strings de unidades mínimas para preservar la precisión de `bigint` al pasar por JSON. Las reglas fiscales son datos ficticios del laboratorio. [Reglas y cálculo](pricing.md).

Ejemplo de plan:

```json
{
  "startDate": "2026-09-15",
  "dailyCapacityUnits": 4,
  "costPerUnitCents": 100,
  "budgetCents": 1000,
  "tasks": [
    { "id": "design", "effortUnits": 4 },
    {
      "id": "build",
      "effortUnits": 8,
      "dependencies": ["design"],
      "deadlineDay": 1
    }
  ]
}
```

El plan necesita tres días, cuesta 1200 unidades mínimas y advierte de presupuesto y plazo incumplidos. Las tareas empiezan después de finalizar sus dependencias; un ciclo impide generar el plan. Son días consecutivos de simulación, no un calendario de jornadas laborales. [Planificación y reportes](planning.md).

## Pruebas y comparación de compiladores

```sh
pnpm test:business
pnpm typecheck:business
pnpm exec vitest run --config vitest.config.e2e.ts test/business.e2e-spec.ts
pnpm build
pnpm test:business:emitted
```

El último comando importa el JavaScript ESM emitido con Node, calcula un presupuesto y un plan, consume un generador asíncrono y ejecuta el flujo JWT de gasto hasta el pago idempotente. No utiliza la transformación TypeScript de Vitest. Para comparar otra salida: `node scripts/check-business-emitted.mjs dist-typers` después de producirla con el compilador elegido.

Los archivos `*.type-test.ts` contienen asignaciones válidas y rechazos intencionados con `@ts-expect-error`. Se comprueban con TypeScript y se excluyen del build y de la ejecución. Si un caso deja de producir el error esperado, el compilador falla por una directiva no utilizada. [Inventario de estilos y tipos](typescript-patterns.md).
