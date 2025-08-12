export const errorHandler = (err, req, res, next) => {
    let statusCode = err?.statusCode || 500;
    let message = err?.message || "Internal Server Error";
console.log(err)
    // MongoDB invalid ID
    if (err?.name === "CastError") {
        statusCode = 400;
        message = `Invalid ${err?.path}: ${err?.value}`;
    }

    // Duplicate key error
    if (err?.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err?.keyValue).join(",");
        message = `Duplicate field: ${field}`;
    }

    // Mongoose validation
    if (err?.name === "ValidationError") {
        statusCode = 422;
        message = Object.values(err?.errors).map(val => val?.message).join(", ");
    }

    res?.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV !== "production" && { stack: err?.stack })
    });
};

