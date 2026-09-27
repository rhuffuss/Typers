# Proyectos y tareas: contratos REST

`WorkspacesModule` expone controladores, DTOs y un servicio de aplicación. `WORKSPACES_REPOSITORY` es el token de un proveedor sustituible que almacena agregados de proyecto y tareas. La implementación de memoria crea un proyecto inicial, clona los valores para evitar mutaciones fuera del repositorio y pierde sus datos al reiniciar.

El dominio permite comparar decoradores HTTP, DTOs de entrada y salida, validación, transformaciones, enums, arrays, parámetros, paginación y mapped types de Swagger. `UpdateProjectDto` y `UpdateTaskDto` usan `PartialType` conservando las reglas; `null` no permite eludir la validación de campos opcionales.

## Endpoints

Rutas relativas al prefijo HTTP global de la aplicación. Todas las lecturas son públicas; las escrituras requieren bearer token. Las credenciales están en [Security](../security/README.md).

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/projects?page=1&limit=20&status=active&search=typers` | Página con `items`, `total`, `page`, `limit`, `pages` |
| GET | `/projects/:projectId` | Proyecto y sus tareas |
| POST | `/projects` | Crear proyecto: administrador o miembro |
| PATCH | `/projects/:projectId` | Actualizar parcialmente: administrador o miembro |
| DELETE | `/projects/:projectId` | Eliminar proyecto y tareas: administrador |
| GET | `/projects/:projectId/tasks` | Listar tareas |
| GET | `/projects/:projectId/tasks/:taskId` | Obtener tarea |
| POST | `/projects/:projectId/tasks` | Crear tarea: administrador o miembro |
| PATCH | `/projects/:projectId/tasks/:taskId` | Actualizar tarea: administrador o miembro |
| DELETE | `/projects/:projectId/tasks/:taskId` | Eliminar tarea: administrador o miembro |

Proyecto de ejemplo: `{ "name": "API laboratory", "slug": "api-laboratory", "labels": ["typers"] }`. Tarea: `{ "title": "Explore return types", "status": "todo" }`. Estados de proyecto: `active`, `archived`; de tarea: `todo`, `in_progress`, `done`. El propietario se obtiene del usuario autenticado y no se acepta desde el body.

Creación devuelve 201; lectura/actualización 200; eliminación 204 sin body; parámetros/DTOs inválidos 400; autenticación 401; rol insuficiente 403; recurso inexistente 404; slug repetido 409. UUIDs se validan con `ParseUUIDPipe`; query numérica con `@Type(() => Number)` y `ValidationPipe({ transform: true })`.

## Pruebas

```sh
pnpm exec vitest run --config vitest.config.e2e.ts test/workspaces.e2e-spec.ts
```

El test configura validación y serialización, sustituye explícitamente el repositorio con `overrideProvider`, hace login HTTP, ejecuta CRUD completo y comprueba errores, permisos, mapped DTOs, transformación, filtros, fechas JSON y ausencia de hashes. La aplicación de test se cierra en `afterAll`.

## PostgreSQL y TypeORM

La persistencia principal utiliza PostgreSQL, `TypeOrmModule.forRootAsync`, `TypeOrmModule.forFeature`, `@InjectRepository`, un `DataSource` inyectado y entidades con relación uno a muchos. El mismo contrato dispone de memoria para ejecutar pruebas rápidas sin infraestructura.

Activa `DEMO_DATABASE=postgres` y configura `DATABASE_URL` antes de importar el módulo. `WorkspacesPersistenceModule.register({ driver, url?, schema? })` permite elegir la implementación explícitamente. `DATABASE_SCHEMA` es opcional y vale `public`; para otro esquema, debe existir previamente.

```sh
docker compose --profile postgres up -d --wait
export DATABASE_URL='postgresql://typers:typers-demo-local@127.0.0.1:55432/typers'
pnpm build
node node_modules/typeorm/cli.js migration:run -d dist/workspaces/persistence/data-source.js
DEMO_DATABASE=postgres pnpm start:prod
```

Las credenciales y puerto del ejemplo corresponden exclusivamente al contenedor local de `compose.yaml`. La base PostgreSQL empieza vacía: crea proyectos por HTTP tras hacer login. Las migraciones son explícitas, con `synchronize: false` y `migrationsRun: false` en todos los entornos. Se puede revertir la última migración con `migration:revert` usando el mismo `-d`; la migración inicial elimina las tablas del laboratorio al revertirse.

Guardar un proyecto y sus tareas es una transacción única: si falla una tarea, se revierten también los cambios del proyecto. El índice único de slug se traduce a 409. La clave foránea elimina las tareas cuando se elimina su proyecto. Este repositorio conserva el agregado completo; las escrituras simultáneas sobre el mismo proyecto no incorporan aún control de versión optimista.

```sh
TEST_DATABASE_URL='postgresql://typers:typers-demo-local@127.0.0.1:55432/typers' \
  pnpm exec vitest run --config vitest.config.integration.ts test/integration/workspaces.integration-spec.ts
```

La prueba real crea un esquema temporal propio, ejecuta migraciones, verifica CRUD HTTP, relaciones, unicidad, rollback del agregado, rollback explícito de `QueryRunner` y reversión/reaplicación de la migración. Al terminar cierra las conexiones y elimina únicamente ese esquema temporal. Sin `TEST_DATABASE_URL`, la suite se omite.

## Referencias oficiales

- [Controllers](https://docs.nestjs.com/controllers)
- [Custom providers](https://docs.nestjs.com/fundamentals/custom-providers)
- [Validation](https://docs.nestjs.com/techniques/validation)
- [OpenAPI types and parameters](https://docs.nestjs.com/openapi/types-and-parameters)
- [OpenAPI mapped types](https://docs.nestjs.com/openapi/mapped-types)
- [Testing](https://docs.nestjs.com/fundamentals/testing)
- [Database / TypeORM](https://docs.nestjs.com/techniques/database)
- [TypeORM migrations](https://typeorm.io/docs/advanced-topics/migrations/)
- [TypeORM transactions](https://typeorm.io/docs/advanced-topics/transactions/)
