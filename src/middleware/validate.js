const { errorResponse } = require("../utils/helpers");

function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors = error.details.map((d) => d.message);
      return errorResponse(res, "Validation failed", 400, errors);
    }
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.query, { abortEarly: false });
    if (error) {
      const errors = error.details.map((d) => d.message);
      return errorResponse(res, "Invalid query parameters", 400, errors);
    }
    next();
  };
}

module.exports = { validate, validateQuery };
