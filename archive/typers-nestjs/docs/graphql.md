# Laboratorio GraphQL

## Uso

`GraphqlLabModule` es el módulo principal para Express + Apollo, con esquema
code first en `/graphql`. Su dominio independiente contiene autores y artículos.
Los datos y el pub-sub viven en memoria y se reinician al arrancar la aplicación.

```graphql
query {
  authors {
    id
    name
    articles {
      title
      slug
      state
      createdAt
    }
  }
  authorsPage {
    total
    items {
      name
    }
  }
}
```

Las mutaciones de este laboratorio requieren la cabecera de demostración
`x-editorial-role: editor`. Este selector permite ejercitar el guard y los permisos
de campo; no identifica a un usuario real ni sustituye al módulo de autenticación.

```graphql
mutation {
  createArticle(input: { title: "Nuevo artículo", authorId: "a1" }) {
    id
    title
    state
  }
}
```

`title` pasa por la directiva `@upper`. El escalar `Slug` valida variables y
literales. `Author.editorialNote` utiliza `@Extensions` y field middleware para
exigir el rol `editor`. El plugin rechaza operaciones con complejidad superior a
100; la estimación de `articles` incorpora el límite solicitado.

```graphql
subscription {
  articleAdded(authorId: "a1") {
    title
    authorId
  }
}
```

Las suscripciones usan el protocolo `graphql-ws` actual. El filtro selecciona
por autor, el resolver extrae el payload y el test utiliza una conexión WebSocket
real. El PubSub local es deliberadamente una implementación de laboratorio.

## Comandos reproducibles

```sh
# Todos los escenarios de este documento
pnpm exec vitest run --config vitest.config.e2e.ts \
  test/graphql.e2e-spec.ts test/graphql-schema.e2e-spec.ts

# Compilador/plugin oficial de Nest, independiente del build principal
pnpm exec nest build --config nest-cli.graphql.json
node dist-graphql-plugin/main.js

# Después del build principal
pnpm build
node dist/src/graphql-lab/generate-schema.js
node dist/src/graphql-lab/main.schema-first.js
node dist/src/graphql-lab/main.federation.js
```

El laboratorio schema first usa Mercurius + Fastify y escucha en `127.0.0.1:3100`
(`GRAPHQL_SCHEMA_PORT` permite cambiarlo). Su SDL está en `schema-first.ts` y
ofrece `schemaAuthor` y `createSchemaArticle`.

La federación levanta dos subgraphs Nest y un gateway Apollo en puertos libres,
imprime sus direcciones y cierra los tres servidores con SIGINT/SIGTERM.
`federatedAuthors { name articles { title author { name } } }` atraviesa la
frontera entre ambos subgraphs. `federatedArticle(id:"f1") { author { name } }`
ejercita `@ResolveReference` en el sentido contrario.

`generateEditorialSchema()` usa `GraphQLSchemaBuilderModule` y
`GraphQLSchemaFactory` sin escuchar en HTTP. `generateEditorialDefinitions()`
invoca `GraphQLDefinitionsFactory` para producir interfaces TypeScript desde SDL;
la prueba escribe y elimina sus archivos temporales.

## Evidencia por capítulo

Cada fila describe los casos presentes. No representa una afirmación de que
se hayan cubierto todas las opciones, sobrecargas y variantes del capítulo.

