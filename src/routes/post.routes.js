const express = require("express");
const Joi = require("joi");
const multer = require("multer");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const postController = require("../controllers/post.controller");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Validation schemas
const createPostSchema = Joi.object({
  content: Joi.string().max(2000).allow("", null),
  imageUrl: Joi.string().uri().allow("", null),
}).or("content", "imageUrl"); // At least one of content or imageUrl required

const commentSchema = Joi.object({
  content: Joi.string().min(1).max(1000).required(),
  parentId: Joi.string().uuid().allow(null),
});

// All routes require authentication
router.use(authenticate);

// Feed
router.get("/feed", postController.getFeed);

// CRUD
router.post("/", validate(createPostSchema), postController.createPost);
router.get("/:postId", postController.getPost);
router.delete("/:postId", postController.deletePost);

// User posts
router.get("/user/:userId", postController.getUserPosts);

// Likes
router.post("/:postId/like", postController.toggleLike);

// Comments
router.get("/:postId/comments", postController.getComments);
router.post(
  "/:postId/comments",
  validate(commentSchema),
  postController.addComment
);
router.delete("/comments/:commentId", postController.deleteComment);

// Image upload
router.post("/upload-image", upload.single("image"), postController.uploadImage);

module.exports = router;
