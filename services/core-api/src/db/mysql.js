/**
 * @file mysql.js
 * @description
 * MySQL connection pool helper for the core-api service.
 *
 * Responsibilities:
 * - Lazily create a shared MySQL connection pool using mysql2/promise.
 * - Expose a simple `mysqlQuery` helper for one-off queries.
 * - Expose a `withMysqlTransaction` helper to run functions inside a
 *   transaction with automatic commit/rollback.
 * - Provide `closeMysqlPool` for graceful shutdown.
 */

import mysql from "mysql2/promise";
import { getMysqlConnectionConfig } from "../config/db-config.js";

let pool;

/**
 * Lazily initialize and return the shared MySQL connection pool.
 *
 * @returns {import("mysql2/promise").Pool}
 */
export function getMysqlPool() {
  if (pool) {
    return pool;
  }

  const { url, poolMin, poolMax } = getMysqlConnectionConfig();

  // mysql2 supports a `uri` field plus normal pool options.
  pool = mysql.createPool({
    uri: url,
    waitForConnections: true,
    connectionLimit: poolMax,
    // `maxIdle` is not strictly required, but helps keep a smaller idle set.
    maxIdle: poolMin,
    idleTimeout: 60_000,
    queueLimit: 0
  });

  // Basic startup log; a proper logger will replace console.log later.
  console.log(
    `[db:mysql] Created connection pool (min=${poolMin}, max=${poolMax})`
  );

  return pool;
}

/**
 * Execute a SQL query using either a provided connection (inside a transaction)
 * or the shared pool.
 *
 * @template T
 * @param {string} sql - SQL query string.
 * @param {any[]} [params=[]] - Parameter values for prepared statements.
 * @param {import("mysql2/promise").PoolConnection | null} [connection=null]
 * @returns {Promise<T[]>}
 */
export async function mysqlQuery(sql, params = [], connection = null) {
  const executor = connection || getMysqlPool();
  const [rows] = await executor.query(sql, params);
  return /** @type {T[]} */ (rows);
}

/**
 * Run a function within a MySQL transaction, with automatic commit/rollback.
 *
 * Usage:
 *   const result = await withMysqlTransaction(async (conn) => {
 *     const users = await mysqlQuery("SELECT * FROM users", [], conn);
 *     // ... do more queries ...
 *     return users;
 *   });
 *
 * @template T
 * @param {(conn: import("mysql2/promise").PoolConnection) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withMysqlTransaction(fn) {
  const pool = getMysqlPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const result = await fn(connection);

    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error("[db:mysql] Error during transaction rollback:", rollbackError);
    }
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Gracefully close the MySQL pool.
 * Should be called on process shutdown (e.g., SIGINT/SIGTERM) by whoever
 * owns lifecycle management for the process.
 */
export async function closeMysqlPool() {
  if (!pool) return;

  try {
    await pool.end();
    console.log("[db:mysql] Connection pool closed.");
  } catch (error) {
    console.error("[db:mysql] Error while closing pool:", error);
  } finally {
    pool = undefined;
  }
}
