# Serverless, HTTPS, múltiples servidores y keep-alive

Estas demos ejercitan los contratos locales de las FAQ de Nest. No despliegan recursos en AWS ni configuran DNS, balanceadores o certificados públicos.

## Pruebas

```sh
pnpm exec vitest run --config vitest.config.e2e.ts test/deployment.e2e-spec.ts
```

Las seis pruebas cubren eventos API Gateway procesados por el adaptador real, reutilización del contexto Nest, validación HTTP, dos servidores con el mismo listener, conexión TCP reutilizada y verificación TLS positiva/negativa. Requieren `openssl` en el `PATH`; generan una CA y un certificado de localhost temporales y los eliminan al finalizar.

## Handler Lambda

`src/deployment-lab/lambda.ts` utiliza `@codegenie/serverless-express` 5, que requiere Node 24 o posterior. Inicializa Nest con `ExpressAdapter`, ejecuta `app.init()` y entrega el listener al adaptador serverless. No abre un puerto TCP. El export `handler` corresponde al entrypoint compilado `deployment-lab/lambda.handler`.

La promesa de inicialización se conserva entre invocaciones; dos llamadas que llegan durante el arranque comparten esa misma promesa. Si el arranque falla, la promesa se descarta para permitir otro intento. Las pruebas verifican una misma identidad de servicio durante invocaciones frías simultáneas y posteriores llamadas calientes. `createLambdaHandler()` permite crear un handler aislado para pruebas; su método `close()` cierra el contexto Nest y permite iniciar otro.

El test construye eventos API Gateway HTTP API **v2** locales: ruta, método, contexto y body. Pasa un body JSON codificado como base64 al adaptador real y verifica que Nest lo decodifica, valida el DTO y devuelve la respuesta correspondiente. También comprueba 400 para un DTO inválido y 404 para una ruta inexistente.

| Método | Ruta                     | Uso                                                                  |
| ------ | ------------------------ | -------------------------------------------------------------------- |
| GET    | `/deployment/status`     | Identidad de la instancia Nest y contador de invocaciones            |
| POST   | `/deployment/echo`       | Body `{ "message": "Hello" }`; respuesta 201 con el mensaje validado |
| GET    | `/deployment/connection` | Datos de la conexión local en las demos HTTP/HTTPS                   |

La ejecución real en AWS, permisos IAM, empaquetado para Lambda, configuración de API Gateway, cuotas y rendimiento de cold start quedan pendientes de un despliegue explícito. La prueba local no mide latencia ni comportamiento de infraestructura AWS.

## Un listener Nest, servidores HTTP y HTTPS

`createMultipleServers()` inicializa una sola aplicación con `ExpressAdapter`. Dos servidores de Node, `http.createServer()` y `https.createServer()`, utilizan el mismo listener Express. Ambos escuchan exclusivamente en `127.0.0.1` y comparten proveedores y controladores. Las pruebas comprueban esa identidad común a través de peticiones reales.

El servidor HTTPS recibe clave y certificado mediante opciones y establece TLS 1.2 como versión mínima. El test genera una CA privada temporal, firma un certificado con SAN para `localhost` y `127.0.0.1`, y configura esa CA concreta en el `https.Agent` cliente. La misma petición falla al usar un cliente que no confía en esa CA. La validación de certificados permanece activada.

Para arrancar la demo con tus archivos de certificado:

```sh
pnpm build
TLS_KEY_PATH=/ruta/localhost.key TLS_CERT_PATH=/ruta/localhost.crt \
  node dist/deployment-lab/main.tls.js
```

Puertos predeterminados: HTTP **3080**, HTTPS **3443**. Se cambian con `HTTP_PORT` y `HTTPS_PORT`. Para verificar la conexión: `curl --cacert /ruta/ca.crt https://127.0.0.1:3443/deployment/status`. Las claves privadas no se guardan en el repositorio.

## Keep-alive

`configureKeepAlive()` configura `keepAliveTimeout` en ambos servidores y establece `headersTimeout` un segundo por encima. El valor de demo es 5000 ms. El valor adecuado en un despliegue depende también de los timeouts del cliente, proxy y balanceador.

Las pruebas usan agentes HTTP y HTTPS con `keepAlive: true` y `maxSockets: 1`. Ejecutan dos peticiones consecutivas y verifican tanto `ClientRequest.reusedSocket` como el mismo puerto remoto observado por el servidor. Esto comprueba la reutilización real de una conexión TCP.

Al terminar se destruyen los agentes, se cierran ambos servidores y se ejecuta `app.close()`. El cierre del laboratorio termina también sus conexiones todavía abiertas. Un error al cargar TLS o enlazar un puerto activa la misma limpieza. Los certificados y la CA solo existen en el directorio temporal de cada ejecución del test.

## Documentación oficial

- [Nest: Serverless](https://docs.nestjs.com/faq/serverless)
- [Nest: HTTPS y múltiples servidores](https://docs.nestjs.com/faq/multiple-servers)
- [Nest: Keep-alive](https://docs.nestjs.com/faq/keep-alive-connections)
- [CodeGenie serverless-express](https://github.com/CodeGenieApp/serverless-express)
