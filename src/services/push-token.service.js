const { supabase } = require("../config/supabase");

class PushTokenService {
  async registerToken(userId, { fcmToken, devicePlatform }) {
    const { error } = await supabase
      .from("user_push_tokens")
      .upsert(
        {
          user_id: userId,
          fcm_token: fcmToken,
          device_platform: devicePlatform,
          updated_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "fcm_token" }
      );

    if (error) throw new Error(error.message);

    return { message: "Push token saved" };
  }

  async unregisterToken(userId, { fcmToken }) {
    const { error } = await supabase
      .from("user_push_tokens")
      .delete()
      .eq("user_id", userId)
      .eq("fcm_token", fcmToken);

    if (error) throw new Error(error.message);

    return { message: "Push token removed" };
  }

  async getTokensForUser(userId) {
    const { data, error } = await supabase
      .from("user_push_tokens")
      .select("id, fcm_token")
      .eq("user_id", userId);

    if (error) throw new Error(error.message);

    return (data || []).filter((row) => row.fcm_token);
  }

  async deleteTokensByValues(tokens) {
    if (!tokens || tokens.length === 0) return;

    const { error } = await supabase
      .from("user_push_tokens")
      .delete()
      .in("fcm_token", tokens);

    if (error) throw new Error(error.message);
  }
}

module.exports = new PushTokenService();
