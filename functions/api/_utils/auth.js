const PASSWORD_HASH_ALGORITHM = "pbkdf2-sha256";
const PASSWORD_HASH_ITERATIONS = 210000;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_HASH_BITS = 256;
const SESSION_TOKEN_BYTES = 32;

const textEncoder = new TextEncoder();

function bytesToBase64Url(bytes) {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function derivePasswordHash(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations,
    },
    keyMaterial,
    PASSWORD_HASH_BITS
  );

  return new Uint8Array(hash);
}

function constantTimeEqual(left, right) {
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (left[index] || 0) ^ (right[index] || 0);
  }

  return diff === 0;
}

function parseStoredHash(storedHash) {
  const parts = String(storedHash || "").split("$");

  if (parts.length !== 4) {
    return null;
  }

  const [algorithm, iterationsText, saltText, hashText] = parts;
  const iterations = Number(iterationsText);

  if (
    algorithm !== PASSWORD_HASH_ALGORITHM ||
    !Number.isInteger(iterations) ||
    iterations < 100000 ||
    iterations > 1000000 ||
    !saltText ||
    !hashText
  ) {
    return null;
  }

  return {
    iterations,
    salt: base64UrlToBytes(saltText),
    hash: base64UrlToBytes(hashText),
  };
}

export async function hashPassword(password) {
  if (typeof password !== "string" || password.length === 0) {
    throw new TypeError("Password is required");
  }

  const salt = randomBytes(PASSWORD_SALT_BYTES);
  const hash = await derivePasswordHash(password, salt, PASSWORD_HASH_ITERATIONS);

  return [
    PASSWORD_HASH_ALGORITHM,
    PASSWORD_HASH_ITERATIONS,
    bytesToBase64Url(salt),
    bytesToBase64Url(hash),
  ].join("$");
}

export async function verifyPassword(password, storedHash) {
  if (typeof password !== "string" || !storedHash) {
    return false;
  }

  try {
    const parsed = parseStoredHash(storedHash);

    if (!parsed) {
      return false;
    }

    const candidateHash = await derivePasswordHash(
      password,
      parsed.salt,
      parsed.iterations
    );

    return constantTimeEqual(candidateHash, parsed.hash);
  } catch {
    return false;
  }
}

export function createSessionToken() {
  return bytesToBase64Url(randomBytes(SESSION_TOKEN_BYTES));
}
