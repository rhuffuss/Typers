# Arquitectura y decisiones

## Objetivo

Aplicación de referencia NestJS suficientemente amplia para detectar regresiones
al desarrollar Typers. La documentación de Typers consultada está en el repositorio
hermano `../typers/docs/typers`, especialmente índice, estado, compatibilidad,
validación, API nativa y ADR 0006 del adaptador de build.

Typers es un fork nativo de TypeScript 7.0.2. Tiene runtime experimental Result y
Option, `if let Some`, API nativa y adaptador `typers-nest build`. El comando
original `nest build`, los plugins del compilador y los parsers externos tienen
contratos diferentes y requieren pruebas independientes. La aplicación principal
de este repositorio utiliza TypeScript estándar como referencia de comportamiento.

## Decisiones del usuario (2026-09-15)

- Cobertura máxima por capítulo de la documentación oficial de NestJS.
- Express como aplicación principal y laboratorios ejecutables para alternativas.
- PostgreSQL con TypeORM como persistencia principal.
- Docker Compose con perfiles para activar solo los servicios necesarios.
- Generación con Nest CLI, pnpm, ES Modules y Vitest.
- Lógica de negocio sustancial y variedad de estilos TypeScript aplicada a reglas reales, con pruebas de tipos y ejecución.
- Uso permanente de esta demo para desarrollar, validar y demostrar cada avance
  de Typers. La referencia oficial se conserva. Tras pedir el usuario una app
  real que pueda abrir y modificar, `apps/typers` pasa a ser el punto principal
  para ver las funciones propias aplicadas a NestJS; `fixtures/typers` conserva
  los casos aislados de regresión y API. La [guía](typers-features.md) enlaza
  código, comandos y evidencia. Esto complementa las pruebas del compilador nativo.

## Organización

### Aplicación Typers: catálogo, presupuestos y reservas

[`apps/typers`](../apps/typers/README.md) contiene una aplicación con sus propios
`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, dependencias, configuración
Nest y salida `dist`. Su paquete no declara TypeScript oficial como compilador:
depende de los tarballs locales explícitos `@typers/compiler`, `@typers/core` y
`@typers/nest`. La instalación se realiza dentro de esa app, conservando el lock
y el compilador de la referencia raíz.

El flujo HTTP llega al controlador, el servicio valida datos externos y devuelve
`Result<valor, DomainError>`. Los repositorios devuelven `Option` en las consultas.
La sintaxis `if let Some` extrae el producto, el cupón, la nota o una reserva
existente. Solo la capa HTTP traduce los errores tipados a sus estados. El dominio
calcula importes con BigInt, evita descontar stock al presupuestar y reconoce
repeticiones de reserva mediante una clave idempotente. Todo vive en memoria.

Los scripts raíz `start:typers`, `build:typers`, `typecheck:typers` y `test:typers`
usan [`scripts/typers-app.mjs`](../scripts/typers-app.mjs): comprueban los tarballs,
preparan las dependencias fijadas y llaman al compilador nativo o al adaptador.
`typers:refresh` permite actualizar la instalación y el lock propios después de
reconstruir artefactos. Los tests ejecutan la salida con Node; no pasan las
fuentes experimentales por Vitest. El adaptador copia `src/assets/policy.json`
y el endpoint `/api/policy` lo lee desde `dist`.

La app se sirve en loopback, puerto 3014, con Swagger en `/docs`. El build usa
imports relativos `.js`, NodeNext y metadatos de decoradores Nest, sin aliases
ni plugins del compilador. WebStorm puede ejecutar el script con pnpm, pero su
parser no adquiere soporte de `if let`. El desarrollo requiere reconstruir y
reiniciar tras cada cambio; no se declara soporte de watch.

### Referencia TypeScript estándar

El dominio de ejemplo contiene usuarios, proyectos y tareas. Los fundamentos de
inyección y ciclo de vida tienen un laboratorio independiente para poder probar
patrones poco recomendables en el dominio, como dependencias circulares.
Los ejemplos de GraphQL, WebSockets y microservicios ejercitan sus propias
fronteras, errores y cierre de recursos. Los ejemplos en memoria permiten probar
el compilador sin requerir infraestructura; las integraciones de persistencia y
mensajería se verifican con servicios reales.

Los capítulos informativos (cursos, comunidad, soporte) son referencias. Observe,
Devtools y despliegue conservan sus requisitos de cuenta/configuración. Una
integración local no acredita el funcionamiento de un servicio externo.

## Procedencia del scaffold

Generado el 2026-09-15 con `@nestjs/cli@12.0.1`, Node 24.20.0 y pnpm 12.4.1:

```sh
pnpm dlx @nestjs/cli@12.0.1 new typers-nestjs \
  --package-manager pnpm --strict --skip-git --skip-install --no-observe
```

La generación se realizó en una carpeta temporal y sus archivos se trasladaron
al repositorio existente, conservando `.git` y los ajustes locales del IDE.
Nest v12 genera `type: module`, resolución NodeNext, Vitest y Oxlint.
La integración SaaS Observe se configura como opt-in independiente.

Fuentes: [CLI](https://docs.nestjs.com/cli/usages),
[migración v12](https://docs.nestjs.com/migration-guide),
[testing](https://docs.nestjs.com/fundamentals/testing).

## Dominio de negocio

El módulo `business` coordina tres estilos: funciones puras en pricing, algoritmos/generadores en planning y agregados OOP en approvals. Los proyectos mantienen PostgreSQL/TypeORM; los cálculos son simulaciones sin efectos y los gastos usan memoria de una instancia con auditoría, versión e idempotencia. [Flujos](business.md) y [construcciones TypeScript](typescript-patterns.md) describen los contratos y sus límites.
