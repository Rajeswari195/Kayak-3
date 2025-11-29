/**
 * @file db-config.js
 * @description
 * DB-specific configuration helpers for the core-api service.
 *
 * This module wraps the generic config loader and exposes small, focused
 * helpers for MySQL and MongoDB connection settings. It keeps DB concerns
 * out of the main config module and provides a single place to evolve
 * DB-related options (pool sizes, timeouts, etc.).
 */

import { loadConfig } from "./config.js";

/**
 * Return normalized MySQL connection configuration.
 *
 * @returns {{ url: string, poolMin: number, poolMax: number }}
 */
export function getMysqlConnectionConfig() {
  const cfg = loadConfig();

  return {
    url: cfg.mysqlUrl,
    poolMin: cfg.mysqlPool.min,
    poolMax: cfg.mysqlPool.max
  };
}

/**
 * Return normalized MongoDB connection configuration.
 *
 * @returns {{ url: string }}
 */
export function getMongoConnectionConfig() {
  const cfg = loadConfig();

  return {
    url: cfg.mongoUrl
  };
}
