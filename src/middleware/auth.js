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

    // Check account status
    const { data: userData } = await supabase
      .from("users")
      .select("account_status")
      .eq("id", data.user.id)
      .single();

    if (userData?.account_status === "banned") {
      return errorResponse(res, "Your account has been banned. Contact support for more information.", 403);
    }

    req.accountStatus = userData?.account_status || "active";
    next();
  } catch (err) {
    return errorResponse(res, "Authentication failed", 401);
  }
}

// Middleware to check if account is active (not suspended or banned)
function requireActiveAccount(req, res, next) {
  if (req.accountStatus === "suspended") {
    return errorResponse(res, "Your account is suspended. This action is not available.", 403);
  }
  if (req.accountStatus === "banned") {
    return errorResponse(res, "Your account has been banned.", 403);
  }
  next();
}

module.exports = { authenticate, requireActiveAccount };