| Capítulo oficial                                                     | Caso ejecutado                                                                                     | Evidencia                                                                       |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [Quick start](https://docs.nestjs.com/graphql/quick-start)           | Apollo code first y Mercurius schema first                                                         | Ambos archivos e2e arrancan aplicaciones reales                                 |
| [Resolvers](https://docs.nestjs.com/graphql/resolvers)               | Query, ResolveField, Args/ArgsType, Parent, Context, Info, herencia y tipo paginado genérico       | Queries anidadas, paginación y generación de interfaces                         |
| [Mutations](https://docs.nestjs.com/graphql/mutations)               | InputType, creación y actualización parcial; mutación schema first                                 | Guard, validación de título y estado conservado al omitirlo                     |
| [Subscriptions](https://docs.nestjs.com/graphql/subscriptions)       | graphql-ws, filtro y resolve con PubSub                                                            | Socket real, evento excluido/incluido y listener eliminado al cerrar            |
| [Scalars](https://docs.nestjs.com/graphql/scalars)                   | Slug custom y DateTime nativo                                                                      | Parse de variable/literal, error y serialización                                |
| [Directives](https://docs.nestjs.com/graphql/directives)             | @upper y transformSchema en ambos enfoques                                                         | Respuestas en mayúsculas                                                        |
| [Interfaces](https://docs.nestjs.com/graphql/interfaces)             | EditorialNode y resolveType                                                                        | Consulta de fragmento Article                                                   |
| [Unions and Enums](https://docs.nestjs.com/graphql/unions-and-enums) | EditorialSearchResult y ArticleState                                                               | Tipos concretos y valores DRAFT/PUBLISHED                                       |
| [Field middleware](https://docs.nestjs.com/graphql/field-middleware) | Trim de nombre y permiso por campo                                                                 | Nombre transformado y error de acceso                                           |
| [Mapped types](https://docs.nestjs.com/graphql/mapped-types)         | PickType, OmitType, PartialType e IntersectionType                                                 | SDL y mutaciones que conservan campos omitidos                                  |
| [Plugins](https://docs.nestjs.com/graphql/plugins)                   | @Plugin, didResolveOperation, willSendResponse                                                     | Registro de operaciones y respuestas completadas                                |
| [Complexity](https://docs.nestjs.com/graphql/complexity)             | Estimadores simple/extensiones y coste dependiente de limit                                        | Operación válida y rechazo QUERY_TOO_COMPLEX                                    |
| [Extensions](https://docs.nestjs.com/graphql/extensions)             | Metadata role consultada por middleware                                                            | Acceso autorizado/rechazado a editorialNote                                     |
| [CLI Plugin](https://docs.nestjs.com/graphql/cli-plugin)             | Transformador oficial @nestjs/graphql                                                              | Build CLI real, _GRAPHQL_METADATA_FACTORY y SDL inferido                        |
| [Generating SDL](https://docs.nestjs.com/graphql/generating-sdl)     | GraphQLSchemaFactory en application context                                                        | SDL con interfaces, input y suscripción                                         |
| [Sharing models](https://docs.nestjs.com/graphql/sharing-models)     | Author con @Field y @ApiProperty                                                                   | Mismo modelo en GraphQL y components.schemas.Author de OpenAPI                  |
| [Other features](https://docs.nestjs.com/graphql/other-features)     | Guard, ValidationPipe, interceptor, filter, Gql*Context, decorador propio y fieldResolverEnhancers | Rechazos, filtro EDITORIAL_NOT_FOUND y orden before/after de resolvers de campo |
| [Federation](https://docs.nestjs.com/graphql/federation)             | Dos subgraphs Apollo schema first, @ResolveReference y gateway                                     | Consulta real entre tres servidores HTTP                                        |

## Contrato para probar Typers

`plugin-fixture/plugin-author.model.ts` omite deliberadamente `@Field` en
`displayName`, `biography` y `tags`. El CLI oficial debe inyectar metadata que
conserve tipo, opcionalidad, arrays y comentario, y debe excluir `@HideField`.
La prueba inspecciona el JavaScript emitido y después ejecuta ese JavaScript
con Node. No reemplaza el compilador o el plugin si dejan de funcionar.

El build del plugin usa `nest-cli.graphql.json` y `tsconfig.graphql.json` y escribe
solo en `dist-graphql-plugin`. El build principal sigue siendo independiente.

Los tests Vitest fijan la resolución de `graphql` a su entrada `index.js` para
que el código transformado por Vite y las dependencias externas Nest compartan
la misma identidad de clases. La aplicación conserva imports ESM normales desde
`graphql`. Esta configuración evita mezclar las entradas `index.mjs` e `index.js`
del mismo paquete durante los tests.

## Alcance pendiente

Quedan variantes adicionales del corpus oficial, entre ellas federación Mercurius,
federación code first, suscripciones Mercurius, autenticación de la conexión
WebSocket, custom GraphQL driver, múltiples endpoints y configuraciones async
alternativas. La matriz general debe conservar estas variantes pendientes; los
casos verificados de la tabla no las sustituyen. No se han ejercitado servicios
remotos ni gateways comerciales.
