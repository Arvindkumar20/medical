import {User} from "../models/User.js"; // assume ESM export
import createHttpError from "http-errors";

/**
 * Simple in-memory cache (optional). Reset on process restart.
 * key: userId, value: { data, expiresAt }
 */
const userCache = new Map();

/**
 * Get user by ID with options.
 * @param {string} id - User ObjectId string
 * @param {object} options
 *   - select: string or array of fields to include/exclude (mongoose projection syntax)
 *   - populate: string or array or object for mongoose populate
 *   - lean: boolean (default true)
 *   - useCache: boolean (default false)
 *   - cacheTTL: seconds (default 60)
 * @returns {Promise<object>} user document
 */
export const getUser = async (id, options = {}) => {
  if (!id) throw createHttpError(400, "User id is required");

  const {
    select = null,
    populate = null,
    lean = true,
    useCache = false,
    cacheTTL = 60
  } = options;

  const cacheKey = `${id}:${JSON.stringify({ select, populate })}`;

  if (useCache) {
    const cached = userCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }

  let query = User.findById(id);

  if (select) {
    query = query.select(select);
  }

  if (populate) {
    query = query.populate(populate);
  }

  if (lean) {
    query = query.lean();
  }

  const user = await query.exec();
  if (!user) {
    throw createHttpError(404, "User not found");
  }

  if (useCache) {
    userCache.set(cacheKey, {
      data: user,
      expiresAt: Date.now() + cacheTTL * 1000
    });
  }

  return user;
};

/**
 * Optional: clear cache for a specific user (e.g., after update)
 */
export const invalidateUserCache = (id, options = {}) => {
  const { select = null, populate = null } = options;
  const key = `${id}:${JSON.stringify({ select, populate })}`;
  userCache.delete(key);
};
