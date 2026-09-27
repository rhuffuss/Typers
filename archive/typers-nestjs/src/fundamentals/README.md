# Laboratorio Fundamentals

`FundamentalsModule` reúne ejemplos ejecutables de NestJS 12. Todas las fuentes
son TypeScript estándar ESM, con imports relativos `.js`. Los constructores
inyectan clases mediante metadata; los contratos de interfaz usan tokens
explícitos. La prueba de metadata detecta transformadores que omiten
`emitDecoratorMetadata`.

## Endpoints

Rutas relativas al prefijo global que configure la aplicación. Las respuestas
correctas incluyen `{ data, context }`; el interceptor obtiene el transporte,
controlador, método y política desde el `ExecutionContext` real.

| GET                       | Ejercicio                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| `/fundamentals`           | Providers personalizados, configuración asíncrona, ciclo aislado y hooks de arranque.    |
| `/fundamentals/scopes`    | Identidades de singleton, request, transient y contextos manuales.                       |
| `/fundamentals/lazy`      | Import dinámico, carga de módulo y reutilización del provider.                           |
| `/fundamentals/discovery` | Descubrimiento de providers decorados y controladores.                                   |
| `/fundamentals/context`   | Metadata del método sobrescribe la del controlador; exige `x-demo-access: acknowledged`. |

La cabecera de demostración no autentica usuarios ni contiene secretos. Solo
permite observar el guard y la precedencia de metadata. La aplicación deberá
usar su módulo de seguridad para autenticación real.

## Cobertura y documentación oficial

| Documentación                                                                     | Implementación y comportamiento comprobado                                                                                                                                                                                   |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Custom providers](https://docs.nestjs.com/fundamentals/custom-providers)         | `useValue` para el nombre, `useClass` para el saludo, `useExisting` como alias de la misma instancia, `useFactory` con dependencias.                                                                                         |
| [Asynchronous providers](https://docs.nestjs.com/fundamentals/async-providers)    | Nest espera una promesa antes de inyectar el catálogo; su factory usa nombre y configuración resueltos por DI. La promesa usa datos locales deterministas.                                                                   |
| [Dynamic modules](https://docs.nestjs.com/fundamentals/dynamic-modules)           | `ConfigurableModuleBuilder`, `setClassMethodName('forRoot')`, `forRootAsync` y servicio que consume el token generado. No se ejercitan todas las variantes de registro.                                                      |
| [Injection scopes](https://docs.nestjs.com/fundamentals/injection-scopes)         | Singleton compartido entre requests; request scope propagado a un controlador específico; transient distinto para cada consumidor singleton.                                                                                 |
| [Module reference](https://docs.nestjs.com/fundamentals/module-ref)               | `get`, `resolve`, `create`, `registerRequestByContextId`; `ContextIdFactory.create` y `getByRequest`. El mismo contexto reutiliza instancias; contextos distintos las aíslan.                                                |
| [Circular dependency](https://docs.nestjs.com/fundamentals/circular-dependency)   | Dos providers singleton con `forwardRef`, tokens e interfaces. Se verifica identidad en ambas direcciones. El ciclo vive solo en `CircularDemoModule`; no se usa para diseñar el dominio. No demuestra ciclos entre módulos. |
| [Lazy-loading modules](https://docs.nestjs.com/fundamentals/lazy-loading-modules) | `import()` y `LazyModuleLoader.load`, caché del módulo y `ModuleRef.get` estricto. Se comprueba que Nest no invoca `onModuleInit` en el provider lazy, tal como documenta esta API.                                          |
| [Execution context](https://docs.nestjs.com/fundamentals/execution-context)       | Decorador tipado de `Reflector`, `getAllAndOverride`, `getClass`, `getHandler`, `getType` y `switchToHttp`; guard real con 403 e interceptor RxJS. Limitado a HTTP.                                                          |
| [Lifecycle events](https://docs.nestjs.com/fundamentals/lifecycle-events)         | Los cinco hooks de arranque/cierre, ejecutados mediante `app.init()` y `app.close()`. No envía señales del sistema ni simula un shutdown con mocks.                                                                          |
| [Discovery service](https://docs.nestjs.com/fundamentals/discovery-service)       | `DiscoveryModule`, `getProviders`, `getControllers`, `createDecorator` y `getMetadataByDecorator`. Solo publica los elementos de este laboratorio.                                                                           |
| [Testing](https://docs.nestjs.com/fundamentals/testing)                           | `Test.createTestingModule`, `overrideProvider`, aplicación HTTP real en puerto efímero y cierre de todas las aplicaciones de prueba.                                                                                         |

Los proveedores con ciclos no leen a su contraparte durante el constructor.
Los tipos de interfaz evitan accesos prematuros a clases durante la evaluación
de metadata ESM. Los `forwardRef` resuelven el ciclo de DI del framework.

## Pruebas

```sh
pnpm exec vitest run --config vitest.config.e2e.ts test/fundamentals.e2e-spec.ts
```

El test importa este módulo aisladamente, por lo que no requiere bases de datos,
brokers ni servicios externos. Sus nueve casos comprueban salida HTTP, metadata,
identidad de providers, overrides, carga diferida y cierre real. Esto valida el
camino de transformación configurado en Vitest. Para evaluar Typers hay que
compilar también con el compilador seleccionado y ejecutar sus artefactos JS;
el éxito de Vitest por sí solo no prueba compatibilidad del compilador Typers.
