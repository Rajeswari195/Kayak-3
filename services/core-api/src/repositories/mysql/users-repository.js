import { randomUUID } from "crypto";
import { mysqlQuery } from "../../db/mysql.js";

function mapUserRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    zip: row.zip,
    country: row.country,
    phone: row.phone,
    email: row.email,
    profileImageUrl: row.profile_image_url,
    passwordHash: row.password_hash,
    paymentMethodToken: row.payment_method_token,
    paymentBrand: row.payment_brand,
    paymentLast4: row.payment_last4,
    isAdmin: Boolean(row.is_admin),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function findUserById(id, connection = null) {
  const rows = await mysqlQuery(
    "SELECT * FROM users WHERE id = ? LIMIT 1",
    [id],
    connection
  );

  return rows.length ? mapUserRow(rows[0]) : null;
}

export async function findUserByEmail(email, connection = null) {
  const rows = await mysqlQuery(
    "SELECT * FROM users WHERE email = ? LIMIT 1",
    [email],
    connection
  );

  return rows.length ? mapUserRow(rows[0]) : null;
}

export async function findUserByUserId(userId, connection = null) {
  const rows = await mysqlQuery(
    "SELECT * FROM users WHERE user_id = ? LIMIT 1",
    [userId],
    connection
  );

  return rows.length ? mapUserRow(rows[0]) : null;
}

export async function findUserByUserIdOrEmail(
  userId,
  email,
  connection = null
) {
  const rows = await mysqlQuery(
    "SELECT * FROM users WHERE user_id = ? OR email = ? LIMIT 1",
    [userId, email],
    connection
  );

  return rows.length ? mapUserRow(rows[0]) : null;
}

export async function insertUser(user, connection) {
  const id = randomUUID();
  const {
    userId,
    firstName,
    lastName,
    addressLine1,
    addressLine2,
    city,
    state,
    zip,
    country,
    phone,
    email,
    profileImageUrl,
    passwordHash,          // this should already be hashed in the service
    paymentBrand,
    paymentLast4,
    paymentMethodToken,
    isActive = true,
    isAdmin = false
  } = user;

  const sql = `
    INSERT INTO users (
      id,
      user_id,
      first_name,
      last_name,
      address_line1,
      address_line2,
      city,
      state,
      zip,
      country,
      phone,
      email,
      profile_image_url,
      password_hash,
      payment_brand,
      payment_last4,
      payment_method_token,
      is_active,
      is_admin
    )
    VALUES (
      ?,  -- id
      ?,  -- user_id
      ?,  -- first_name
      ?,  -- last_name
      ?,  -- address_line1
      ?,  -- address_line2
      ?,  -- city
      ?,  -- state
      ?,  -- zip
      ?,  -- country
      ?,  -- phone
      ?,  -- email
      ?,  -- profile_image_url
      ?,  -- password_hash
      ?,  -- payment_brand
      ?,  -- payment_last4
      ?,  -- payment_method_token
      ?,  -- is_active
      ?   -- is_admin
    )
  `;

  const params = [
    id,
    userId,
    firstName,
    lastName,
    addressLine1,
    addressLine2 || null,
    city,
    state,
    zip,
    country,
    phone,
    email,
    profileImageUrl || null,
    passwordHash,
    paymentBrand || null,
    paymentLast4 || null,
    paymentMethodToken || null,
    isActive ? 1 : 0,
    isAdmin ? 1 : 0
  ];

  // mysqlQuery should route to either pool or connection under the hood
  await mysqlQuery(sql, params, connection);

  // Use the generated id to return the full row
  const inserted = await findUserById(id, connection);
  return inserted;
}

export async function updateUser(id, updates, connection = null) {
  const fieldMap = {
    userId: "user_id",
    firstName: "first_name",
    lastName: "last_name",
    addressLine1: "address_line1",
    addressLine2: "address_line2",
    city: "city",
    state: "state",
    zip: "zip",
    country: "country",
    phone: "phone",
    email: "email",
    profileImageUrl: "profile_image_url",
    passwordHash: "password_hash",
    paymentMethodToken: "payment_method_token",
    paymentBrand: "payment_brand",
    paymentLast4: "payment_last4",
    isAdmin: "is_admin",
    isActive: "is_active"
  };

  const setClauses = [];
  const params = [];

  for (const [key, value] of Object.entries(updates || {})) {
    const column = fieldMap[key];
    if (!column) continue;

    if (key === "isAdmin" || key === "isActive") {
      setClauses.push(`${column} = ?`);
      params.push(value ? 1 : 0);
    } else {
      setClauses.push(`${column} = ?`);
      params.push(value);
    }
  }

  if (!setClauses.length) {
    // Nothing to update; just return current state
    return findUserById(id, connection);
  }

  const sql = `UPDATE users SET ${setClauses.join(", ")} WHERE id = ?`;
  params.push(id);

  await mysqlQuery(sql, params, connection);

  return findUserById(id, connection);
}

export async function deactivateUser(id, connection = null) {
  await mysqlQuery(
    "UPDATE users SET is_active = 0 WHERE id = ?",
    [id],
    connection
  );

  return findUserById(id, connection);
}

export async function listUsers(
  options = {},
  connection = null
) {
  const {
    limit = 50,
    offset = 0,
    isActive,
    search
  } = options;

  const conditions = [];
  const params = [];

  if (typeof isActive === "boolean") {
    conditions.push("is_active = ?");
    params.push(isActive ? 1 : 0);
  }

  if (search && search.trim().length > 0) {
    const like = `%${search.trim()}%`;
    conditions.push(
      "(email LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR user_id LIKE ?)"
    );
    params.push(like, like, like, like);
  }

  let sql = "SELECT * FROM users";
  if (conditions.length) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const rows = await mysqlQuery(sql, params, connection);
  return rows.map(mapUserRow);
}