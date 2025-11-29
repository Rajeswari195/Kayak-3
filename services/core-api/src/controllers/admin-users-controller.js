import {
  adminListUsersService,
  adminGetUserDetailService,
  adminDeactivateUserService
} from "../services/admins/admin-user-management-service.js";

/**
 * GET /api/admin/users
 * List users with pagination, optional isActive & search filters.
 */
export async function adminListUsersController(req, res, next) {
  try {
    const result = await adminListUsersService(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/users/:id
 * Get details of a specific user.
 */
export async function adminGetUserDetailController(req, res, next) {
  try {
    const { id } = req.params;
    const user = await adminGetUserDetailService(id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/users/:id/deactivate
 * Soft-deactivate a user account (is_active = 0).
 */
export async function adminDeactivateUserController(req, res, next) {
  try {
    const { id } = req.params;
    const user = await adminDeactivateUserService(id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}
