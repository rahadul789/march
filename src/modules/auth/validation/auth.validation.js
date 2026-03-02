const AppError = require("../../../core/errors/AppError");
const { USER_ROLES } = require("../types");

const phoneRegex = /^\+?[1-9]\d{7,14}$/;

function ensureNonEmptyString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(`${field} is required`, 400, "VALIDATION_ERROR", {
      field,
    });
  }

  return value.trim();
}

function validatePassword(password) {
  const normalized = ensureNonEmptyString(password, "password");

  if (normalized.length < 4 || normalized.length > 72) {
    throw new AppError(
      "Password must be between 4 and 72 characters",
      400,
      "VALIDATION_ERROR",
      {
        field: "password",
      },
    );
  }

  // const hasLetter = /[A-Za-z]/.test(normalized);
  // const hasNumber = /\d/.test(normalized);

  // if (!hasLetter || !hasNumber) {
  //   throw new AppError(
  //     "Password must contain at least one letter and one number",
  //     400,
  //     "VALIDATION_ERROR",
  //     {
  //       field: "password",
  //     },
  //   );
  // }

  return normalized;
}

function validateRegisterPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new AppError("Invalid request body", 400, "VALIDATION_ERROR");
  }

  const fullName = ensureNonEmptyString(payload.fullName, "fullName");
  const email = ensureNonEmptyString(payload.email, "email").toLowerCase();
  const phone = ensureNonEmptyString(payload.phone, "phone");
  const password = validatePassword(payload.password);

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new AppError("Invalid email format", 400, "VALIDATION_ERROR", {
      field: "email",
    });
  }

  // if (!phoneRegex.test(phone)) {
  //   throw new AppError(
  //     "Phone number must be in valid international format",
  //     400,
  //     "VALIDATION_ERROR",
  //     {
  //       field: "phone",
  //     },
  //   );
  // }

  const requestedRole = payload.role
    ? ensureNonEmptyString(payload.role, "role")
    : USER_ROLES.USER;

  if (!Object.values(USER_ROLES).includes(requestedRole)) {
    throw new AppError("Invalid role", 400, "VALIDATION_ERROR", {
      field: "role",
    });
  }

  if (requestedRole === USER_ROLES.ADMIN) {
    throw new AppError(
      "Admin account cannot be self-registered",
      403,
      "FORBIDDEN_ROLE_ASSIGNMENT",
    );
  }

  return {
    fullName,
    email,
    phone,
    password,
    role: requestedRole,
  };
}

function validateLoginPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new AppError("Invalid request body", 400, "VALIDATION_ERROR");
  }

  const identifier = ensureNonEmptyString(payload.identifier, "identifier");
  const password = ensureNonEmptyString(payload.password, "password");

  return {
    identifier,
    password,
  };
}

function validateRefreshPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new AppError("Invalid request body", 400, "VALIDATION_ERROR");
  }

  return {
    refreshToken: ensureNonEmptyString(payload.refreshToken, "refreshToken"),
  };
}

function validateLogoutPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new AppError("Invalid request body", 400, "VALIDATION_ERROR");
  }

  return {
    refreshToken: ensureNonEmptyString(payload.refreshToken, "refreshToken"),
  };
}

function extractRequestContext(req) {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  return {
    ipAddress: req.ip || null,
    userAgent: req.headers["user-agent"] || null,
    deviceId: typeof body.deviceId === "string" ? body.deviceId.trim() : null,
    platform: typeof body.platform === "string" ? body.platform.trim() : null,
    pushToken:
      typeof body.pushToken === "string" ? body.pushToken.trim() : null,
  };
}

module.exports = {
  validateRegisterPayload,
  validateLoginPayload,
  validateRefreshPayload,
  validateLogoutPayload,
  extractRequestContext,
};
