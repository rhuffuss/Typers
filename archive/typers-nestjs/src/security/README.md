# Autenticación y autorización de demostración

Passport JWT valida el bearer token, su algoritmo, caducidad, emisor y audiencia. `JwtModule.registerAsync` comparte configuración inyectable con `JwtStrategy`. `RolesGuard` consulta metadatos con `Reflector` y lee los roles actuales del proveedor de usuarios. `@Auth(...)` compone guards, metadatos y documentación; `@CurrentUser()` extrae el usuario del contexto HTTP.

## Cuentas SOLO PARA DEMO

| Rol                     | Email predeterminado  | Contraseña predeterminada |
| ----------------------- | --------------------- | ------------------------- |
| Administrador y miembro | `admin@typers.local`  | `TypersDemo-Admin-2026!`  |
| Lector                  | `reader@typers.local` | `TypersDemo-Reader-2026!` |

Se pueden cambiar con `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD`, `DEMO_READER_EMAIL` y `DEMO_READER_PASSWORD`. Las contraseñas se derivan mediante `node:crypto` scrypt asíncrono con sal aleatoria; únicamente los hashes permanecen en el proveedor. `@Exclude()` y `ClassSerializerInterceptor` eliminan el hash de las respuestas de login, perfil y listado.

`JWT_SECRET` debe tener al menos 32 caracteres. Sin esta variable, cada instancia local genera un secreto aleatorio y los tokens dejan de ser válidos al reiniciar. En producción se exige un secreto explícito y ambas contraseñas de demo explícitas. Los tokens duran 900 segundos. Este laboratorio no implementa registro, recuperación de contraseña, revocación ni refresh tokens.

## Identidades para los flujos de negocio

En desarrollo/test también se crean `member@typers.local`, `approver@typers.local` y `finance@typers.local`, con contraseñas `TypersDemo-Member-2026!`, `TypersDemo-Approver-2026!` y `TypersDemo-Finance-2026!`. Separan solicitud, revisión y pago simulado; no pueden autoaprobarse. En producción solo se habilita cada una cuando se configura su `DEMO_MEMBER_PASSWORD`, `DEMO_APPROVER_PASSWORD` o `DEMO_FINANCE_PASSWORD`; también admiten `DEMO_<ROLE>_EMAIL`. [Ejemplo completo](../../docs/business.md).

## Endpoints

Las rutas siguientes son relativas al prefijo HTTP de la aplicación.

| Método | Ruta          | Autorización                 | Resultado                                                  |
| ------ | ------------- | ---------------------------- | ---------------------------------------------------------- |
| POST   | `/auth/login` | Pública                      | 200 con `access_token`, `expires_in`, `token_type`, `user` |
| GET    | `/auth/me`    | Cualquier cuenta autenticada | 200 con usuario serializado                                |
| GET    | `/auth/users` | Administrador                | 200 con usuarios serializados                              |

El body de login es `{ "email": "admin@typers.local", "password": "TypersDemo-Admin-2026!" }`. En las siguientes peticiones: `Authorization: Bearer <access_token>`. Credenciales incorrectas o token ausente/inválido/caducado producen 401; un rol insuficiente produce 403; el DTO inválido produce 400.

## Verificación

```sh
pnpm exec vitest run src/security/security.spec.ts
pnpm exec vitest run --config vitest.config.e2e.ts test/workspaces.e2e-spec.ts
```

Las pruebas cubren hashes con sal diferente, comparación de contraseña, restricciones del secreto, login real, serialización, guards de Passport, roles y errores HTTP. Todos los contextos de aplicación se cierran después de las pruebas.

## Referencias oficiales

- [Authentication](https://docs.nestjs.com/security/authentication)
- [Passport](https://docs.nestjs.com/recipes/passport)
- [Authorization](https://docs.nestjs.com/security/authorization)
- [Encryption and hashing](https://docs.nestjs.com/security/encryption-and-hashing)
- [Serialization](https://docs.nestjs.com/techniques/serialization)
- [Custom decorators](https://docs.nestjs.com/custom-decorators)
