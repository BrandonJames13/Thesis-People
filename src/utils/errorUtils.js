const SQLSTATE = {
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
  CHECK_VIOLATION: "23514",
  NOT_NULL_VIOLATION: "23502",
  RLS_VIOLATION: "42501",
};

function getCombinedErrorText(error) {
  return `${error?.message ?? ""} ${error?.details ?? ""} ${error?.hint ?? ""}`
    .trim()
    .toLowerCase();
}

function extractConstraintName(error) {
  const text = `${error?.details ?? ""} ${error?.message ?? ""} ${error?.hint ?? ""}`;
  const quotedMatch = text.match(/constraint\s+"([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1].trim();

  const plainMatch = text.match(/constraint\s+([a-zA-Z0-9_]+)/i);
  if (plainMatch?.[1]) return plainMatch[1].trim();

  return null;
}

function extractTableName(error) {
  const text = `${error?.message ?? ""} ${error?.details ?? ""}`;
  const tableMatch = text.match(/for table\s+"([^"]+)"/i);
  return tableMatch?.[1] ? tableMatch[1].trim() : null;
}

function extractColumnName(error) {
  const text = `${error?.details ?? ""} ${error?.message ?? ""}`;
  const quotedColumnMatch = text.match(/column\s+"([^"]+)"/i);
  if (quotedColumnMatch?.[1]) return quotedColumnMatch[1].trim();

  const plainColumnMatch = text.match(/column\s+([a-zA-Z0-9_]+)/i);
  return plainColumnMatch?.[1] ? plainColumnMatch[1].trim() : null;
}

export function isRlsViolation(error) {
  const code = String(error?.code ?? "").trim();
  if (code === SQLSTATE.RLS_VIOLATION) return true;
  return getCombinedErrorText(error).includes("row-level security");
}

export function isUniqueViolation(error) {
  const code = String(error?.code ?? "").trim();
  if (code === SQLSTATE.UNIQUE_VIOLATION) return true;
  const text = getCombinedErrorText(error);
  return text.includes("duplicate key value") && text.includes("unique");
}

export function isForeignKeyViolation(error) {
  const code = String(error?.code ?? "").trim();
  if (code === SQLSTATE.FOREIGN_KEY_VIOLATION) return true;
  const text = getCombinedErrorText(error);
  return text.includes("violates foreign key constraint");
}

export function isCheckViolation(error) {
  const code = String(error?.code ?? "").trim();
  if (code === SQLSTATE.CHECK_VIOLATION) return true;
  const text = getCombinedErrorText(error);
  return text.includes("violates check constraint");
}

export function isNotNullViolation(error) {
  const code = String(error?.code ?? "").trim();
  if (code === SQLSTATE.NOT_NULL_VIOLATION) return true;
  const text = getCombinedErrorText(error);
  return text.includes("null value") && text.includes("violates not-null");
}

export function normalizePostgresError(
  error,
  fallbackMessage = "Database operation failed.",
) {
  const message =
    [error?.message, error?.details, error?.hint].filter(Boolean).join(" | ") ||
    fallbackMessage;

  return {
    code: String(error?.code ?? "").trim() || null,
    message,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
    table: extractTableName(error),
    constraint: extractConstraintName(error),
    column: extractColumnName(error),
  };
}

export function buildDatabaseErrorMessage(
  error,
  {
    operation = "complete this action",
    table = null,
    entity = null,
    fallbackMessage = "Database operation failed.",
  } = {},
) {
  const normalized = normalizePostgresError(error, fallbackMessage);
  const target = entity || table || normalized.table || "record";
  const actionPrefix = `Unable to ${operation} ${target}.`;

  let userMessage = normalized.message;

  if (isRlsViolation(error)) {
    userMessage = `Permission denied by row-level security while trying to ${operation} ${target}.`;
  } else if (isUniqueViolation(error)) {
    userMessage = `${actionPrefix} A record with the same unique value already exists.`;
  } else if (isForeignKeyViolation(error)) {
    userMessage = `${actionPrefix} This record is referenced by related data. Remove dependent records first.`;
  } else if (isCheckViolation(error)) {
    userMessage = `${actionPrefix} One or more values failed a validation rule.`;
  } else if (isNotNullViolation(error)) {
    userMessage = `${actionPrefix} A required field is missing.`;
  }

  if (normalized.constraint) {
    userMessage = `${userMessage} (Constraint: ${normalized.constraint})`;
  }

  return {
    ...normalized,
    userMessage,
  };
}
