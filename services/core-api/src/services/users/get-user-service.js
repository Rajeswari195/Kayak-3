import { usersRepository } from "../../repositories/mysql/index.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { toPublicUser } from "./user-view.js";

export async function getUserByIdService(userId) {
  if (!userId || typeof userId !== "string") {
    throw new ValidationError("userId must be a non-empty string.");
  }

  const user = await usersRepository.findUserById(userId);
  if (!user) {
    throw new NotFoundError("User not found.", { userId });
  }

  return toPublicUser(user);
}
