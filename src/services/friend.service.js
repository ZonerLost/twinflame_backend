const { supabase } = require("../config/supabase");

class FriendService {
  async getFriends(userId) {
    const { data: friends, error } = await supabase
      .from("friends")
      .select("id, friend_id, friends_since, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("friends_since", { ascending: false });

    if (error) throw new Error(error.message);

    if (friends.length === 0) return [];

    const friendIds = friends.map((f) => f.friend_id);

    const [profilesRes, photosRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name").in("user_id", friendIds),
      supabase.from("profile_photos").select("user_id, photo_url").in("user_id", friendIds).eq("is_primary", true),
    ]);

    const profiles = profilesRes.data || [];
    const photos = photosRes.data || [];

    return friends.map((f) => {
      const profile = profiles.find((p) => p.user_id === f.friend_id);
      const photo = photos.find((p) => p.user_id === f.friend_id);

      return {
        id: f.id,
        friendId: f.friend_id,
        name: profile?.full_name,
        photo: photo?.photo_url,
        friendsSince: f.friends_since,
      };
    });
  }

  async getFriendCount(userId) {
    const { count, error } = await supabase
      .from("friends")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "active");

    if (error) throw new Error(error.message);
    return { count };
  }

  async removeFriend(userId, friendId) {
    // Remove both directions
    await supabase
      .from("friends")
      .update({ status: "removed" })
      .eq("user_id", userId)
      .eq("friend_id", friendId);

    await supabase
      .from("friends")
      .update({ status: "removed" })
      .eq("user_id", friendId)
      .eq("friend_id", userId);

    return { message: "Friend removed" };
  }
}

module.exports = new FriendService();
