const { supabase } = require("../config/supabase");

class ProfileService {
  // ---- PERSONAL INFO (Step 1) ----
  async updatePersonalInfo(userId, { fullName, biography }) {
    const { data, error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, biography, profile_step: Math.max(1) })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  // ---- GENDER (Step 2) ----
  async updateGender(userId, { gender }) {
    const { data, error } = await supabase
      .from("profiles")
      .update({ gender })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  // ---- MARITAL STATUS (Step 3) ----
  async updateMaritalStatus(userId, { maritalStatus }) {
    const { data, error } = await supabase
      .from("profiles")
      .update({ marital_status: maritalStatus })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  // ---- PHOTOS (Step 4) ----
  async addPhoto(userId, { photoUrl, photoOrder, isPrimary = false }) {
    // Check photo count limit
    const { count } = await supabase
      .from("profile_photos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    const maxPhotos = parseInt(process.env.MAX_PHOTOS_PER_USER) || 8;
    if (count >= maxPhotos) {
      throw Object.assign(new Error(`Maximum ${maxPhotos} photos allowed`), { statusCode: 400 });
    }

    // If setting as primary, unset other primaries first
    if (isPrimary) {
      await supabase
        .from("profile_photos")
        .update({ is_primary: false })
        .eq("user_id", userId);
    }

    const { data, error } = await supabase
      .from("profile_photos")
      .insert({ user_id: userId, photo_url: photoUrl, photo_order: photoOrder, is_primary: isPrimary })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async deletePhoto(userId, photoId) {
    const { error } = await supabase
      .from("profile_photos")
      .delete()
      .eq("id", photoId)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { message: "Photo deleted" };
  }

  async getPhotos(userId) {
    const { data, error } = await supabase
      .from("profile_photos")
      .select("*")
      .eq("user_id", userId)
      .order("photo_order", { ascending: true });

    if (error) throw new Error(error.message);
    return data;
  }

  async uploadPhotoToStorage(userId, file) {
    const fileName = `${userId}/${Date.now()}_${file.originalname}`;
    const { data, error } = await supabase.storage
      .from("profile-photos")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
      });

    if (error) throw new Error(error.message);

    const { data: urlData } = supabase.storage
      .from("profile-photos")
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }

  // ---- LIFESTYLE (Step 5) ----
  async updateLifestyle(userId, { choices }) {
    // Delete existing choices and insert new ones
    await supabase.from("lifestyle_choices").delete().eq("user_id", userId);

    if (choices && choices.length > 0) {
      const rows = choices.map((choice) => ({ user_id: userId, choice }));
      const { error } = await supabase.from("lifestyle_choices").insert(rows);
      if (error) throw new Error(error.message);
    }

    return { choices };
  }

  // ---- LOOKING FOR (Step 6) ----
  async updateLookingFor(userId, { lookingFor }) {
    const { data, error } = await supabase
      .from("profiles")
      .update({ looking_for: lookingFor })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  // ---- LOCATION (Step 7) ----
  async updateLocation(userId, { latitude, longitude, locationText }) {
    const point = `POINT(${longitude} ${latitude})`;

    const { data, error } = await supabase
      .from("profiles")
      .update({
        latitude,
        longitude,
        location_text: locationText,
        location: point,
      })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  // ---- BELIEFS (Steps 8-16) ----
  async updateBeliefs(userId, beliefs) {
    const updateData = {};
    const beliefFields = [
      "earth_controlled", "earth_controlled_tag",
      "religious", "religious_tag",
      "pro_government", "pro_government_tag",
      "aliens", "aliens_tag",
      "reincarnation", "reincarnation_tag",
      "moon_landing", "moon_landing_tag",
      "matrix", "matrix_tag",
      "vaccines", "vaccines_tag",
      "flat_earth", "flat_earth_tag",
    ];

    for (const field of beliefFields) {
      if (beliefs[field] !== undefined) {
        updateData[field] = beliefs[field];
      }
    }

    const { data, error } = await supabase
      .from("beliefs")
      .update(updateData)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  // ---- DATE OF BIRTH (Step 17) ----
  async updateDateOfBirth(userId, { dateOfBirth }) {
    const { data, error } = await supabase
      .from("profiles")
      .update({ date_of_birth: dateOfBirth })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  // ---- COMPLETE PROFILE ----
  async completeProfile(userId) {
    await supabase
      .from("users")
      .update({ is_profile_complete: true })
      .eq("id", userId);

    // Send notification
    await supabase.from("notifications").insert({
      user_id: userId,
      title: "Account Created!",
      subtitle: "Your account has been created.",
      type: "general",
    });

    return { message: "Profile completed" };
  }

  // ---- UPDATE PROFILE STEP ----
  async updateProfileStep(userId, { step }) {
    const { data, error } = await supabase
      .from("profiles")
      .update({ profile_step: step })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  // ---- GET FULL PROFILE ----
  async getProfile(userId) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) throw new Error(error.message);

    // Fetch related data in parallel
    const [photosRes, lifestyleRes, beliefsRes, userRes, authRes] = await Promise.all([
      supabase.from("profile_photos").select("*").eq("user_id", userId).order("photo_order"),
      supabase.from("lifestyle_choices").select("choice").eq("user_id", userId),
      supabase.from("beliefs").select("*").eq("user_id", userId).single(),
      supabase.from("users").select("is_profile_complete, notifications_enabled, face_recognition_enabled").eq("id", userId).single(),
      supabase.auth.admin.getUserById(userId),
    ]);

    const authUser = authRes.data?.user;

    return {
      ...profile,
      photos: photosRes.data || [],
      lifestyle: (lifestyleRes.data || []).map((r) => r.choice),
      beliefs: beliefsRes.data || {},
      user: {
        ...(userRes.data || {}),
        email: authUser?.email || null,
        phone: authUser?.phone || null,
      },
    };
  }

  // ---- GET PROFILE BY USER ID (for viewing other users) ----
  async getPublicProfile(targetUserId) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("user_id, full_name, biography, gender, date_of_birth, marital_status, looking_for, location_text")
      .eq("user_id", targetUserId)
      .single();

    if (error) throw new Error(error.message);

    const [photosRes, lifestyleRes, beliefsRes] = await Promise.all([
      supabase.from("profile_photos").select("id, photo_url, photo_order, is_primary").eq("user_id", targetUserId).order("photo_order"),
      supabase.from("lifestyle_choices").select("choice").eq("user_id", targetUserId),
      supabase.from("beliefs").select("earth_controlled, religious, pro_government, aliens, reincarnation, moon_landing, matrix, vaccines, flat_earth").eq("user_id", targetUserId).single(),
    ]);

    return {
      ...profile,
      photos: photosRes.data || [],
      lifestyle: (lifestyleRes.data || []).map((r) => r.choice),
      beliefs: beliefsRes.data || {},
    };
  }

  // ---- EDIT PROFILE (from settings) ----
  async editProfile(userId, { fullName, email, phone, biography }) {
    // Update profile fields
    const profileUpdate = {};
    if (fullName !== undefined) profileUpdate.full_name = fullName;
    if (biography !== undefined) profileUpdate.biography = biography;

    if (Object.keys(profileUpdate).length > 0) {
      await supabase.from("profiles").update(profileUpdate).eq("user_id", userId);
    }

    // Update email/phone via Supabase Auth admin API
    const authUpdate = {};
    if (email !== undefined) authUpdate.email = email;
    if (phone !== undefined) authUpdate.phone = phone;

    if (Object.keys(authUpdate).length > 0) {
      const { error } = await supabase.auth.admin.updateUserById(userId, authUpdate);
      if (error) throw new Error(error.message);
    }

    return this.getProfile(userId);
  }

  // ---- UPDATE SETTINGS ----
  async updateSettings(userId, { notificationsEnabled, faceRecognitionEnabled }) {
    const update = {};
    if (notificationsEnabled !== undefined) update.notifications_enabled = notificationsEnabled;
    if (faceRecognitionEnabled !== undefined) update.face_recognition_enabled = faceRecognitionEnabled;

    const { data, error } = await supabase
      .from("users")
      .update(update)
      .eq("id", userId)
      .select("id, notifications_enabled, face_recognition_enabled")
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}

module.exports = new ProfileService();
