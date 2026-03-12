const { supabase } = require("../config/supabase");

class PostService {
  _bucketReady = false;

  // ---- CREATE POST ----
  async createPost(userId, { content, imageUrl }) {
    const { data, error } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        content: content || null,
        image_url: imageUrl || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Return with author info
    const enriched = await this._enrichPosts([data], userId);
    return enriched[0];
  }

  // ---- GET FEED (paginated) ----
  async getFeed(userId, { limit = 20, offset = 0 }) {
    const { data: posts, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    if (!posts || posts.length === 0) return [];

    return this._enrichPosts(posts, userId);
  }

  // ---- GET USER POSTS ----
  async getUserPosts(userId, targetUserId, { limit = 20, offset = 0 }) {
    const { data: posts, error } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    if (!posts || posts.length === 0) return [];

    return this._enrichPosts(posts, userId);
  }

  // ---- GET SINGLE POST ----
  async getPost(userId, postId) {
    const { data: post, error } = await supabase
      .from("posts")
      .select("*")
      .eq("id", postId)
      .single();

    if (error) throw new Error(error.message);
    if (!post) {
      throw Object.assign(new Error("Post not found"), { statusCode: 404 });
    }

    const enriched = await this._enrichPosts([post], userId);
    return enriched[0];
  }

  // ---- DELETE POST ----
  async deletePost(userId, postId) {
    const { data: post } = await supabase
      .from("posts")
      .select("user_id")
      .eq("id", postId)
      .single();

    if (!post) {
      throw Object.assign(new Error("Post not found"), { statusCode: 404 });
    }
    if (post.user_id !== userId) {
      throw Object.assign(new Error("Unauthorized"), { statusCode: 403 });
    }

    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) throw new Error(error.message);

    return { message: "Post deleted" };
  }

  // ---- LIKE / UNLIKE ----
  async toggleLike(userId, postId) {
    // Check if already liked
    const { data: existing } = await supabase
      .from("post_likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .single();

    if (existing) {
      // Unlike
      await supabase.from("post_likes").delete().eq("id", existing.id);
      return { liked: false };
    } else {
      // Like
      const { error } = await supabase
        .from("post_likes")
        .insert({ post_id: postId, user_id: userId });
      if (error) throw new Error(error.message);
      return { liked: true };
    }
  }

  // ---- ADD COMMENT (supports replies via parentId) ----
  async addComment(userId, postId, { content, parentId }) {
    const insertData = {
      post_id: postId,
      user_id: userId,
      content,
    };
    if (parentId) insertData.parent_id = parentId;

    const { data, error } = await supabase
      .from("post_comments")
      .insert(insertData)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Enrich with author info
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("user_id", userId)
      .single();

    const { data: photo } = await supabase
      .from("profile_photos")
      .select("photo_url")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .single();

    return {
      ...data,
      replies: [],
      author: {
        id: userId,
        name: profile?.full_name || "Unknown",
        photo: photo?.photo_url || null,
      },
    };
  }

  // ---- GET COMMENTS (threaded: top-level + nested replies) ----
  async getComments(postId, { limit = 50, offset = 0 }) {
    // Fetch ALL comments for this post (parents + replies)
    const { data: comments, error } = await supabase
      .from("post_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    if (!comments || comments.length === 0) return [];

    // Get author info for all comments
    const userIds = [...new Set(comments.map((c) => c.user_id))];

    const [profilesRes, photosRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds),
      supabase
        .from("profile_photos")
        .select("user_id, photo_url")
        .in("user_id", userIds)
        .eq("is_primary", true),
    ]);

    const profiles = profilesRes.data || [];
    const photos = photosRes.data || [];

    // Enrich all comments with author info
    const enriched = comments.map((comment) => {
      const profile = profiles.find((p) => p.user_id === comment.user_id);
      const photo = photos.find((p) => p.user_id === comment.user_id);

      return {
        ...comment,
        replies: [],
        author: {
          id: comment.user_id,
          name: profile?.full_name || "Unknown",
          photo: photo?.photo_url || null,
        },
      };
    });

    // Build thread: nest replies under their parent
    const commentMap = new Map();
    enriched.forEach((c) => commentMap.set(c.id, c));

    const topLevel = [];
    enriched.forEach((c) => {
      if (c.parent_id && commentMap.has(c.parent_id)) {
        commentMap.get(c.parent_id).replies.push(c);
      } else {
        topLevel.push(c);
      }
    });

    return topLevel;
  }

  // ---- DELETE COMMENT ----
  async deleteComment(userId, commentId) {
    const { data: comment } = await supabase
      .from("post_comments")
      .select("user_id")
      .eq("id", commentId)
      .single();

    if (!comment) {
      throw Object.assign(new Error("Comment not found"), { statusCode: 404 });
    }
    if (comment.user_id !== userId) {
      throw Object.assign(new Error("Unauthorized"), { statusCode: 403 });
    }

    const { error } = await supabase
      .from("post_comments")
      .delete()
      .eq("id", commentId);
    if (error) throw new Error(error.message);

    return { message: "Comment deleted" };
  }

  // ---- UPLOAD POST IMAGE ----
  async uploadImage(userId, file) {
    // Ensure bucket exists
    await this._ensureBucket();

    const fileName = `${userId}/${Date.now()}_${file.originalname}`;

    const { data, error } = await supabase.storage
      .from("post-images")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) throw new Error(error.message);

    const {
      data: { publicUrl },
    } = supabase.storage.from("post-images").getPublicUrl(data.path);

    return publicUrl;
  }

  // ---- HELPER: Create storage bucket if it doesn't exist ----
  async _ensureBucket() {
    if (this._bucketReady) return;
    const { data } = await supabase.storage.getBucket("post-images");
    if (!data) {
      await supabase.storage.createBucket("post-images", {
        public: true,
        fileSizeLimit: 5242880, // 5MB
      });
    }
    this._bucketReady = true;
  }

  // ---- HELPER: Enrich posts with author info + like status ----
  async _enrichPosts(posts, currentUserId) {
    const userIds = [...new Set(posts.map((p) => p.user_id))];
    const postIds = posts.map((p) => p.id);

    // Parallel fetch: profiles, photos, user's likes
    const [profilesRes, photosRes, likesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds),
      supabase
        .from("profile_photos")
        .select("user_id, photo_url")
        .in("user_id", userIds)
        .eq("is_primary", true),
      currentUserId
        ? supabase
            .from("post_likes")
            .select("post_id")
            .eq("user_id", currentUserId)
            .in("post_id", postIds)
        : Promise.resolve({ data: [] }),
    ]);

    const profiles = profilesRes.data || [];
    const photos = photosRes.data || [];
    const likedPostIds = new Set(
      (likesRes.data || []).map((l) => l.post_id)
    );

    return posts.map((post) => {
      const profile = profiles.find((p) => p.user_id === post.user_id);
      const photo = photos.find((p) => p.user_id === post.user_id);

      return {
        id: post.id,
        content: post.content,
        imageUrl: post.image_url,
        likesCount: post.likes_count || 0,
        commentsCount: post.comments_count || 0,
        isLiked: likedPostIds.has(post.id),
        createdAt: post.created_at,
        author: {
          id: post.user_id,
          name: profile?.full_name || "Unknown",
          photo: photo?.photo_url || null,
        },
      };
    });
  }
}

module.exports = new PostService();
