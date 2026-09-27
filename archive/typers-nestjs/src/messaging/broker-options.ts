import {
  ClientKafka,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import type {
  ClientProxy,
  KafkaOptions,
  MqttOptions,
  NatsOptions,
  RedisOptions,
  RmqOptions,
} from '@nestjs/microservices';
import { SUM_PATTERN } from './messaging.controller.js';

export const BROKERS = ['redis', 'mqtt', 'nats', 'rabbitmq', 'kafka'] as const;
export type BrokerName = (typeof BROKERS)[number];
export type BrokerOptions =
  RedisOptions | MqttOptions | NatsOptions | RmqOptions | KafkaOptions;

export function brokerOptions(
  broker: BrokerName,
  runId: string,
): BrokerOptions {
  switch (broker) {
    case 'redis':
      return {
        transport: Transport.REDIS,
        options: {
          host: '127.0.0.1',
          port: Number(process.env.MESSAGING_REDIS_PORT ?? 56379),
          retryAttempts: 2,
          retryDelay: 100,
        },
      };
    case 'mqtt':
      return {
        transport: Transport.MQTT,
        options: {
          url: process.env.MESSAGING_MQTT_URL ?? 'mqtt://127.0.0.1:51883',
          clientId: `typers-${runId}`,
          reconnectPeriod: 0,
          connectTimeout: 5000,
          subscribeOptions: { qos: 1 },
        },
      };
    case 'nats':
      return {
        transport: Transport.NATS,
        options: {
          servers: [process.env.MESSAGING_NATS_URL ?? 'nats://127.0.0.1:54222'],
          queue: `typers-${runId}`,
          maxReconnectAttempts: 0,
          timeout: 5000,
        },
      };
    case 'rabbitmq':
      return {
        transport: Transport.RMQ,
        options: {
          urls: [
            process.env.MESSAGING_RABBITMQ_URL ??
              process.env.AMQP_URL ??
              'amqp://typers:typers-demo-local@127.0.0.1:56720',
          ],
          queue: `typers-${runId}`,
          queueOptions: { durable: true, autoDelete: true },
          noAck: false,
          prefetchCount: 1,
        },
      };
    case 'kafka':
      return {
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: `typers-${runId}`,
            brokers: [process.env.MESSAGING_KAFKA_BROKER ?? '127.0.0.1:59092'],
            retry: { retries: 2 },
            connectionTimeout: 5000,
          },
          consumer: {
            groupId: `typers-${runId}`,
            allowAutoTopicCreation: true,
          },
          run: { autoCommit: false },
        },
      };
  }
}

export type DemoMessageClient = Pick<
  ClientProxy,
  'connect' | 'close' | 'send' | 'emit'
>;

export function brokerEventPayload(
  broker: BrokerName,
  data: { id: string; value: string },
) {
  // Kafka treats a top-level `value` as its record envelope. Wrap the domain
  // object explicitly so its value field is not mistaken for the whole payload.
  return broker === 'kafka'
    ? { key: data.id, value: data, headers: { source: 'typers-nestjs' } }
    : data;
}

export async function prepareKafkaTopics(): Promise<void> {
  const { Kafka, logLevel } = await import('kafkajs');
  const admin = new Kafka({
    clientId: 'typers-topic-setup',
    brokers: [process.env.MESSAGING_KAFKA_BROKER ?? '127.0.0.1:59092'],
    logLevel: logLevel.ERROR,
  }).admin();
  await admin.connect();
  try {
    const existing = new Set(await admin.listTopics());
    const topics = [
      'demo.sum',
      'demo.sum.reply',
      'demo.created',
      'demo.stream',
      'demo.never',
    ].filter((topic) => !existing.has(topic));
    if (topics.length === 0) return;
    await admin.createTopics({
      waitForLeaders: true,
      topics: topics.map((topic) => ({
        topic,
        numPartitions: 1,
        replicationFactor: 1,
      })),
    });
  } finally {
    await admin.disconnect();
  }
}

export function createBrokerClient(
  broker: BrokerName,
  runId: string,
): DemoMessageClient {
  const options = brokerOptions(broker, runId);
  if (options.transport === Transport.MQTT) {
    options.options = {
      ...options.options,
      clientId: `typers-client-${runId}`,
    };
  }
  if (options.transport === Transport.RMQ) {
    options.options = { ...options.options, noAck: true };
  }
  const client = ClientProxyFactory.create(options);
  if (client instanceof ClientKafka) client.subscribeToResponseOf(SUM_PATTERN);
  return client;
}
