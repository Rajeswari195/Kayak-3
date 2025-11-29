/**
 * @file role-middleware.js
 * @description
 * Role-based authorization middlewares for the core-api service.
 *
 * Responsibilities:
 * - Ensure that only users with sufficient roles can access certain routes.
 * - Provide a reusable factory `requireRole(role)` and a convenience
 *   `requireAdmin` middleware.
 *
 * Usage patterns:
 *   router.get(
 *     "/admin/users",
 *     requireAuth,       // from auth-middleware.js
 *     requireAdmin,      // from this file
 *     adminUsersController.listUsers
 *   );
 */

/**
 * Factory to create a role-checking middleware for a specific role.
 *
 * @param {("USER"|"ADMIN")} requiredRole
 * @returns {import("express").RequestHandler}
 */
export function requireRole(requiredRole) {
  /**
   * @param {import("express").Request & { user?: { id: string, role?: string } }} req
   * @param {import("express").Response} res
   * @param {import("express").NextFunction} next
   */
  return function roleMiddleware(req, res, next) {
    // If no user is attached, treat as unauthenticated.
    if (!req.user) {
      return res.status(401).json({
        code: "token_missing",
        message: "Authentication required to access this resource."
      });
    }

    const role = req.user.role || "USER";

    if (role !== requiredRole) {
      return res.status(403).json({
        code: "forbidden",
        message: "You do not have permission to perform this action."
      });
    }

    return next();
  };
}

/**
 * Convenience middleware that requires the ADMIN role.
 *
 * Usage:
 *   router.use("/admin", requireAuth, requireAdmin);
 */
export const requireAdmin = requireRole("ADMIN");
