import { createUserService } from "../services/users/create-user-service.js";
import { loginUserService } from "../services/users/login-service.js";
import { getUserByIdService } from "../services/users/get-user-service.js";
import { updateUserProfileService } from "../services/users/update-user-service.js";
import { deleteUserService } from "../services/users/delete-user-service.js";

/**
 * POST /api/users
 * Register a new user (SSN-style userId, address validation, etc.).
 */
export async function createUserController(req, res, next) {
  try {
    const publicUser = await createUserService(req.body);
    res.status(201).json({ user: publicUser });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 * Email + password login, returns JWT + public user info.
 */
export async function loginController(req, res, next) {
  try {
    const result = await loginUserService(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/users/me
 * Returns the profile for the currently authenticated user.
 */
export async function getCurrentUserController(req, res, next) {
  try {
    const authUser = req.user;
    const publicUser = await getUserByIdService(authUser.id);
    res.json({ user: publicUser });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/users/me
 * Update current user's profile.
 */
export async function updateCurrentUserController(req, res, next) {
  try {
    const authUser = req.user;
    const updated = await updateUserProfileService(authUser.id, req.body);
    res.json({ user: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/users/:id
 * Get user by id; allowed if:
 * - requesting own profile, or
 * - requester is ADMIN.
 */
export async function getUserByIdController(req, res, next) {
  try {
    const { id } = req.params;
    const authUser = req.user;

    if (authUser.role !== "ADMIN" && authUser.id !== id) {
      return res.status(403).json({
        code: "forbidden",
        message: "You do not have permission to view this user."
      });
    }

    const publicUser = await getUserByIdService(id);
    res.json({ user: publicUser });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/users/:id
 * Update user by id (self or ADMIN). Uses same validation as profile update.
 */
export async function updateUserByIdController(req, res, next) {
  try {
    const { id } = req.params;
    const authUser = req.user;

    if (authUser.role !== "ADMIN" && authUser.id !== id) {
      return res.status(403).json({
        code: "forbidden",
        message: "You do not have permission to update this user."
      });
    }

    const updated = await updateUserProfileService(id, req.body);
    res.json({ user: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/users/:id
 * Delete/deactivate user by id.
 * - Self-delete: soft-deactivates account if NO active bookings.
 * - Admin delete: same behaviour, but admin can delete any user.
 *
 * If you later want admins to override the active-bookings check, you can
 * pass { allowDeleteWithActiveBookings: true } for admin calls.
 */
export async function deleteUserByIdController(req, res, next) {
  try {
    const { id } = req.params;
    const authUser = req.user;

    if (authUser.role !== "ADMIN" && authUser.id !== id) {
      return res.status(403).json({
        code: "forbidden",
        message: "You do not have permission to delete this user."
      });
    }

    // For now, use conservative defaults: no delete with active bookings, soft-delete.
    const result = await deleteUserService(id, {
      allowDeleteWithActiveBookings: false,
      hardDelete: false
    });

    res.json({ result });
  } catch (err) {
    next(err);
  }
}
