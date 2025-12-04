/**
 * @file airports-repository.js
 * @description
 * MySQL repository for looking up airport reference data.
 */

import { mysqlQuery } from "../../db/mysql.js";

/**
 * Find an airport by its 3-letter IATA code.
 * @param {string} iataCode
 * @returns {Promise<Object|null>}
 */
export async function findAirportByIata(iataCode) {
  const sql = `SELECT * FROM airports WHERE iata_code = ? LIMIT 1`;
  const rows = await mysqlQuery(sql, [iataCode]);
  return rows.length ? rows[0] : null;
}