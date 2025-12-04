/**
 * @file admins-repository.js
 * @description
 * MySQL repository for the `admins` table.
 * * Responsibilities:
 * - Manage the extended admin profile linked to the `users` table.
 * - Handles role assignment (SUPER_ADMIN, ADMIN, ANALYST).
 * - This table is supplementary to the `users` table's `is_admin` flag,
 * providing granular permissions.
 */

import { mysqlQuery } from "../../db/mysql.js";
import { randomUUID } from "node:crypto";

/**
 * @typedef {Object} AdminRow
 * @property {string} id
 * @property {string} user_id
 * @property {string} admin_role
 * @property {number} is_active
 * @property {Date} created_at
 * @property {Date} updated_at
 */

/**
 * @typedef {Object} AdminRecord
 * @property {string} id
 * @property {string} userId
 * @property {"SUPER_ADMIN"|"ADMIN"|"ANALYST"} role
 * @property {boolean} isActive
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * Map raw DB row to domain object.
 * @param {AdminRow} row 
 * @returns {AdminRecord}
 */
function mapAdminRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    role: /** @type {"SUPER_ADMIN"|"ADMIN"|"ANALYST"} */ (row.admin_role),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

/**
 * Find admin details by user ID.
 * * @param {string} userId 
 * @param {import("mysql2/promise").PoolConnection | null} connection 
 * @returns {Promise<AdminRecord | null>}
 */
export async function findAdminByUserId(userId, connection = null) {
  const sql = `
    SELECT * FROM admins 
    WHERE user_id = ? 
    LIMIT 1
  `;
  const rows = await mysqlQuery(sql, [userId], connection);
  return rows.length ? mapAdminRow(rows[0]) : null;
}

/**
 * Create or update an admin record.
 * * @param {Object} params
 * @param {string} params.userId
 * @param {"SUPER_ADMIN"|"ADMIN"|"ANALYST"} [params.role="ADMIN"]
 * @param {import("mysql2/promise").PoolConnection | null} connection
 * @returns {Promise<AdminRecord>}
 */
export async function upsertAdmin({ userId, role = "ADMIN" }, connection = null) {
  const existing = await findAdminByUserId(userId, connection);
  
  if (existing) {
    const sql = `UPDATE admins SET admin_role = ? WHERE user_id = ?`;
    await mysqlQuery(sql, [role, userId], connection);
    return { ...existing, role };
  } else {
    const id = randomUUID();
    const sql = `
      INSERT INTO admins (id, user_id, admin_role, is_active)
      VALUES (?, ?, ?, 1)
    `;
    await mysqlQuery(sql, [id, userId, role], connection);
    return findAdminByUserId(userId, connection);
  }
}