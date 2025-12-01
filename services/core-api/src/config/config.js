// src/config/config.js
import path from 'node:path';
import dotenv from 'dotenv';

// 1. Try .env.local first
dotenv.config({
  path: path.resolve(process.cwd(), '.env.local'),
});

// 2. Then fall back to .env (optional)
dotenv.config();
/**
 * @file config.js
 * @description
 * Centralized configuration loader for the core-api (Node.js + Express) service.
 *
 * Responsibilities:
 * - Read environment variables relevant to the core-api.
 * - Normalize and validate configuration values (e.g., numbers, lists).
 * - Fail fast when required configuration values are missing or invalid.
 * - Provide a single function (`loadConfig`) that other modules can call
 *   during startup to obtain a strongly-typed configuration object.
 *
 * Design notes:
 * - This module does not start the server or perform any side effects other
 *   than reading `process.env`. It can be imported in tests without spinning
 *   up an HTTP server.
 * - Required variables are documented in `services/core-api/.env.example`.
 * - We deliberately avoid reading the config at import time; callers must
 *   invoke `loadConfig()` explicitly. This allows tests to mutate `process.env`
 *   before loading configuration.
 *
 * @see services/core-api/.env.example for environment variable descriptions.
 */



/**
 * @typedef {Object} MysqlPoolConfig
 * @property {number} min - Minimum number of pooled connections.
 * @property {number} max - Maximum number of pooled connections.
 */

/**
 * @typedef {Object} CoreApiConfig
 * @property {string} env - Environment name (e.g., "development", "production", "test").
 * @property {number} port - HTTP port for the Express server.
 * @property {string} logLevel - Logging verbosity ("debug" | "info" | "warn" | "error").
 * @property {string} mysqlUrl - Connection string for the MySQL database.
 * @property {MysqlPoolConfig} mysqlPool - Connection pool settings for MySQL.
 * @property {string} mongoUrl - Connection string for MongoDB.
 * @property {string} redisUrl - Connection string for Redis.
 * @property {string[]} kafkaBrokers - List of Kafka broker addresses.
 * @property {string} jwtSecret - Secret used for signing JWT tokens.
 * @property {string[]} corsOrigins - List of allowed CORS origins.
 * @property {string | null} aiServiceBaseUrl - Base URL for the AI service (optional).
 * @property {boolean} paymentsSimulationEnabled - Toggle for payment simulator.
 */

/**
 * Helper: read a string environment variable.
 *
 * @param {string} name - The environment variable name.
 * @param {Object} [options]
 * @param {boolean} [options.required=false] - If true, throws when not set.
 * @param {string | null} [options.defaultValue=null] - Default value when not set.
 * @returns {string | null}
 * @throws {Error} When a required variable is missing.
 */
function readEnvString(name, options = {}) {
  const { required = false, defaultValue = null } = options;
  const value = process.env[name];

  if ((value === undefined || value === null || value === "") && required) {
    throw new Error(
      `[config] Missing required environment variable "${name}". ` +
      `Please define it in services/core-api/.env.local (or your deployment environment).`
    );
  }

  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return value;
}

/**
 * Helper: read an integer environment variable.
 *
 * @param {string} name - Environment variable name.
 * @param {Object} [options]
 * @param {boolean} [options.required=false] - If true, throws when not set or invalid.
 * @param {number | null} [options.defaultValue=null] - Default number if not set.
 * @returns {number | null}
 * @throws {Error} When required and missing/invalid.
 */
function readEnvInt(name, options = {}) {
  const { required = false, defaultValue = null } = options;
  const raw = process.env[name];

  if ((raw === undefined || raw === null || raw === "") && !required) {
    return defaultValue;
  }

  const parsed = Number.parseInt(String(raw), 10);

  if (Number.isNaN(parsed)) {
    if (required) {
      throw new Error(
        `[config] Environment variable "${name}" must be a valid integer, ` +
        `but got "${raw}".`
      );
    }
    return defaultValue;
  }

  return parsed;
}

/**
 * Helper: read a comma-separated list from an environment variable.
 *
 * @param {string} name - Environment variable name.
 * @param {Object} [options]
 * @param {boolean} [options.required=false] - If true, throws when resulting list is empty.
 * @param {string[]} [options.defaultValue=[]] - Default list when not set.
 * @returns {string[]}
 * @throws {Error} When required and resulting list is empty.
 */
