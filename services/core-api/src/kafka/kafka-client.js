/**
 * @file kafka-client.js
 * @description
 * Kafka client wrapper for the core-api service.
 *
 * Responsibilities:
 * - Initialize a shared Kafka instance using kafkajs.
 * - Expose helpers for creating a singleton producer and reusable consumers.
 * - Provide a small helper to send JSON messages to a topic.
 *
 * Notes:
 * - Install kafkajs in services/core-api:
 *     npm install kafkajs
 */

import { Kafka, logLevel as KafkaLogLevel } from "kafkajs";
import { loadConfig } from "../config/config.js";

/**
 * @typedef {import("kafkajs").Kafka} KafkaInstance
 * @typedef {import("kafkajs").Producer} KafkaProducer
 * @typedef {import("kafkajs").Consumer} KafkaConsumer
 */

/** @type {KafkaInstance | null} */
let kafkaInstance = null;
/** @type {KafkaProducer | null} */
let kafkaProducer = null;
/** @type {Map<string, KafkaConsumer>} */
const kafkaConsumers = new Map();

/**
 * Map app log levels to kafkajs log levels.
 *
 * @param {string} level
 * @returns {number}
 */
function mapLogLevel(level) {
  const normalized = (level || "info").toLowerCase();
  switch (normalized) {
    case "debug":
      return KafkaLogLevel.DEBUG;
    case "warn":
    case "warning":
      return KafkaLogLevel.WARN;
    case "error":
    case "critical":
      return KafkaLogLevel.ERROR;
    case "info":
    default:
      return KafkaLogLevel.INFO;
  }
}

/**
 * Create a new Kafka instance from configuration.
 *
 * @returns {KafkaInstance}
 * @private
 */
function createKafkaInstance() {
  const config = loadConfig();

  return new Kafka({
    clientId: "kayak-core-api",
    brokers: config.kafkaBrokers,
    logLevel: mapLogLevel(config.logLevel),
  });
}

/**
 * Get (and lazily initialize) the Kafka instance.
 *
 * @returns {KafkaInstance}
 */
export function getKafka() {
  if (!kafkaInstance) {
    kafkaInstance = createKafkaInstance();
  }
  return kafkaInstance;
}

/**
 * Get (and lazily initialize) a shared Kafka producer.
 *
 * @returns {Promise<KafkaProducer>}
 */
export async function getKafkaProducer() {
  if (kafkaProducer) {
    return kafkaProducer;
  }

  const kafka = getKafka();
  kafkaProducer = kafka.producer();

  await kafkaProducer.connect();
  return kafkaProducer;
}

/**
 * Create (or reuse) a Kafka consumer for the given group and topics.
 *
 * @param {Object} params
 * @param {string} params.groupId - Consumer group ID.
 * @param {string[]} params.topics - Topics to subscribe to.
 * @param {boolean} [params.fromBeginning=false] - Whether to read from the beginning.
 * @returns {Promise<KafkaConsumer>}
 */
export async function createKafkaConsumer({
  groupId,
  topics,
  fromBeginning = false,
}) {
  const sortedTopicsKey = topics.slice().sort().join(",");
  const consumerKey = `${groupId}::${sortedTopicsKey}`;

  if (kafkaConsumers.has(consumerKey)) {
    return kafkaConsumers.get(consumerKey);
  }

  const kafka = getKafka();
  const consumer = kafka.consumer({ groupId });

  await consumer.connect();

  for (const topic of topics) {
    await consumer.subscribe({ topic, fromBeginning });
  }

  kafkaConsumers.set(consumerKey, consumer);
  return consumer;
}

/**
 * Helper to send a JSON-serialized message to a Kafka topic.
 *
 * @param {string} topic
 * @param {Object} payload - Arbitrary JSON-serializable payload.
 * @param {string | null} [key] - Optional partition key.
 * @param {Record<string,string>} [headers] - Optional message headers.
 * @returns {Promise<void>}
 */
export async function sendKafkaJsonMessage(topic, payload, key = null, headers = {}) {
  const producer = await getKafkaProducer();

  const message = {
    value: JSON.stringify(payload),
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  };

  if (key != null) {
    message.key = String(key);
  }

  await producer.send({
    topic,
    messages: [message],
  });
}

/**
 * Gracefully shutdown the Kafka producer and all consumers.
 *
 * @returns {Promise<void>}
 */
export async function shutdownKafka() {
  if (kafkaProducer) {
    try {
      await kafkaProducer.disconnect();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[kafka] Error disconnecting producer:", err);
    } finally {
      kafkaProducer = null;
    }
  }

  for (const [key, consumer] of kafkaConsumers.entries()) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await consumer.disconnect();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[kafka] Error disconnecting consumer (${key}):`, err);
    } finally {
      kafkaConsumers.delete(key);
    }
  }
}
