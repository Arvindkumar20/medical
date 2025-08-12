export class CustomError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // to distinguish logic vs code bug
    Error.captureStackTrace(this, this.constructor);
  }
}

