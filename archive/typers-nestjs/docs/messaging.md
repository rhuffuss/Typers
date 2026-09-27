# WebSockets y microservicios

Los módulos de `src/messaging/` ejecutan protocolos reales con NestJS 12. El
laboratorio mantiene aplicaciones separadas para seleccionar cada adapter y
transporte sin abrir todos los puertos al arrancar la aplicación principal.

## Ejecutar

```sh
# TCP, custom HTTP, híbrida, gRPC, Socket.IO y ws: sin servicios externos
pnpm exec vitest run --config vitest.config.e2e.ts test/messaging.e2e-spec.ts

# Contra los cinco brokers del compose del repositorio
docker compose up -d redis mqtt nats rabbitmq kafka
RUN_BROKER_INTEGRATION=1 pnpm exec vitest run --config vitest.config.integration.ts test/integration/messaging.integration-spec.ts

# Seleccionar un subconjunto
RUN_BROKER_INTEGRATION=1 MESSAGING_BROKERS=redis,nats pnpm exec vitest run --config vitest.config.integration.ts test/integration/messaging.integration-spec.ts
```

La suite de integración se omite si no se activa `RUN_BROKER_INTEGRATION=1`.
Una omisión no demuestra conectividad ni entrega. Las pruebas comprueban tanto
`send()` con respuesta como `emit()` seguido de recepción en el controlador;
que termine la publicación no basta para contar el evento como procesado.

Verificación local del 15 de septiembre de 2026: **18/18 e2e** y **10/10
integraciones de brokers** correctas con el lockfile del repositorio. Oxlint con
tipos no señaló avisos en estas fuentes y tests. KafkaJS 2.2.4 emite un
`TimeoutNegativeWarning` con Node 24 durante su gestión interna de solicitudes;
la ejecución completó sus dos pruebas sin rechazos sin gestionar. El logger de
Nest también registra la desconexión intencional de Redis al cerrar el cliente.

## Aplicaciones y contratos

`messaging.harness.ts` exporta `startTcpDemo`, `startHybridDemo`,
`startCustomTransportDemo`, `startGrpcDemo` y `startSocketDemo`. Cada función
devuelve la aplicación, su cliente o URL y `close()` para liberar recursos.
TCP, HTTP y WebSockets escuchan en `127.0.0.1` con puerto asignado por el sistema.
gRPC reserva brevemente un puerto efímero y lo cede al servidor: existe una
pequeña ventana de competencia entre ambos pasos, sin usar un puerto fijo.

