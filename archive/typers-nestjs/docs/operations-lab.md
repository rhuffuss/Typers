# Configuración, reservas y tareas dinámicas

Este laboratorio reserva unidades de inventario durante un plazo, confirma las
reservas válidas y devuelve capacidad al expirar. La lógica está en
[ReservationEngine](../src/operations-lab/reservation-engine.ts). La capacidad
confirmada permanece consumida. No procesa pagos ni comparte inventario con la
aplicación principal.

## Ejecutar

```sh
pnpm build
pnpm start:operations
```

Abre [Swagger del laboratorio](http://127.0.0.1:3007/docs). Escucha solo en
`127.0.0.1`, sin autenticación. `OPERATIONS_PORT` cambia el puerto;
`LAB_OPERATIONS_CAPACITY` configura 1–10000 unidades (100 por defecto) y
`LAB_OPERATIONS_HOLD_MS` configura 1–3600000 ms (60000 por defecto).

```sh
curl http://127.0.0.1:3007/v2/operations/holds \
  -H 'content-type: application/json' \
  -d '{"id":"workshop-seats","units":4,"holdMs":30000}'
curl -X POST http://127.0.0.1:3007/v2/operations/holds/workshop-seats/confirm
curl http://127.0.0.1:3007/v2/operations/summary
```

Un hold expira una vez; confirmar lo cancela. Se rechazan sobreventa, IDs
repetidos, duraciones inválidas y confirmación tardía. Los datos viven en memoria,
con máximo de 1000 reservas retenidas por proceso. Reiniciar vacía el inventario.

## APIs con contratos comprobados

| API / variante                                            | Ejemplo y evidencia                                                                                                                                |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registerAs`, `ConfigType`, `ConfigModule.forFeature`     | Capacidad y plazo tipados; configuración inválida impide el arranque.                                                                              |
| `.asProvider()` + `ConfigurableModuleBuilder`             | El módulo recibe la política mediante `forRootAsync`, con token y factory reales.                                                                  |
| `ConfigService.get` / `getOrThrow`, `infer`               | Acceso anidado tipado y error por clave ausente; contratos negativos de tipos.                                                                     |
| `envFilePath[]`, `validate`, `cache`                      | Dos archivos temporales: prioridad del primero y de la variable de shell; transformación de presupuesto a número. No se mide rendimiento de caché. |
| `SchedulerRegistry` timeouts                              | Alta, consulta, enumeración, comprobación y borrado al confirmar o expirar.                                                                        |
| `SchedulerRegistry` cron                                  | Cron real recupera una expiración cuyo timeout se perdió; cambio de expresión, próxima ejecución, parada/reinicio y borrado.                       |
| `SchedulerRegistry` intervals                             | Muestra real de capacidad con historial acotado a ocho entradas; duplicados y limpieza.                                                            |
| `VERSION_NEUTRAL`, versiones múltiples y `defaultVersion` | Status sin prefijo; política compartida por v1/v2; summary con contratos distintos.                                                                |
| Middleware versionado                                     | Cabecera de contrato solamente para la ruta URI v2.                                                                                                |
| Custom versioning de Fastify                              | El cliente ofrece varias versiones y recibe la mayor compatible; versiones desconocidas devuelven 404.                                             |

[Pruebas e2e](../test/operations-lab.e2e-spec.ts):

```sh
pnpm exec vitest run --config vitest.config.e2e.ts test/operations-lab.e2e-spec.ts
pnpm typecheck
```

Las pruebas arrancan cron/intervalos reales y comprueban que cerrar Nest elimina
todos los recursos registrados. El entrypoint HTTP usa timeouts por reserva;
cron y muestreo se activan explícitamente mediante el servicio en las pruebas.
El scheduler no es persistente ni distribuido. No se prueba aquí recuperación
tras reiniciar un proceso ni coordinación entre réplicas.

Fuentes oficiales: [configuración](https://docs.nestjs.com/techniques/configuration),
[scheduling](https://docs.nestjs.com/techniques/task-scheduling) y
[versionado](https://docs.nestjs.com/techniques/versioning). La selección de la
mayor versión entre varias utiliza Fastify según la limitación documentada de
Express. El módulo fue generado con Nest CLI `generate module operations-lab`.
