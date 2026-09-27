# Técnicas y plataforma HTTP

La aplicación principal expone `/api/v1/techniques/*`, `/api/v1/health`,
`/docs`, `/openapi.json` y `/static/demo.txt`.

| Caso                                              | Ruta / implementación        | Comprobación                                            |
| ------------------------------------------------- | ---------------------------- | ------------------------------------------------------- |
| Pipes de enteros, booleanos, arrays, UUID y enums | `pipes/:id`                  | conversiones y 400                                      |
| Standard Schema v12 con Zod                       | `POST schema`                | entrada inválida y filtrado de respuesta                |
| CacheModule y CacheInterceptor                    | `cache`, `cache/reset`       | una computación por entrada y limpieza                  |
| CQRS, eventos y saga                              | `activity`, `saga`           | efectos de comandos y consultas                         |
| AsyncLocalStorage y middleware                    | `context`                    | identidad conservada bajo concurrencia                  |
| Upload y streaming                                | `upload`, `download`         | hash de bytes, falta de archivo y descarga              |
| SSE                                               | `events`                     | secuencia finita, cierre de conexión                    |
| Cookies, sesiones y CSRF                          | `cookies`, `session`, `csrf` | persistencia y rechazo sin token                        |
| RawBody y versionado                              | `raw-body`, `version`        | bytes originales, v1 y v2                               |
| MVC y assets estáticos                            | `view`, `/static/demo.txt`   | Handlebars y ServeStaticModule                          |
| HTTP module                                       | `http`                       | upstream HTTP real configurado por entorno              |
| Terminus                                          | `/api/v1/health`             | memoria e indicador con timeout                         |
| Rate limit                                        | `/api/v1/rate-limit`         | dos peticiones permitidas; tercera 429                  |
| Scheduling                                        | ActivityLog                  | intervalo registrado; el cierre de Nest libera el timer |
| BullMQ                                            | QueueLabModule               | trabajo, reintento, progreso y flow padre/hijo en Redis |

```sh
pnpm exec vitest run --config vitest.config.e2e.ts test/techniques.e2e-spec.ts
docker compose --profile queues up -d --wait
RUN_QUEUE_INTEGRATION=1 pnpm exec vitest run --config vitest.config.integration.ts test/integration/queues.integration-spec.ts
```

Las sesiones utilizan MemoryStore para esta demo local. La credencial de sesión
se genera por proceso salvo `SESSION_SECRET`; producción exige una clave explícita.
Un despliegue real debe configurar almacenamiento persistente. Helmet aplica CSP
salvo en `/docs`, donde Swagger UI necesita scripts inline. CSRF protege el flujo
de sesión de ejemplo; los endpoints JWT no utilizan cookies de autenticación.
`DEMO_UPSTREAM_URL` se configura en el servidor, no se acepta una URL arbitraria
en la petición HTTP.

La versión instalada de `@nestjs/throttler` aún declara peers hasta Nest 11.
El caso 200/200/429 verifica su funcionamiento en este corpus con Nest 12; no
convierte ese resultado en soporte oficial de todas sus opciones.

`ServeStaticModule` elige el loader al construir proveedores. Un TestingModule
compilado antes de disponer de HttpAdapterHost elige NoopLoader. Las pruebas de
la aplicación completa usan NestFactory real; los módulos aislados siguen
utilizando las utilidades de `@nestjs/testing`.

Fuentes: [técnicas](https://docs.nestjs.com/techniques/configuration),
[Standard Schema](https://docs.nestjs.com/techniques/validation),
[colas](https://docs.nestjs.com/techniques/queues),
[CSRF](https://docs.nestjs.com/security/csrf),
[CQRS](https://docs.nestjs.com/recipes/cqrs),
[AsyncLocalStorage](https://docs.nestjs.com/recipes/async-local-storage).