`MessagingModule` contiene los controladores RPC/gRPC, el endpoint HTTP
`GET /messaging/status` y un registro en memoria limitado a cien eventos. La
aplicación híbrida comparte ese registro entre HTTP y TCP, y utiliza
`connectMicroservice`, `inheritAppConfig` y `startAllMicroservices`.
Este comportamiento corresponde a la [aplicación híbrida documentada](https://docs.nestjs.com/faq/hybrid-application).

| Patrón RPC              | Entrada                                                              | Resultado                                                                     |
| ----------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `demo.sum`              | `{ values: number[], correlationId?: string, authorized?: boolean }` | Suma, transporte, confirmación y trazas de ejecución.                         |
| `demo.created` (evento) | `{ id: UUID, value: string }`                                        | Registro del evento recibido.                                                 |
| `demo.stream`           | `{ values: number[] }`                                               | Una respuesta por elemento mediante Observable.                               |
| `demo.never`            | `{}`                                                                 | Observable sin respuesta para comprobar `timeout()` y liberación del cliente. |

`authorized: false` provoca un rechazo demostrativo del guard. Ese campo no
autentica usuarios: permite ejercitar la ruta de error sin credenciales. Los
DTOs limitan tamaños y tipos; los pipes convierten errores a `RpcException` y
el filtro los serializa como `{ code: 'DEMO_RPC_ERROR', message }`.

## Cobertura de microservicios

| Documentación oficial                                                         | Ejercicio                                                                                                                                                                                  |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Overview](https://docs.nestjs.com/microservices/basics)                      | `NestFactory.createMicroservice`, `MessagePattern`, `EventPattern`, `Payload`, `Ctx`, `ClientProxyFactory`, `connect`, `send`, `emit`, respuestas Observable, timeout y close.             |
| [Exception filters](https://docs.nestjs.com/microservices/exception-filters)  | Filtro real para errores de DTO y guard sobre TCP y el transporte propio.                                                                                                                  |
| [Pipes](https://docs.nestjs.com/microservices/pipes)                          | `ValidationPipe` con transformación, whitelist y rechazo de propiedades adicionales.                                                                                                       |
| [Guards](https://docs.nestjs.com/microservices/guards)                        | Lectura del payload en `ExecutionContext.switchToRpc` y rechazo explícito.                                                                                                                 |
| [Interceptors](https://docs.nestjs.com/microservices/interceptors)            | Procesamiento RxJS de resultados y correlación de cada mensaje.                                                                                                                            |
| [Pre-request hooks](https://docs.nestjs.com/microservices/pre-request-hooks)  | Dos hooks globales mediante `registerPreRequestHook`, orden antes del guard y `AsyncLocalStorage` aislado entre solicitudes concurrentes. El Observable se suscribe dentro del contexto.   |
| [gRPC](https://docs.nestjs.com/microservices/grpc)                            | `GrpcMethod`, `GrpcStreamMethod`, `ClientGrpc.getService`, protobuf, unary, server streaming, client streaming y streaming bidireccional reales.                                           |
| [Custom transporters](https://docs.nestjs.com/microservices/custom-transport) | `HttpRpcServer extends Server` y `HttpRpcClient extends ClientProxy`, `CustomTransportStrategy`, registro/lookup de handlers, serialización JSON, respuestas NDJSON, cancelación y cierre. |

Los hooks no se aplican a gateways WebSocket. Los tests de gRPC comprueban los
cuatro modos del protocolo, mientras los enhancers y hooks se verifican sobre
TCP/custom; no se atribuye automáticamente esa comprobación a gRPC.

El transporte propio usa HTTP real, limita los mensajes a 64 KiB y consume los
Observables de los handlers. Es un ejemplo acotado de la extensión de Nest;
no implementa autenticación, TLS, persistencia, reintentos ni una política
completa de backpressure para producción.

### Asset protobuf

`src/messaging/calculator.proto` define `typers.demo.Calculator`:

- `Sum`: unary.
- `Numbers`: server streaming.
- `Accumulate`: client streaming.
- `Double`: bidirectional streaming.

El build debe copiar `.proto` a la carpeta `messaging` junto a los módulos
emitidos. El harness lo resuelve con `new URL('./calculator.proto', import.meta.url)`;
una ruta a las fuentes no sustituye esta comprobación al ejecutar `dist`.

## Brokers

`broker-options.ts` exporta `brokerOptions` y `createBrokerClient`; las opciones
se comparten entre servidor y cliente, con identificadores distintos donde el
protocolo lo requiere. Kafka se suscribe al topic de respuestas antes de conectar;
la suite prepara sus topics con `createTopics` y `waitForLeaders` para evitar una
carrera de autocreación al arrancar contra un broker nuevo.

El evento contiene un campo de dominio llamado `value`. Para Kafka,
`brokerEventPayload` construye `{ key, value: eventoCompleto, headers }`:
pasar directamente el evento haría que el serializador interpretase su campo
`value` como el payload completo del registro Kafka.

| Transporte                                                 | Endpoint local / variable                                | Ejercicio específico                                                                                                                                                    |
| ---------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Redis](https://docs.nestjs.com/microservices/redis)       | `127.0.0.1:56379`; `MESSAGING_REDIS_PORT`                | Pub/Sub, `RedisContext`. Sin persistencia ni ack de consumo.                                                                                                            |
| [MQTT](https://docs.nestjs.com/microservices/mqtt)         | `mqtt://127.0.0.1:51883`; `MESSAGING_MQTT_URL`           | Clientes con IDs independientes, suscripción QoS 1 y `MqttContext`. No demuestra entrega exactamente una vez.                                                           |
| [NATS](https://docs.nestjs.com/microservices/nats)         | `nats://127.0.0.1:54222`; `MESSAGING_NATS_URL`           | Core NATS con `@nats-io/transport-node`, queue group y `NatsContext`. No incluye JetStream.                                                                             |
| [RabbitMQ](https://docs.nestjs.com/microservices/rabbitmq) | `127.0.0.1:56720`; `MESSAGING_RABBITMQ_URL` o `AMQP_URL` | Cola por ejecución, prefetch 1, `noAck: false`, `RmqContext.getChannelRef/getMessage` y ack explícito. Credenciales locales de compose: `typers` / `typers-demo-local`. |
| [Kafka](https://docs.nestjs.com/microservices/kafka)       | `127.0.0.1:59092`; `MESSAGING_KAFKA_BROKER`              | Consumer group por ejecución, `subscribeToResponseOf`, `KafkaContext`, offset siguiente y commit explícito con `autoCommit: false`.                                     |

No se mezclan garantías entre protocolos: un ack AMQP, un commit de offset y
la finalización de `ClientProxy.emit()` representan operaciones diferentes.
Las dos pruebas de cada broker verifican suma y recepción de evento. No cubren
caídas, reentrega, DLQ, transacciones, TLS ni todos los ajustes de cada driver.

## WebSockets

`SocketIoMessagingModule` y `RawWsMessagingModule` cargan gateways distintos.
Ambos usan DTOs, `MessageBody`, guard, pipe, interceptor, filtro y hooks
`afterInit`, `handleConnection` y `handleDisconnect`.
Los gateways singleton usan `WebSocketServer` para publicar mensajes.
Referencias: [Gateways](https://docs.nestjs.com/websockets/gateways),
[Adapters](https://docs.nestjs.com/websockets/adapter),
[Filters](https://docs.nestjs.com/websockets/exception-filters),
[Pipes](https://docs.nestjs.com/websockets/pipes),
[Guards](https://docs.nestjs.com/websockets/guards),
[Interceptors](https://docs.nestjs.com/websockets/interceptors).

| Operación      | Socket.IO (`IoAdapter`)                                   | ws (`WsAdapter`, `/ws`)                                          |
| -------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| `echo`         | Ack implícito `{ text, intercepted: true }`.              | Paquete `{ event: 'reply', data: { text, intercepted: true } }`. |
| `explicit-ack` | `Ack()` inyecta el callback explícito.                    | No hay una API de ack equivalente en ws.                         |
| `announce`     | `server.emit('broadcast', ...)` para clientes conectados. | `send` a cada conexión abierta; respuesta `announced`.           |
| `stream`       | Observable publica eventos `word`.                        | Observable produce paquetes `word`.                              |
| Error          | Evento `exception`.                                       | Paquete JSON `exception` enviado por el filtro.                  |

Los clientes reales de prueba verifican respuestas, difusión entre conexiones,
DTO inválido, rechazo del guard e interceptor. Los servidores y conexiones se
cierran al terminar. Las pruebas usan puertos locales y no necesitan navegador.

## Alcance para Typers

Estas pruebas recorren decoradores legacy, metadata, DI, imports ESM, módulos
dinámicos, RxJS, callbacks, eventos, APIs de red y assets. Constituyen un corpus
de aceptación para compilar por distintas rutas. Ejecutar Vitest sobre fuentes
no demuestra que Typers haya emitido ni ejecutado ese código; se debe registrar
el compilador efectivo y repetir el harness sobre sus artefactos.
