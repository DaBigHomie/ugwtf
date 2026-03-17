/**
 * Shared utilities used across agents and clusters.
 *
 * G26: Extracted common helpers to reduce duplication.
 */

/** Split a GitHub slug ("owner/repo") into its parts. */
export function parseSlug(slug: string): { owner: string; repo: string } {
  const parts = slug.split('/');
  return { owner: parts[0]!, repo: parts[1]! };
}

/**
 * Retry an async function up to `maxAttempts` times with exponential backoff.
 * Useful for GitHub API calls that may be rate-limited.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Safely parse a JSON string, returning null on failure instead of throwing.
 */
export function parseJsonSafe<T = unknown>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Convert a string to a URL-safe slug.
 * Strips non-alphanumeric chars and collapses hyphens.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
