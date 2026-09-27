# Ciclo HTTP, Router, versiones y tareas programadas

`src/http-lab/http-lab.ts` es un laboratorio independiente: los providers globales
de trazado solo se aplican a esa aplicación. Su prueba comprueba el orden real
middleware → guards → interceptors → pipes → handler y el retorno inverso de
interceptors. Un error termina en el filter y evita los interceptors de éxito.

También comprueba RouterModule con rutas hijas, compresión gzip negociada,
preflight CORS, versionado por header/media-type/extractor y el diagnóstico real
de una dependencia de DI ausente. El versionado URI está en la aplicación principal.

Cron, Interval y Timeout disparan callbacks reales durante la prueba. Tras cerrar
Nest, sus contadores permanecen estables, verificando la liberación de timers.

```sh
pnpm exec vitest run --config vitest.config.e2e.ts test/http-lab.e2e-spec.ts
```

Referencias: [ciclo de petición](https://docs.nestjs.com/faq/request-lifecycle),
[RouterModule](https://docs.nestjs.com/recipes/router-module),
[versioning](https://docs.nestjs.com/techniques/versioning),
[scheduling](https://docs.nestjs.com/techniques/task-scheduling),
[errores comunes](https://docs.nestjs.com/faq/common-errors).
