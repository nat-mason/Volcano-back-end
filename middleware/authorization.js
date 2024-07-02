const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
  const authorizationHeader = req.headers.authorization;

  // Check if the authorization header exists
  if (!authorizationHeader) {
    req.isAuthorized = false;
    return next(); // No token provided, proceed with request
  }

  // Check if the authorization header starts with 'Bearer '
  if (!authorizationHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: true,
      message: "Authorization header is malformed",
    });
  }

  const token = authorizationHeader.replace(/^Bearer /, "");
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    req.isAuthorized = true; // Valid token
    next();
  } catch (e) {
    req.isAuthorized = false; // Invalid token
    if (e.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ error: true, message: "JWT token has expired" });
    } else if (e.name === "JsonWebTokenError") {
      return res
        .status(401)
        .json({ error: true, message: "Invalid JWT token" });
    } else {
      return res
        .status(401)
        .json({ error: true, message: "Invalid JWT token" });
    }
  }
};
