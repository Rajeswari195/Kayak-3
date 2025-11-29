import { usersRepository } from "../../repositories/mysql/index.js";
import {
  DomainError,
  NotFoundError
} from "../../lib/errors.js";
import { normalizePaginationParams } from "../../validators/common-validators.js";
import { toPublicUser, toPublicUserList } from "../users/user-view.js";

/**
 * List users for admin usage, with pagination and optional filters.
 */
export async function adminListUsersService(query = {}) {
  const { page, pageSize } = normalizePaginationParams(query, {
    defaultPage: 1,
    defaultPageSize: 20,
    maxPageSize: 200
  });

  const isActiveRaw = query.isActive;
  let isActive = undefined;

  if (typeof isActiveRaw === "string") {
    if (isActiveRaw.toLowerCase() === "true") isActive = true;
    if (isActiveRaw.toLowerCase() === "false") isActive = false;
  } else if (typeof isActiveRaw === "boolean") {
    isActive = isActiveRaw;
  }

  const search =
    typeof query.search === "string" && query.search.trim().length
      ? query.search.trim()
      : undefined;

  const offset = (page - 1) * pageSize;

  const users = await usersRepository.listUsers({
    limit: pageSize,
    offset,
    isActive,
    search
  });

  return {
    page,
    pageSize,
    hasMore: users.length === pageSize,
    users: toPublicUserList(users)
  };
}

/**
 * Fetch a single user by id for admin.
 */
export async function adminGetUserDetailService(userId) {
  if (!userId || typeof userId !== "string") {
    throw new DomainError("userId (path parameter) must be a non-empty string.");
  }

  const user = await usersRepository.findUserById(userId);
  if (!user) {
    throw new NotFoundError("User not found.", { userId });
  }

  return toPublicUser(user);
}

/**
 * Soft-deactivate a user (is_active = 0). Bookings remain valid.
 */
export async function adminDeactivateUserService(userId) {
  if (!userId || typeof userId !== "string") {
    throw new DomainError("userId (path parameter) must be a non-empty string.");
  }

  const user = await usersRepository.findUserById(userId);
  if (!user) {
    throw new NotFoundError("User not found.", { userId });
  }

  if (!user.isActive) {
    // Already inactive; just return current state
    return toPublicUser(user);
  }

  const updated = await usersRepository.deactivateUser(userId);
  return toPublicUser(updated);
}
