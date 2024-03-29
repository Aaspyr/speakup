const AppError = require("../utils/appError");
const User = require("./../models/userModel");
const catchAsync = require("./../utils/catchAsync");
const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const sendEmail = require("./../utils/email");
const crypto = require("crypto");

const signToken = function (id) {
  return jwt.sign({ id: id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  //define and send cookie

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    secure: true,
    httpOnly: true,
  };
  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;

  res.cookie("jwt", token, cookieOptions);

  //Remove password from the output
  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user: user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
  });

  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  //1)Check if email and password exist
  if (!email || !password) {
    return next(new AppError("Please provide an email and password", 400));
  }
  //2)Check if user exists && password is correct
  const user = await User.findOne({ email: email }).select("+password");

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect email or password", 401));
  }

  //3) If everything is ok, send token to client
  createSendToken(user, 200, res);
});

//AUTHENTICATION

//middleware function to protect access from users that are not logged in
exports.protect = catchAsync(async (req, res, next) => {
  //1) Getting the token and check if it exists
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new AppError("Please log in to access this route", 401));
  }

  //2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  //3) Chceck if user still exists, (errorController)
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError("The user belonging to this token does not exist", 401)
    );
  }
  //4) Check if user changed password after the token was issued, (userModel)

  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError("User recently changed password. Please login again")
    );
  }

  // GRANT ACCESS TO THE PROTECTED ROUTE
  req.user = currentUser;
  next();
});

//AUTHORIZATION
exports.restrictTo = function (...roles) {
  return (req, res, next) => {
    //roles is an array fe. ['admin']
    if (!roles.includes(req.user.role)) {
      return next(
        new Error("You don't have permission to do this action", 403)
      );
    }
    next();
  };
};

//FORGOT PASSWORD
exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError("There is no user with email address.", 404));
  }

  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  const resetURL = `${req.protocol}://${req.get(
    "host"
  )}/api/v1/users/resetPassword/${resetToken}`;

  const message = `Do you forgot password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}.\nIf you didn't forget your password, ignore this email.`;

  try {
    await sendEmail({
      email: user.email,
      subject: "Your password reset token (valid for 20 min)",
      message,
    });

    res.status(200).json({
      status: "success",
      message: "Token sent to email.",
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError("There was an error sending the email. Try again later!"),
      500
    );
  }
});

//RESET PASSWORD
exports.resetPassword = catchAsync(async (req, res, next) => {
  //1) Get user based on the token
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  //2) If token has not expired, and there is a user, set the new password
  if (!user) {
    return next(new AppError("Token has expired", 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  //3) Update changedPasswordAt property for the user - in userModel
  //4)Log the user in
  createSendToken(user, 200, res);
});

//UPDATE PASSWORD
exports.updatePassword = catchAsync(async (req, res, next) => {
  //1) get the user from the collection
  const user = await User.findById(req.user.id).select("+password");

  //2) Chceck if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError("Incorrect password", 401));
  }
  //3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  //4) Log the user in,send JTW
  createSendToken(user, 200, res);
});
