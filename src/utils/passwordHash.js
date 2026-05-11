import { hash, verify } from "argon2";

/**
 * Argon2id parameters. Currently matches the upstream library's defaults,
 * but pinned here so a future swap (e.g. to `@node-rs/argon2` for ARM64
 * builds) won't silently weaken the work factor — `@node-rs/argon2`
 * defaults to 4 MiB memory / parallelism=1, which would be ~16× weaker
 * than what the existing DB hashes use.
 *
 * `argon2` npm defaults: memoryCost=65536 (64 MiB), timeCost=3,
 * parallelism=4. We pass them explicitly so swap-out is safe.
 */
const ARGON2_PARAMS = Object.freeze({
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
});

export function hashPassword(password) {
  return hash(password, ARGON2_PARAMS);
}

export function verifyPassword(storedHash, password) {
  return verify(storedHash, password);
}
