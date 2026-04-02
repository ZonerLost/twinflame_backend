const { supabase } = require("../config/supabase");

class MatchService {
  // ---- DISCOVER (get profiles to swipe) ----
  async discover(userId, { limit = 10, offset = 0, maxDistance, gender }) {
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("user_id, gender, looking_for, latitude, longitude")
      .eq("user_id", userId)
      .single();

    if (!myProfile) {
      throw Object.assign(new Error("Complete your profile first"), { statusCode: 400 });
    }

    const { data: swipedRows } = await supabase
      .from("swipes")
      .select("swiped_id")
      .eq("swiper_id", userId);

    const swipedIds = (swipedRows || []).map((r) => r.swiped_id);

    const { data: restrictedUsers } = await supabase
      .from("users")
      .select("id")
      .in("account_status", ["suspended", "banned"]);

    const restrictedIds = (restrictedUsers || []).map((u) => u.id);
    const hardExcludedIds = [...new Set([userId, ...restrictedIds])];

    let profiles = await this._fetchDiscoverProfiles({
      excludedIds: [...new Set([...hardExcludedIds, ...swipedIds])],
      limit,
      offset,
      gender,
      lookingFor: myProfile.looking_for,
    });

    if (profiles.length === 0) {
      profiles = await this._fetchDiscoverProfiles({
        excludedIds: hardExcludedIds,
        limit,
        offset: 0,
        gender,
        lookingFor: myProfile.looking_for,
      });
    }

    const result = await this._attachProfileMedia(profiles);

    if (maxDistance && myProfile.latitude && myProfile.longitude) {
      return result.filter((p) => {
        if (!p.latitude || !p.longitude) return true;
        const dist = this._calculateDistance(
          myProfile.latitude,
          myProfile.longitude,
          p.latitude,
          p.longitude
        );
        return dist <= maxDistance;
      });
    }

    return result;
  }

  async swipe(userId, { swipedId, action }) {
    if (userId === swipedId) {
      throw Object.assign(new Error("Cannot swipe on yourself"), { statusCode: 400 });
    }

    const hasActiveSubscription = await this._hasActiveSubscription(userId);
    if (!hasActiveSubscription) {
      const dailyLimit = parseInt(process.env.DAILY_SWIPE_LIMIT_FREE) || 25;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from("swipes")
        .select("id", { count: "exact", head: true })
        .eq("swiper_id", userId)
        .gte("created_at", todayStart.toISOString());

      if (count >= dailyLimit) {
        throw Object.assign(new Error("Daily swipe limit reached. Upgrade to premium for unlimited swipes."), { statusCode: 429 });
      }
    }

    const { data, error } = await supabase
      .from("swipes")
      .upsert(
        { swiper_id: userId, swiped_id: swipedId, action },
        { onConflict: "swiper_id,swiped_id" }
      )
      .select()
      .single();

    if (error) throw new Error(error.message);

    let isMatch = false;
    let matchData = null;

    if (action === "like" || action === "superlike") {
      const { data: mutualSwipe } = await supabase
        .from("swipes")
        .select("id")
        .eq("swiper_id", swipedId)
        .eq("swiped_id", userId)
        .in("action", ["like", "superlike"])
        .single();

      if (mutualSwipe) {
        isMatch = true;
        const u1 = userId < swipedId ? userId : swipedId;
        const u2 = userId < swipedId ? swipedId : userId;

        const { data: match } = await supabase
          .from("matches")
          .select("id, matched_at")
          .eq("user1_id", u1)
          .eq("user2_id", u2)
          .single();

        const { data: matchedProfile } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .eq("user_id", swipedId)
          .single();

        const { data: matchedPhoto } = await supabase
          .from("profile_photos")
          .select("photo_url")
          .eq("user_id", swipedId)
          .eq("is_primary", true)
          .single();

        matchData = {
          matchId: match?.id,
          matchedUser: {
            id: swipedId,
            name: matchedProfile?.full_name,
            photo: matchedPhoto?.photo_url,
          },
        };
      }
    }

    return { swipe: data, isMatch, matchData };
  }

