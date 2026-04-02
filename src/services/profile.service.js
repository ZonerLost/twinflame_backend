const { supabase } = require("../config/supabase");

class ProfileService {
  // ---- PERSONAL INFO (Step 1) ----
  async updatePersonalInfo(userId, { fullName, biography }) {
    // Check for banned words in biography
    if (biography) {
      const { data: bannedWords } = await supabase
        .from("banned_words")
        .select("word");
      const words = (bannedWords || []).map((w) => w.word.toLowerCase());
      const textLower = biography.toLowerCase();
      const flagged = words.filter((w) => textLower.includes(w));
      if (flagged.length > 0) {
        throw Object.assign(
          new Error("This text contains inappropriate language."),
          { statusCode: 400 }
        );
      }
    }

    const updates = { full_name: fullName, biography, profile_step: Math.max(1) };
    if (biography) {
      updates.bio_moderation_status = "pending_review";
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

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

  async addPhoto(userId, { photoUrl, photoOrder, isPrimary = false }) {
    const { count } = await supabase
      .from("profile_photos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    const maxPhotos = parseInt(process.env.MAX_PHOTOS_PER_USER) || 8;
    if (count >= maxPhotos) {
      throw Object.assign(new Error(`Maximum ${maxPhotos} photos allowed`), { statusCode: 400 });
    }

    const shouldBePrimary = isPrimary || (count || 0) === 0;

    if (shouldBePrimary) {
      await supabase
        .from("profile_photos")
        .update({ is_primary: false })
        .eq("user_id", userId);
    }

    const { data, error } = await supabase
      .from("profile_photos")
      .insert({
        user_id: userId,
        photo_url: photoUrl,
        photo_order: photoOrder,
        is_primary: shouldBePrimary,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async deletePhoto(userId, photoId) {
    const { data: targetPhoto, error: targetError } = await supabase
      .from("profile_photos")
      .select("id, is_primary")
      .eq("id", photoId)
      .eq("user_id", userId)
      .single();

    if (targetError) throw new Error(targetError.message);

    const { error } = await supabase
      .from("profile_photos")
      .delete()
      .eq("id", photoId)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);

    if (targetPhoto?.is_primary) {
      const { data: nextPhoto } = await supabase
        .from("profile_photos")
        .select("id")
        .eq("user_id", userId)
        .order("photo_order", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextPhoto?.id) {
        await supabase
          .from("profile_photos")
          .update({ is_primary: true })
          .eq("id", nextPhoto.id)
          .eq("user_id", userId);
      }
    }

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

  async updateLifestyle(userId, { choices }) {
    await supabase.from("lifestyle_choices").delete().eq("user_id", userId);

    if (choices && choices.length > 0) {
      const rows = choices.map((choice) => ({ user_id: userId, choice }));
      const { error } = await supabase.from("lifestyle_choices").insert(rows);
      if (error) throw new Error(error.message);
    }

    return { choices };
  }

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

  async completeProfile(userId) {
    await supabase
      .from("users")
      .update({ is_profile_complete: true })
      .eq("id", userId);

    await supabase.from("notifications").insert({
      user_id: userId,
      title: "Account Created!",
      subtitle: "Your account has been created.",
      type: "general",
    });

    return { message: "Profile completed" };
  }

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

  async getProfile(userId) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) throw new Error(error.message);

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

  async editProfile(userId, { fullName, email, phone, biography }) {
    const profileUpdate = {};
    if (fullName !== undefined) profileUpdate.full_name = fullName;
    if (biography !== undefined) profileUpdate.biography = biography;

    if (Object.keys(profileUpdate).length > 0) {
      await supabase.from("profiles").update(profileUpdate).eq("user_id", userId);
    }

    const authUpdate = {};
    if (email !== undefined) authUpdate.email = email;
    if (phone !== undefined) authUpdate.phone = phone;

    if (Object.keys(authUpdate).length > 0) {
      const { error } = await supabase.auth.admin.updateUserById(userId, authUpdate);
      if (error) throw new Error(error.message);
    }

    return this.getProfile(userId);
  }

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
