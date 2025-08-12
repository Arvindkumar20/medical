// utils/redis.js
// require("dotenv").config();
// export const redis = require("redis");

import "dotenv/config";
import redis from "redis";

export const {
  REDIS_URL,
  REDIS_HOST = "127.0.0.1",
  REDIS_PORT = 6379,
  REDIS_PASSWORD,
} = process.env;

let client;

export const createClient = () => {
  if (REDIS_URL) {
    return redis.createClient({ url: REDIS_URL });
  }

   const opts = {
    socket: {
      host: REDIS_HOST,
      port: Number(REDIS_PORT),
      reconnectStrategy: (retries) => {
        // exponential backoff, cap at 5s
        return Math.min(1000 * 2 ** retries, 5000);
      },
    },
  };

  if (REDIS_PASSWORD) {
    opts.password = REDIS_PASSWORD;
  }

  return redis.createClient(opts);
};

client = createClient();

client.on("error", (err) => {
  console.error("Redis Client Error:", err);
});

client.on("ready", () => {
  console.log("Redis is ready");
});

client.on("connect", () => {
  console.log("Connected to Redis");
});

client.on("reconnecting", (delay) => {
  console.log(`Reconnecting to Redis in ${delay}ms`);
});

// auto-connect
(async () => {
  try {
    await client.connect();
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
  }
})();

// helpers
export const get = async (key) => {
  if (!key) return null;
   const v = await client.get(key);
  return v;
};

export const set = async (key, value, ttlSeconds = null) => {
  if (ttlSeconds && Number(ttlSeconds) > 0) {
    return await client.set(key, typeof value === "string" ? value : JSON.stringify(value), {
      EX: Number(ttlSeconds),
    });
  } else {
    return await client.set(key, typeof value === "string" ? value : JSON.stringify(value));
  }
};

export const setEx = async (key, ttlSeconds, value) => {
  return await client.setEx(key, Number(ttlSeconds), typeof value === "string" ? value : JSON.stringify(value));
};

export const del = async (key) => {
  return await client.del(key);
};

export const incr = async (key) => {
  return await client.incr(key);
};

export const expire = async (key, ttlSeconds) => {
  return await client.expire(key, Number(ttlSeconds));
};

// export export const  {
//   client,
//   get,
//   set,
//   setEx,
//   del,
//   incr,
//   expire,
// };
