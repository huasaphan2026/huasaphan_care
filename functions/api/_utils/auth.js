const PASSWORD_HASH_ALGORITHM = "pbkdf2-sha256";
const PASSWORD_HASH_ITERATIONS = 210000;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_HASH_BITS = 256;
const SESSION_TOKEN_BYTES = 32;
export const SESSION_COOKIE_NAME = "hsc_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const SESSION_SECRET_MIN_LENGTH = 32;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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

function getSessionSecret(env) {
  const secret = String(env.SESSION_SECRET || "");

  if (secret.length < SESSION_SECRET_MIN_LENGTH) {
    return "";
  }

  return secret;
}

async function signSessionPayload(payloadText, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(payloadText)
  );

  return new Uint8Array(signature);
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

export async function diagnosePasswordVerification(password, storedHash) {
  const result = {
    passwordType: typeof password,
    passwordLength: typeof password === "string" ? password.length : 0,
    passwordUtf8Length:
      typeof password === "string" ? textEncoder.encode(password).length : 0,
    storedHashType: typeof storedHash,
    storedHashLength: typeof storedHash === "string" ? storedHash.length : 0,
    partsCount: 0,
    algorithmMatches: false,
    iterationsValid: false,
    iterations: null,
    saltTextLength: 0,
    hashTextLength: 0,
    saltBytesLength: 0,
    storedHashBytesLength: 0,
    candidateHashBytesLength: 0,
    parseSucceeded: false,
    deriveSucceeded: false,
    equal: false,
    firstMismatchIndex: null,
    errorName: null,
    errorMessage: null,
  };

  try {
    const parts = String(storedHash || "").split("$");
    result.partsCount = parts.length;

    if (parts.length !== 4) {
      return result;
    }

    const [algorithm, iterationsText, saltText, hashText] = parts;
    const iterations = Number(iterationsText);

    result.algorithmMatches = algorithm === PASSWORD_HASH_ALGORITHM;
    result.iterations = Number.isFinite(iterations) ? iterations : null;
    result.iterationsValid =
      Number.isInteger(iterations) &&
      iterations >= 100000 &&
      iterations <= 1000000;
    result.saltTextLength = saltText.length;
    result.hashTextLength = hashText.length;

    const parsed = parseStoredHash(storedHash);

    if (!parsed) {
      return result;
    }

    result.parseSucceeded = true;
    result.saltBytesLength = parsed.salt.length;
    result.storedHashBytesLength = parsed.hash.length;

    const candidateHash = await derivePasswordHash(
      password,
      parsed.salt,
      parsed.iterations
    );

    result.deriveSucceeded = true;
    result.candidateHashBytesLength = candidateHash.length;
    result.equal = constantTimeEqual(candidateHash, parsed.hash);

    if (!result.equal) {
      const maxLength = Math.max(candidateHash.length, parsed.hash.length);

      for (let index = 0; index < maxLength; index += 1) {
        if ((candidateHash[index] ?? -1) !== (parsed.hash[index] ?? -1)) {
          result.firstMismatchIndex = index;
          break;
        }
      }
    }

    return result;
  } catch (error) {
    result.errorName = error?.name || "UnknownError";
    result.errorMessage = error?.message || "Unknown error";
    return result;
  }
}

export function createSessionToken() {
  return bytesToBase64Url(randomBytes(SESSION_TOKEN_BYTES));
}

export function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const [rawName, ...rawValue] = cookie.trim().split("=");

    if (rawName === name) {
      return rawValue.join("=");
    }
  }

  return "";
}

export async function createSignedSession(user, env) {
  const secret = getSessionSecret(env);

  if (!secret) {
    throw new Error("SESSION_SECRET is not configured");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    uid: user.id,
    sid: createSessionToken(),
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  };
  const payloadText = bytesToBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const signature = await signSessionPayload(payloadText, secret);

  return `${payloadText}.${bytesToBase64Url(signature)}`;
}

export async function verifySessionToken(token, env) {
  const secret = getSessionSecret(env);

  if (!secret) {
    return null;
  }

  const parts = String(token || "").split(".");

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }

  try {
    const [payloadText, signatureText] = parts;
    const expectedSignature = await signSessionPayload(payloadText, secret);
    const actualSignature = base64UrlToBytes(signatureText);

    if (!constantTimeEqual(expectedSignature, actualSignature)) {
      return null;
    }

    const payload = JSON.parse(textDecoder.decode(base64UrlToBytes(payloadText)));
    const now = Math.floor(Date.now() / 1000);

    if (!Number.isInteger(payload.uid) || !Number.isInteger(payload.exp)) {
      return null;
    }

    if (payload.exp <= now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function sessionCookie(token) {
  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ].join("; ");
}

export function clearSessionCookie() {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0",
  ].join("; ");
}
