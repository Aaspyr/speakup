const AppError = require("../utils/appError");

const handleJWTError = () => new AppError("Invalid token, please login again");

const handleJWTExpiredErrorDB = () =>
  new AppError("Your token has expired, please login again");

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldErrorDB = (err) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value ${value} Please rename field`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errorsarray = Object.values(err.errors).map((el) => el.message);
  const message = `Validation error. ${errorsarray.join(", ")}`;
  return new AppError(message, 400);
};

const sendErrorDevelopment = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProduction = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    res.status(500).json({
      status: "error",
      message: "Something went wrong",
    });
  }
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    sendErrorDevelopment(err, res);
  } else if (process.env.NODE_ENV === "production") {
    let error = { ...err };
    if (error.name === "CastError") error = handleCastErrorDB(error);

    if (error.code === 11000) error = handleDuplicateFieldErrorDB(error);

    if (error.name === "ValidationError")
      error = handleValidationErrorDB(error);
    if (error.name === "JsonWebTokenError") error = handleJWTError();
    sendErrorProduction(error, res);
    if (error.name === "TokenExpiredError") error = handleJWTExpiredErrorDB();
  }
};
