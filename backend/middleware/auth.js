const jwt      = require('jsonwebtoken');
const { error, forbidden } = require('../utils/response');
require('dotenv').config();

// Verify access token and attach decoded user to req.user
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) return error(res, 'Authentication token required', 401);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, name, email, role }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Token expired', 401);
    }
    return error(res, 'Invalid token', 401);
  }
}

// Restrict route to specific roles
// Usage: authorize('admin')  or  authorize('admin','teacher')
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return error(res, 'Not authenticated', 401);
    if (!roles.includes(req.user.role)) {
      return forbidden(res, `Access restricted to: ${roles.join(', ')}`);
    }
    next();
  };
}

// Allow a user to access their own resource OR an admin
// Usage: authorizeOwnerOrAdmin('userId')  where 'userId' is the param name
function authorizeOwnerOrAdmin(paramName = 'id') {
  return (req, res, next) => {
    const resourceId = parseInt(req.params[paramName]);
    const isOwner    = req.user.id === resourceId;
    const isAdmin    = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return forbidden(res);
    }
    next();
  };
}

module.exports = { authenticate, authorize, authorizeOwnerOrAdmin };