  async getMatches(userId) {
    const { data: matches, error } = await supabase
      .from("matches")
      .select("id, user1_id, user2_id, matched_at, is_active")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .eq("is_active", true)
      .order("matched_at", { ascending: false });

    if (error) throw new Error(error.message);

    const otherUserIds = matches.map((m) =>
      m.user1_id === userId ? m.user2_id : m.user1_id
    );

    let profiles = [];
    let photos = [];
    let onlineStatus = [];

    if (otherUserIds.length > 0) {
      const [profilesRes, photosRes, usersRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, location_text")
          .in("user_id", otherUserIds),
        supabase
          .from("profile_photos")
          .select("user_id, photo_url, is_primary")
          .in("user_id", otherUserIds)
          .eq("is_primary", true),
        supabase
          .from("users")
          .select("id, last_seen")
          .in("id", otherUserIds),
      ]);

      profiles = profilesRes.data || [];
      photos = photosRes.data || [];
      onlineStatus = usersRes.data || [];
    }

    return matches.map((match) => {
      const otherUserId = match.user1_id === userId ? match.user2_id : match.user1_id;
      const profile = profiles.find((p) => p.user_id === otherUserId);
      const photo = photos.find((p) => p.user_id === otherUserId);
      const user = onlineStatus.find((u) => u.id === otherUserId);

      const isOnline = user?.last_seen
        ? (Date.now() - new Date(user.last_seen).getTime()) < 5 * 60 * 1000
        : false;

      return {
        matchId: match.id,
        matchedAt: match.matched_at,
        user: {
          id: otherUserId,
          name: profile?.full_name,
          location: profile?.location_text,
          photo: photo?.photo_url,
          online: isOnline,
        },
      };
    });
  }

  async unmatch(userId, matchId) {
    const { data: match } = await supabase
      .from("matches")
      .select("user1_id, user2_id")
      .eq("id", matchId)
      .single();

    if (!match) {
      throw Object.assign(new Error("Match not found"), { statusCode: 404 });
    }

    if (match.user1_id !== userId && match.user2_id !== userId) {
      throw Object.assign(new Error("Unauthorized"), { statusCode: 403 });
    }

    await supabase
      .from("matches")
      .update({ is_active: false })
      .eq("id", matchId);

    return { message: "Unmatched successfully" };
  }

  async _fetchDiscoverProfiles({ excludedIds, limit, offset, gender, lookingFor }) {
    let query = supabase
      .from("profiles")
      .select(`
        user_id, full_name, biography, gender, date_of_birth,
        marital_status, looking_for, location_text, latitude, longitude
      `)
      .not("full_name", "is", null)
      .range(offset, offset + limit - 1);

    if (excludedIds.length > 0) {
      query = query.not("user_id", "in", `(${excludedIds.join(",")})`);
    }

    if (gender) {
      query = query.eq("gender", gender);
    } else if (lookingFor) {
      const genderFilter = this._getGenderFromLookingFor(lookingFor);
      if (genderFilter) {
        query = query.eq("gender", genderFilter);
      }
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }

  async _attachProfileMedia(profiles) {
    if (!profiles || profiles.length === 0) return [];

    const profileIds = profiles.map((p) => p.user_id);
    let photos = [];

    const { data: photoData } = await supabase
      .from("profile_photos")
      .select("user_id, photo_url, photo_order, is_primary")
      .in("user_id", profileIds)
      .order("photo_order");
    photos = photoData || [];

    return profiles.map((profile) => {
      const profilePhotos = photos.filter((p) => p.user_id === profile.user_id);
      const age = profile.date_of_birth
        ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : null;

      return {
        ...profile,
        age,
        photos: profilePhotos,
        primaryPhoto:
          profilePhotos.find((p) => p.is_primary)?.photo_url ||
          profilePhotos[0]?.photo_url ||
          null,
      };
    });
  }

  _getGenderFromLookingFor(lookingFor) {
    switch (lookingFor) {
      case "males_for_females":
      case "females_for_females":
        return "female";
      case "females_for_males":
      case "males_for_males":
        return "male";
      default:
        return null;
    }
  }

  _calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async _hasActiveSubscription(userId) {
    const { data } = await supabase
      .from("user_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .gte("end_date", new Date().toISOString())
      .limit(1)
      .single();

    return !!data;
  }
}

module.exports = new MatchService();
