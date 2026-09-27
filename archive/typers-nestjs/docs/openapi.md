# OpenAPI: documentos selectivos y plugin

El laboratorio `src/openapi-lab/multiple-documents.ts` crea una aplicación Nest
independiente con dos documentos: catálogo y miembros. `include` selecciona sus
módulos; `deepScanRoutes: true` incorpora las rutas del submódulo de revisiones
del catálogo. La prueba compara ese resultado con `deepScanRoutes: false` y
comprueba que las rutas y modelos del otro documento no aparecen.

`PageDto<T>` representa la respuesta paginada. Como `T` no existe en los metadatos
de JavaScript, el esquema compone `PageDto` y el array concreto mediante `allOf`,
`extraModels`, `@ApiExtraModels()` y `getSchemaPath()`. El endpoint destacado
incluye un link por `operationId` y otro mediante `operationRef` relativo al JSON;
ambos utilizan el identificador del cuerpo de respuesta.

## Ejecutar y verificar

```sh
pnpm exec vitest run --config vitest.config.e2e.ts test/openapi-documents.e2e-spec.ts
```

Las pruebas usan `NestFactory`, un puerto HTTP aleatorio en `127.0.0.1`, peticiones
reales y `app.close()`. Comprueban selección de rutas/modelos, escaneo de imports,
respuesta paginada, links resolubles, lectura individual y 404, HTML y recursos
Swagger, y configuración del selector de documentos. No utilizan base de datos
ni servicios externos. No automatizan interacciones dentro del navegador.

Para explorar manualmente, tras `pnpm build`:

```sh
node --input-type=module -e 'const {createMultipleDocumentsLab} = await import("./dist/openapi-lab/multiple-documents.js"); const {app} = await createMultipleDocumentsLab(); app.enableShutdownHooks(); await app.listen(3030, "127.0.0.1");'
```

| Recurso                     | Ruta                                                                   |
| --------------------------- | ---------------------------------------------------------------------- |
| Selector Swagger            | `http://127.0.0.1:3030/docs`                                           |
| Swagger catálogo / miembros | `/docs/catalog`, `/docs/members`                                       |
| Documentos JSON             | `/specs/catalog.json`, `/specs/members.json`                           |
| Respuestas del catálogo     | `/api/catalog`, `/api/catalog/featured`, `/api/catalog/nest-reference` |
| Submódulo importado         | `/api/revisions`                                                       |
| Miembros                    | `/api/members`                                                         |

Ctrl+C cierra el proceso. La separación de documentos es una selección de
documentación: las rutas HTTP de ambos módulos siguen disponibles en esta misma
aplicación. Los links son metadatos OpenAPI; el servidor no los ejecuta por sí solo.

## Plugin CLI y aplicación principal

`src/openapi-lab/main.ts` y `catalog.dto.ts` ejercitan el plugin real del CLI:
metadatos inferidos, propiedades ocultas, restricciones, mapped types y API key.

```sh
pnpm exec vitest run --config vitest.config.e2e.ts test/openapi-plugin.e2e-spec.ts
pnpm build:swagger
node dist-swagger/openapi-lab/main.js
```

La aplicación principal conserva su documento en `/openapi.json` y Swagger en
`/docs`, con DTOs REST, JWT y respuestas. El laboratorio selectivo no modifica ese
arranque ni configura autorización adicional.

Fuentes oficiales consultadas:
[múltiples especificaciones y selector](https://docs.nestjs.com/openapi/other-features),
[opciones de documentos](https://docs.nestjs.com/openapi/introduction#document-options),
[modelos adicionales y composición](https://docs.nestjs.com/openapi/types-and-parameters#extra-models),
[links OpenAPI](https://spec.openapis.org/oas/v3.0.3.html#link-object).
