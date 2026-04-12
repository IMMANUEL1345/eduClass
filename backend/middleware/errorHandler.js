const { validationResult } = require('express-validator');
const { error } = require('../utils/response');

// Run express-validator checks and short-circuit if invalid
function validate(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return error(res, 'Validation failed', 422, result.array());
  }
  next();
}

// Catch-all error handler — must be last middleware in app
function globalErrorHandler(err, req, res, next) {
  console.error('Unhandled error:', err);

  // MySQL duplicate entry
  if (err.code === 'ER_DUP_ENTRY') {
    return error(res, 'A record with that value already exists', 409);
  }

  // MySQL foreign key violation
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return error(res, 'Referenced record does not exist', 400);
  }

  return res.status(500).json({ ok: false, message: 'Internal server error' });
}

module.exports = { validate, globalErrorHandler };
