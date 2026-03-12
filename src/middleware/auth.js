const { supabase } = require("../config/supabase");
const { errorResponse } = require("../utils/helpers");

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(res, "Access token required", 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    // Verify the Supabase JWT and get the user
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return errorResponse(res, "Invalid or expired token", 401);
    }

    req.userId = data.user.id;
    req.userEmail = data.user.email;
    req.userPhone = data.user.phone;
    next();
  } catch (err) {
    return errorResponse(res, "Authentication failed", 401);
  }
}

module.exports = { authenticate };