function readEnvList(name, options = {}) {
  const { required = false, defaultValue = [] } = options;
  const raw = process.env[name];

  if (raw === undefined || raw === null || raw.trim() === "") {
    if (required) {
      throw new Error(
        `[config] Missing required environment variable "${name}". ` +
        `Expected a comma-separated list (e.g., "localhost:9092").`
      );
    }
    return defaultValue;
  }

  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (required && parts.length === 0) {
    throw new Error(
      `[config] Environment variable "${name}" was set but parsed to an empty list. ` +
      `Please provide at least one value.`
    );
  }

  return parts;
}

/**
 * Cached config reference so that repeated calls to loadConfig()
 * are inexpensive and consistent within a single process.
 *
 * @type {CoreApiConfig | null}
 */
let cachedConfig = null;

/**
 * Load and validate configuration for the core-api service.
 *
 * This function should be called exactly once during application startup
 * (e.g., in the Express bootstrap file) and the resulting config object
 * should be reused across the application.
 *
 * @param {Object} [options]
 * @param {boolean} [options.forceReload=false] - When true, re-reads environment variables.
 * @returns {CoreApiConfig}
 */
export function loadConfig(options = {}) {
  const { forceReload = false } = options;

  if (cachedConfig && !forceReload) {
    return cachedConfig;
  }

  const env = process.env.NODE_ENV || "development";

  const port =
    readEnvInt("PORT", {
      required: false,
      defaultValue: 4000,
    }) ?? 4000;

  const logLevel = readEnvString("LOG_LEVEL", {
    required: false,
    defaultValue: "info",
  });

  // Required core connection strings
  const mysqlUrl = readEnvString("MYSQL_URL", { required: true });
  const mongoUrl = readEnvString("MONGO_URL", { required: true });
  const redisUrl = readEnvString("REDIS_URL", { required: true });
  const kafkaBrokers = readEnvList("KAFKA_BROKERS", {
    required: true,
  });

  const jwtSecret = readEnvString("JWT_SECRET", { required: true });

  // CORS origins: default to Vite dev server for DX if not explicitly set.
  const corsOriginsRaw = readEnvList("CORS_ORIGINS", {
    required: false,
    defaultValue: ["http://localhost:5173"],
  });

  const mysqlPoolMin =
    readEnvInt("MYSQL_POOL_MIN", {
      required: false,
      defaultValue: 2,
    }) ?? 2;

  const mysqlPoolMax =
    readEnvInt("MYSQL_POOL_MAX", {
      required: false,
      defaultValue: 10,
    }) ?? 10;

  if (mysqlPoolMin <= 0 || mysqlPoolMax <= 0 || mysqlPoolMax < mysqlPoolMin) {
    throw new Error(
      "[config] Invalid MySQL pool configuration. Ensure MYSQL_POOL_MIN and " +
      "MYSQL_POOL_MAX are positive integers and MAX >= MIN."
    );
  }

  const aiServiceBaseUrl =
    readEnvString("AI_SERVICE_BASE_URL", {
      required: false,
      defaultValue: null,
    }) || null;

  const paymentsSimulationEnabled =
    (readEnvString("PAYMENTS_SIMULATION_ENABLED", {
      required: false,
      defaultValue: "true",
    }) || "true") === "true";

  /** @type {CoreApiConfig} */
  const config = {
    env,
    port,
    logLevel: logLevel || "info",
    mysqlUrl: /** @type {string} */ (mysqlUrl),
    mysqlPool: {
      min: mysqlPoolMin,
      max: mysqlPoolMax,
    },
    mongoUrl: /** @type {string} */ (mongoUrl),
    redisUrl: /** @type {string} */ (redisUrl),
    kafkaBrokers,
    jwtSecret: /** @type {string} */ (jwtSecret),
    corsOrigins: corsOriginsRaw,
    aiServiceBaseUrl,
    paymentsSimulationEnabled,
  };

  cachedConfig = config;
  return config;
}

/**
 * Optional helper getter that throws a clear error if called before
 * `loadConfig()` has been invoked. This can be useful in modules that
 * want to access config but should not themselves trigger initial loading.
 *
 * @returns {CoreApiConfig}
 */
export function getConfig() {
  if (!cachedConfig) {
    throw new Error(
      "[config] Configuration has not been loaded yet. " +
      "Call loadConfig() during application startup."
    );
  }
  return cachedConfig;
}
