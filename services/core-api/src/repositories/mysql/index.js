/**
 * @file index.js
 * @description
 * Aggregator for MySQL-backed repository modules used by the core-api
 * service. This module exposes a single import surface for the rest of
 * the backend, making it easy to discover and use repositories.
 *
 * Responsibilities:
 * - Re-export user/admin repositories.
 * - Re-export listing repositories (flights, hotels, cars).
 *
 * Example usage:
 * ```js
 * import {
 *   usersRepository,
 *   adminsRepository,
 *   flightsRepository,
 *   hotelsRepository,
 *   carsRepository,
 * } from "@/repositories/mysql/index.js";
 *
 * const user = await usersRepository.findUserById(userId);
 * const { items: flights } = await flightsRepository.searchFlights(filters, opts);
 * ```
 */

import * as usersRepository from "./users-repository.js";
import * as adminsRepository from "./admins-repository.js";
import * as flightsRepository from "./flights-repository.js";
import * as hotelsRepository from "./hotels-repository.js";
import * as carsRepository from "./cars-repository.js";

export {
  usersRepository,
  adminsRepository,
  flightsRepository,
  hotelsRepository,
  carsRepository,
};
