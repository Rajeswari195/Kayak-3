// services/core-api/src/services/analytics/revenue-analytics-service.js

/**
 * Revenue-focused analytics queries against MySQL.
 *
 * Exposed functions:
 *  - getTopPropertiesByRevenue({ year, limit })
 *  - getCityRevenueForYear({ year })
 *  - getTopProvidersForMonth({ year, month, limit })
 */

import { mysqlQuery } from "../../db/mysql.js";

/**
 * Get top properties (flights/hotels/cars) by total revenue in a given year.
 *
 * @param {{ year: number, limit?: number }} params
 * @returns {Promise<Array<{
 *   listingType: 'FLIGHT'|'HOTEL'|'CAR',
 *   listingId: string,
 *   listingName: string,
 *   totalRevenue: number,
 *   currency: string
 * }>>}
 */
export async function getTopPropertiesByRevenue(params) {
  const year = Number(params.year);
  const limit = Math.min(Math.max(Number(params.limit || 10), 1), 100);

  const sql = `
    SELECT
      bi.item_type AS listing_type,
      COALESCE(h.id, f.id, c.id) AS listing_id,
      CASE
        WHEN bi.item_type = 'HOTEL' THEN h.name
        WHEN bi.item_type = 'FLIGHT' THEN CONCAT(f.airline, ' ', f.flight_number)
        WHEN bi.item_type = 'CAR' THEN CONCAT(c.provider_name, ' ', c.make, ' ', c.model)
        ELSE 'Unknown'
      END AS listing_name,
      SUM(bi.total_price) AS total_revenue,
      MIN(bi.currency) AS currency
    FROM booking_items bi
    INNER JOIN bookings b
      ON bi.booking_id = b.id
    LEFT JOIN hotels h
      ON bi.hotel_id = h.id
    LEFT JOIN flights f
      ON bi.flight_id = f.id
    LEFT JOIN cars c
      ON bi.car_id = c.id
    WHERE b.status = 'CONFIRMED'
      AND YEAR(b.created_at) = ?
    GROUP BY listing_type, listing_id, listing_name
    ORDER BY total_revenue DESC
    LIMIT ?
  `;

  const rows = await mysqlQuery(sql, [year, limit]);

  return (rows || []).map((row) => ({
    listingType: row.listing_type,
    listingId: row.listing_id,
    listingName: row.listing_name,
    totalRevenue: Number(row.total_revenue || 0),
    currency: row.currency || "USD",
  }));
}

/**
 * Aggregate revenue by city for a given year.
 *
 * Hotels: hotel.city
 * Cars:   cars.pickup_city
 * Flights: origin airport city
 *
 * @param {{ year: number }} params
 * @returns {Promise<Array<{ city: string, totalRevenue: number }>>}
 */
export async function getCityRevenueForYear(params) {
  const year = Number(params.year);

  // Hotels
  const hotelSql = `
    SELECT
      h.city AS city,
      SUM(bi.total_price) AS total_revenue
    FROM booking_items bi
    INNER JOIN bookings b ON bi.booking_id = b.id
    INNER JOIN hotels h ON bi.hotel_id = h.id
    WHERE b.status = 'CONFIRMED'
      AND bi.item_type = 'HOTEL'
      AND YEAR(b.created_at) = ?
    GROUP BY h.city
  `;

  // Cars (pickup city)
  const carSql = `
    SELECT
      c.pickup_city AS city,
      SUM(bi.total_price) AS total_revenue
    FROM booking_items bi
    INNER JOIN bookings b ON bi.booking_id = b.id
    INNER JOIN cars c ON bi.car_id = c.id
    WHERE b.status = 'CONFIRMED'
      AND bi.item_type = 'CAR'
      AND YEAR(b.created_at) = ?
    GROUP BY c.pickup_city
  `;

  // Flights (origin airport city)
  const flightSql = `
    SELECT
      a.city AS city,
      SUM(bi.total_price) AS total_revenue
    FROM booking_items bi
    INNER JOIN bookings b ON bi.booking_id = b.id
    INNER JOIN flights f ON bi.flight_id = f.id
    INNER JOIN airports a ON f.origin_airport_id = a.id
    WHERE b.status = 'CONFIRMED'
      AND bi.item_type = 'FLIGHT'
      AND YEAR(b.created_at) = ?
    GROUP BY a.city
  `;

  const [hotelRows, carRows, flightRows] = await Promise.all([
    mysqlQuery(hotelSql, [year]),
    mysqlQuery(carSql, [year]),
    mysqlQuery(flightSql, [year]),
  ]);

  const agg = new Map();

  function accumulate(rows) {
    for (const row of rows || []) {
      const city = row.city || "Unknown";
      const revenue = Number(row.total_revenue || 0);
      agg.set(city, (agg.get(city) || 0) + revenue);
    }
  }

  accumulate(hotelRows);
  accumulate(carRows);
  accumulate(flightRows);

  const result = Array.from(agg.entries())
    .map(([city, totalRevenue]) => ({ city, totalRevenue }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  return result;
}

/**
 * Top providers (hosts/airlines/car providers) by revenue for a given month.
 *
 * @param {{ year: number, month: number, limit?: number }} params
 * @returns {Promise<Array<{
 *   provider: string,
 *   listingType: 'FLIGHT'|'HOTEL'|'CAR',
 *   itemsSold: number,
 *   totalRevenue: number
 * }>>}
 */
export async function getTopProvidersForMonth(params) {
  const year = Number(params.year);
  const month = Number(params.month);
  const limit = Math.min(Math.max(Number(params.limit || 10), 1), 100);

  const sql = `
    SELECT
      CASE
        WHEN bi.item_type = 'HOTEL' THEN h.name
        WHEN bi.item_type = 'FLIGHT' THEN f.airline
        WHEN bi.item_type = 'CAR' THEN c.provider_name
        ELSE 'Unknown'
      END AS provider,
      bi.item_type AS listing_type,
      COUNT(*) AS items_sold,
      SUM(bi.total_price) AS total_revenue
    FROM booking_items bi
    INNER JOIN bookings b ON bi.booking_id = b.id
    LEFT JOIN hotels h ON bi.hotel_id = h.id
    LEFT JOIN flights f ON bi.flight_id = f.id
    LEFT JOIN cars c ON bi.car_id = c.id
    WHERE b.status = 'CONFIRMED'
      AND YEAR(b.created_at) = ?
      AND MONTH(b.created_at) = ?
    GROUP BY provider, listing_type
    HAVING provider IS NOT NULL
    ORDER BY total_revenue DESC
    LIMIT ?
  `;

  const rows = await mysqlQuery(sql, [year, month, limit]);

  return (rows || []).map((row) => ({
    provider: row.provider || "Unknown",
    listingType: row.listing_type,
    itemsSold: Number(row.items_sold || 0),
    totalRevenue: Number(row.total_revenue || 0),
  }));
}
