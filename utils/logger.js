import { createLogger, format, transports } from "winston";

export const logger = createLogger({
    level: "info", // default: info, can be overridden by ENV
    format: format.combine(
        format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        format.errors({ stack: true }), // includes stack traces
        format.splat(),
        format.json() // store as structured JSON logs
    ),
    defaultMeta: { service: "user-service" },

    transports: [
        // Save all logs to file
        new transports.File({ filename: "logs/error.log", level: "error" }),
        new transports.File({ filename: "logs/combined.log" })
    ],
});

// 🖥️ Also log to console in dev environment
if (process.env.NODE_ENV !== "production") {
    logger.add(
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.simple()
            ),
        })
    );
}

