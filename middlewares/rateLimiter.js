// middleware/rateLimiter.js
/**
 * Simple fixed-window rate limiter (in-memory). NOT distributed.
 * Usage: rateLimiter(100, 900) // 100 requests per 15 minutes
 */

const store = new Map(); // key -> { count, expiresAt }

const cleanupIntervalMs = 60 * 1000; // cleanup every 1 minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  }
}, cleanupIntervalMs);

/**
 * rateLimiter(limit, windowSeconds)
 * @param {number} limit - max requests
 * @param {number} windowSeconds - window duration in seconds
 */
export const rateLimiter = (limit, windowSeconds) => {
  const windowMs = windowSeconds * 1000;

  return (req, res, next) => {
    try {
      const identifier =
        req.ip ||
        req.headers["x-forwarded-for"] ||
        req.connection?.remoteAddress ||
        "unknown";

      const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
      const key = `${identifier}:${windowStart}`;

      const now = Date.now();
      let entry = store.get(key);

      if (!entry) {
        entry = { count: 1, expiresAt: windowStart + windowMs };
        store.set(key, entry);
      } else {
        entry.count += 1;
      }

      const remaining = Math.max(0, limit - entry.count);
      const retryAfterSeconds = Math.ceil((entry.expiresAt - now) / 1000);

      // Set headers for client info
      res.setHeader("X-RateLimit-Limit", String(limit));
      res.setHeader("X-RateLimit-Remaining", String(remaining));
      res.setHeader("X-RateLimit-Reset", String(Math.floor(entry.expiresAt / 1000))); // epoch seconds

      if (entry.count > limit) {
        res.setHeader("Retry-After", String(retryAfterSeconds));
        return res.status(429).json({
          success: false,
          message: `Rate limit exceeded. Try again in ${retryAfterSeconds} seconds.`,
        });
      }

      next();
    } catch (err) {
      // On unexpected error, don't block request
      console.warn("Rate limiter error:", err);
      next();
    }
  };
};
