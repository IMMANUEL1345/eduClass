const success = (res, data = {}, message = 'Success', status = 200) => {
  return res.status(status).json({ ok: true, message, data });
};

const created = (res, data = {}, message = 'Created') => {
  return success(res, data, message, 201);
};

const error = (res, message = 'An error occurred', status = 400, errors = null) => {
  const body = { ok: false, message };
  if (errors) body.errors = errors;
  return res.status(status).json(body);
};

const notFound = (res, message = 'Not found') => error(res, message, 404);

const forbidden = (res, message = 'Access denied') => error(res, message, 403);

const serverError = (res, err) => {
  console.error(err);
  return error(res, 'Internal server error', 500);
};

module.exports = { success, created, error, notFound, forbidden, serverError };
