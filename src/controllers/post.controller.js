const postService = require("../services/post.service");
const { successResponse } = require("../utils/helpers");

async function createPost(req, res, next) {
  try {
    const { content, imageUrl } = req.body;
    const data = await postService.createPost(req.userId, { content, imageUrl });
    return successResponse(res, data, "Post created", 201);
  } catch (err) {
    next(err);
  }
}

async function getFeed(req, res, next) {
  try {
    const { limit, offset } = req.query;
    const data = await postService.getFeed(req.userId, {
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
    });
    return successResponse(res, data, "Feed retrieved");
  } catch (err) {
    next(err);
  }
}

async function getUserPosts(req, res, next) {
  try {
    const { userId } = req.params;
    const { limit, offset } = req.query;
    const data = await postService.getUserPosts(req.userId, userId, {
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
    });
    return successResponse(res, data, "User posts retrieved");
  } catch (err) {
    next(err);
  }
}

async function getPost(req, res, next) {
  try {
    const { postId } = req.params;
    const data = await postService.getPost(req.userId, postId);
    return successResponse(res, data, "Post retrieved");
  } catch (err) {
    next(err);
  }
}

async function deletePost(req, res, next) {
  try {
    const { postId } = req.params;
    const data = await postService.deletePost(req.userId, postId);
    return successResponse(res, data, "Post deleted");
  } catch (err) {
    next(err);
  }
}

async function toggleLike(req, res, next) {
  try {
    const { postId } = req.params;
    const data = await postService.toggleLike(req.userId, postId);
    return successResponse(
      res,
      data,
      data.liked ? "Post liked" : "Post unliked"
    );
  } catch (err) {
    next(err);
  }
}

async function addComment(req, res, next) {
  try {
    const { postId } = req.params;
    const { content, parentId } = req.body;
    const data = await postService.addComment(req.userId, postId, { content, parentId });
    return successResponse(res, data, "Comment added", 201);
  } catch (err) {
    next(err);
  }
}

async function getComments(req, res, next) {
  try {
    const { postId } = req.params;
    const { limit, offset } = req.query;
    const data = await postService.getComments(postId, {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    });
    return successResponse(res, data, "Comments retrieved");
  } catch (err) {
    next(err);
  }
}

async function deleteComment(req, res, next) {
  try {
    const { commentId } = req.params;
    const data = await postService.deleteComment(req.userId, commentId);
    return successResponse(res, data, "Comment deleted");
  } catch (err) {
    next(err);
  }
}

async function uploadImage(req, res, next) {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No image provided" });
    }
    const url = await postService.uploadImage(req.userId, req.file);
    return successResponse(res, { url }, "Image uploaded");
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createPost,
  getFeed,
  getUserPosts,
  getPost,
  deletePost,
  toggleLike,
  addComment,
  getComments,
  deleteComment,
  uploadImage,
};
