# Laboratorios de persistencia alternativa

La persistencia principal continúa en el módulo TypeORM. Estos laboratorios
independientes ejercitan cuatro integraciones reales desde contenedores Nest:
Mongoose/MongoDB, Sequelize/PostgreSQL, MikroORM/PostgreSQL y Prisma/PostgreSQL.
Cada módulo expone `register(options)` y sus servicios mediante DI; no se importa
en el arranque normal ni conecta una base de datos al ejecutar tests unitarios.

## Ejecución

```sh
pnpm exec prisma generate --config src/persistence-labs/prisma/prisma.config.ts
```

Los servicios se levantan con Docker Compose:

```sh
docker compose --profile databases up -d --wait

TEST_DATABASE_URL='postgresql://typers:typers-demo-local@127.0.0.1:55432/typers' \
TEST_MONGO_URL='mongodb://127.0.0.1:57017' \
pnpm exec vitest run --config vitest.config.integration.ts \
  test/integration/persistence-labs.integration-spec.ts
```

Las variables son explícitas: si falta una, sus casos se omiten. Un caso omitido
no verifica esa integración. La ejecución registrada durante la implementación
utilizó ambos servicios reales y superó los cuatro casos sin omisiones.

## Casos verificables

| Integración | Superficie Nest/ORM                                                                                                                                                 | Verificación real                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mongoose    | MongooseModule.forRoot con conexión nombrada, forFeatureAsync, InjectModel/InjectConnection, Schema/Prop/SchemaFactory, subdocumento, hook pre-save y discriminator | Crear y recuperar documento, hook y timestamps, índice único, validación, discriminator, actualización, eliminación y conexión cerrada                 |
| Sequelize   | SequelizeModule.forRoot/forFeature, conexión nombrada, InjectModel/InjectConnection, Table/Column/PrimaryKey, HasMany/BelongsTo/ForeignKey                          | Asociación escritor/notas, transacción confirmada, rollback de dos escrituras, actualización y cierre del contexto                                     |
| MikroORM 7  | MikroOrmModule.forRoot/forFeature, InjectRepository, decoradores legacy, ReflectMetadataProvider, Collection, EnsureRequestContext y serialize                      | Crear esquema propio, Unit of Work, relación cargada, secreto excluido al serializar, rollback, lecturas concurrentes con contextos separados y cierre |
| Prisma 7    | Servicio inyectable que extiende PrismaClient, OnModuleInit/OnModuleDestroy, PrismaPg y cliente generado ESM                                                        | CLI migrate deploy real, creación anidada, lectura tipada, transacción rollback, eliminación en cascada y lifecycle de conexión                        |

Fuentes: [Mongo](https://docs.nestjs.com/techniques/mongodb),
[Database / Sequelize](https://docs.nestjs.com/techniques/database),
[receta MikroORM](https://docs.nestjs.com/recipes/mikroorm),
[integración Nest actual de MikroORM 7](https://mikro-orm.io/docs/usage-with-nestjs),
[receta Prisma](https://docs.nestjs.com/recipes/prisma) y
[generador Prisma](https://docs.prisma.io/docs/orm/reference/prisma-schema-reference).

## Aislamiento y limpieza

Cada caso crea un namespace aleatorio `typers_lab_<orm>_<uuid>`.
`assertLabNamespace` valida el prefijo y sus caracteres antes del setup.
Las pruebas PostgreSQL crean un schema y lo eliminan al terminar, después de
cerrar el contexto Nest. Mongoose crea una base de datos propia, la elimina y
cierra la conexión. No se ejecuta reset, drop o truncate sobre tablas/esquemas
compartidos ni sobre los del módulo TypeORM.

El perfil Mongo actual es una instancia standalone. No se afirma cobertura de
transacciones Mongo: requieren replica set. Las transacciones y rollbacks reales
se verifican con las tres alternativas PostgreSQL.

## Contratos de compilación

### Prisma

`src/persistence-labs/prisma/schema.prisma` utiliza `prisma-client`,
`moduleFormat = "esm"`, `generatedFileExtension = "ts"` e
`importFileExtension = "js"`. La carpeta `generated/` es un artefacto regenerable
excluido de Git. Los imports de los servicios apuntan al cliente emitido.
La generación no requiere conectar una base de datos; sí debe ejecutarse antes
del typecheck/build/tests tras una instalación limpia.

`prisma.config.ts` usa `PRISMA_DATABASE_URL` para `migrate deploy`. En los tests,
la URL incorpora exclusivamente el schema aleatorio del caso. La migración
versionada crea las tablas propias y su clave externa; el cliente usa ese mismo
schema mediante `PrismaPg`.

La receta Nest contiene ejemplos CommonJS. Se aplica la variante ESM del
cliente porque ese es el formato elegido para este repositorio.

### MikroORM

Se utiliza la API v7: los decoradores y `ReflectMetadataProvider` provienen de
`@mikro-orm/decorators/legacy`; las operaciones de Unit of Work usan
`persist()` y `flush()` y el schema generator utiliza `schema.create()`.
La receta Nest conserva algunos ejemplos de versiones anteriores, por lo que
estos puntos se contrastaron con la documentación actual de MikroORM y sus tipos
instalados. No se cambió el formato de módulos ni el compilador del proyecto.

## Variantes pendientes

Estos escenarios no equivalen a cubrir todas las APIs de los cuatro ORMs.
Quedan, por ejemplo, múltiples conexiones simultáneas, réplica/transacciones
Mongo, otros motores SQL, migraciones Sequelize/MikroORM, repositorios MikroORM
personalizados y todas las opciones de configuración async. La matriz debe
mantener esas variantes pendientes, separadas de los casos verificados aquí.
