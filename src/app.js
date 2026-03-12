const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { apiLimiter } = require("./middleware/rateLimiter");
const { errorHandler } = require("./middleware/errorHandler");

// Route imports
const authRoutes = require("./routes/auth.routes");
const profileRoutes = require("./routes/profile.routes");
const matchRoutes = require("./routes/match.routes");
const chatRoutes = require("./routes/chat.routes");
const subscriptionRoutes = require("./routes/subscription.routes");
const notificationRoutes = require("./routes/notification.routes");
const friendRoutes = require("./routes/friend.routes");
const postRoutes = require("./routes/post.routes");

const app = express();

// Global middleware
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api", apiLimiter);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Twin Flame API is running" });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/match", matchRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/posts", postRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
