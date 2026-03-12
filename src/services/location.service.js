const { supabase } = require("../config/supabase");

class LocationService {
  async getNearbyProfiles(userId, { latitude, longitude, radiusMiles = 1, limit = 20, offset = 0 }) {
    const { data: swipedRows } = await supabase.from("swipes").select("swiped_id").eq("swiper_id", userId);
    const excludeIds = (swipedRows || []).map((r) => r.swiped_id);
    excludeIds.push(userId);

    let query = supabase.from("profiles")
      .select("user_id, full_name, biography, gender, date_of_birth, marital_status, looking_for, location_text, latitude, longitude")
      .not("user_id", "in", `(${excludeIds.join(",")})`)
      .not("full_name", "is", null).not("latitude", "is", null)
      .range(offset, offset + limit - 1);

    const { data: profiles, error } = await query;
    if (error) throw new Error(error.message);

    const filtered = (profiles || []).filter((p) => {
      const dist = this._calculateDistanceMiles(latitude, longitude, p.latitude, p.longitude);
      return dist <= radiusMiles;
    });

    const profileIds = filtered.map((p) => p.user_id);
    let photos = [];
    if (profileIds.length > 0) {
      const { data: photoData } = await supabase.from("profile_photos").select("user_id, photo_url, photo_order, is_primary").in("user_id", profileIds).order("photo_order");
      photos = photoData || [];
    }

    return filtered.map((profile) => {
      const profilePhotos = photos.filter((p) => p.user_id === profile.user_id);
      const age = profile.date_of_birth ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
      return { ...profile, age, distance: this._calculateDistanceMiles(latitude, longitude, profile.latitude, profile.longitude), photos: profilePhotos, primaryPhoto: profilePhotos.find((p) => p.is_primary)?.photo_url || profilePhotos[0]?.photo_url || null };
    });
  }

  async setTravelLocation(userId, { latitude, longitude, cityName }) {
    const { data, error } = await supabase.from("profiles").update({ latitude, longitude, location_text: cityName }).eq("user_id", userId).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async getAddresses(userId) {
    const { data, error } = await supabase.from("user_addresses").select("*").eq("user_id", userId).order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data;
  }

  async addAddress(userId, { label, addressText, latitude, longitude }) {
    const { count } = await supabase.from("user_addresses").select("id", { count: "exact", head: true }).eq("user_id", userId);
    if (count >= 3) throw Object.assign(new Error("Maximum 3 addresses allowed"), { statusCode: 400 });
    const { data, error } = await supabase.from("user_addresses").insert({ user_id: userId, label, address_text: addressText, latitude, longitude }).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateAddress(userId, addressId, { label, addressText, latitude, longitude }) {
    const updates = {};
    if (label) updates.label = label;
    if (addressText) updates.address_text = addressText;
    if (latitude) updates.latitude = latitude;
    if (longitude) updates.longitude = longitude;
    const { data, error } = await supabase.from("user_addresses").update(updates).eq("id", addressId).eq("user_id", userId).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async deleteAddress(userId, addressId) {
    await supabase.from("user_addresses").delete().eq("id", addressId).eq("user_id", userId);
    return { message: "Address deleted" };
  }

  async setActiveAddress(userId, addressId) {
    await supabase.from("user_addresses").update({ is_active: false }).eq("user_id", userId);
    const { data, error } = await supabase.from("user_addresses").update({ is_active: true }).eq("id", addressId).eq("user_id", userId).select().single();
    if (error) throw new Error(error.message);
    await supabase.from("profiles").update({ latitude: data.latitude, longitude: data.longitude, location_text: data.address_text }).eq("user_id", userId);
    return data;
  }

  _calculateDistanceMiles(lat1, lon1, lat2, lon2) {
    const R = 3959;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
module.exports = new LocationService();
