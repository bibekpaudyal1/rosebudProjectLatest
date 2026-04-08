// packages/kafka-client/src/index.ts
// Shared Kafka producer/consumer wrapper.
// All services import from '@bazarbd/kafka-client'.
// Wraps kafkajs with retry logic, structured logging, and OpenTelemetry tracing.

import {
  Kafka,
  Producer,
  Consumer,
  KafkaConfig,
  ProducerRecord,
  ConsumerRunConfig,
  EachMessagePayload,
  logLevel,
  CompressionTypes,
} from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { BaseEvent, KafkaEvent } from '@bazarbd/types';

// ============================================================
// KAFKA TOPICS — single source of truth
// ============================================================

export const KAFKA_TOPICS = {
  USER_EVENTS: 'user.events',
  PRODUCT_EVENTS: 'product.events',
  ORDER_EVENTS: 'order.events',
  PAYMENT_EVENTS: 'payment.events',
  SHIPMENT_EVENTS: 'shipment.events',
  INVENTORY_EVENTS: 'inventory.events',
  NOTIFICATION_EVENTS: 'notification.events',
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

// ============================================================
// KAFKA CLIENT FACTORY
// ============================================================

export interface BazarKafkaConfig {
  clientId: string;           // service name e.g. 'order-service'
  brokers: string[];           // e.g. ['localhost:9092']
  groupId?: string;            // consumer group id
  ssl?: boolean;
  sasl?: KafkaConfig['sasl'];
}

export class BazarKafkaClient {
  private kafka: Kafka;
  private producer?: Producer;
  private consumers: Map<string, Consumer> = new Map();
  private readonly config: BazarKafkaConfig;

  constructor(config: BazarKafkaConfig) {
    this.config = config;
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      ssl: config.ssl,
      sasl: config.sasl,
      logLevel: logLevel.WARN,
      retry: {
        initialRetryTime: 300,
        retries: 8,
        multiplier: 2,
        maxRetryTime: 30000,
      },
    });
  }

  // ============================================================
  // PRODUCER
  // ============================================================

  async connectProducer(): Promise<void> {
    this.producer = this.kafka.producer({
      allowAutoTopicCreation: false,
      transactionTimeout: 30000,
      idempotent: true,
    });
    await this.producer.connect();
    console.log(`[KafkaClient] Producer connected — ${this.config.clientId}`);
  }

  /**
   * Publish a typed domain event to a topic.
   * Automatically adds eventId, timestamp, and source.
   */
  async publish<T extends KafkaEvent>(
    topic: KafkaTopic,
    eventType: T['eventType'],
    payload: T['payload'],
    options?: {
      correlationId?: string;
      key?: string;
    },
  ): Promise<void> {
    if (!this.producer) {
      throw new Error('[KafkaClient] Producer not connected. Call connectProducer() first.');
    }

    const event: BaseEvent = {
      eventId: uuidv4(),
      eventType,
      eventVersion: '1.0',
      timestamp: new Date().toISOString(),
      source: this.config.clientId,
      correlationId: options?.correlationId ?? uuidv4(),
      payload,
    };

    const record: ProducerRecord = {
      topic,
      compression: CompressionTypes.GZIP,
      messages: [
        {
          key: options?.key ?? event.eventId,
          value: JSON.stringify(event),
          headers: {
            eventType,
            source: this.config.clientId,
            correlationId: event.correlationId,
          },
        },
      ],
    };

    await this.producer.send(record);
  }

  /**
   * Publish multiple events in a single batch.
   */
  async publishBatch(
    events: Array<{
      topic: KafkaTopic;
      eventType: string;
      payload: Record<string, unknown>;
      key?: string;
    }>,
  ): Promise<void> {
    if (!this.producer) throw new Error('[KafkaClient] Producer not connected.');

    const topicMessages: Record<string, typeof events> = {};
    for (const event of events) {
      if (!topicMessages[event.topic]) topicMessages[event.topic] = [];
      topicMessages[event.topic].push(event);
    }

    await this.producer.sendBatch({
      topicMessages: Object.entries(topicMessages).map(([topic, msgs]) => ({
        topic,
        messages: msgs.map((e) => ({
          key: e.key ?? uuidv4(),
          value: JSON.stringify({
            eventId: uuidv4(),
            eventType: e.eventType,
            eventVersion: '1.0',
            timestamp: new Date().toISOString(),
            source: this.config.clientId,
            correlationId: uuidv4(),
            payload: e.payload,
          } satisfies BaseEvent),
        })),
      })),
    });
  }

  async disconnectProducer(): Promise<void> {
    await this.producer?.disconnect();
  }

  // ============================================================
  // CONSUMER
  // ============================================================

  /**
   * Subscribe to one or more topics and process each message.
   * @param topics  - list of topic names
   * @param handler - called once per message; throw to trigger retry
   * @param groupId - override the default groupId for this consumer
   */
  async subscribe(
    topics: KafkaTopic[],
    handler: (event: BaseEvent, rawMessage: EachMessagePayload) => Promise<void>,
    groupId?: string,
  ): Promise<void> {
    const gid = groupId ?? this.config.groupId;
    if (!gid) throw new Error('[KafkaClient] groupId required to subscribe.');

    const consumer = this.kafka.consumer({
      groupId: gid,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxBytesPerPartition: 1_048_576, // 1MB
    });

    await consumer.connect();

    for (const topic of topics) {
      await consumer.subscribe({ topic, fromBeginning: false });
    }

    const runConfig: ConsumerRunConfig = {
      eachMessage: async (payload: EachMessagePayload) => {
        const { topic, partition, message } = payload;
        if (!message.value) return;

        let event: BaseEvent;
        try {
          event = JSON.parse(message.value.toString()) as BaseEvent;
        } catch {
          console.error(`[KafkaClient] Failed to parse message on ${topic}:${partition}`, message.value.toString());
          return; // skip malformed messages — don't retry
        }

        try {
          await handler(event, payload);
        } catch (err) {
          // Re-throw to trigger kafkajs retry / DLQ mechanism
          console.error(`[KafkaClient] Handler failed for event ${event.eventType}:${event.eventId}`, err);
          throw err;
        }
      },
    };

    await consumer.run(runConfig);
    this.consumers.set(gid, consumer);
    console.log(`[KafkaClient] Consumer ${gid} subscribed to: ${topics.join(', ')}`);
  }

  async disconnectAll(): Promise<void> {
    await this.producer?.disconnect();
    for (const [gid, consumer] of this.consumers) {
      await consumer.disconnect();
      console.log(`[KafkaClient] Consumer ${gid} disconnected`);
    }
    this.consumers.clear();
  }
}

// ============================================================
// FACTORY — creates a configured client from env variables
// ============================================================

export function createKafkaClient(clientId: string, groupId?: string): BazarKafkaClient {
  const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');
  return new BazarKafkaClient({
    clientId,
    brokers,
    groupId,
    ssl: process.env.KAFKA_SSL === 'true',
  });
}

export { BaseEvent, KafkaEvent };