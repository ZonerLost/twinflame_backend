const admin = require("firebase-admin");
const pushTokenService = require("./push-token.service");

class PushService {
  constructor() {
    this._initialized = false;
  }

  get isConfigured() {
    return Boolean(
      process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY
    );
  }

  _initialize() {
    if (!this.isConfigured || this._initialized) return;

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });

    this._initialized = true;
  }

  async sendToUser(userId, { title, body, data = {} }) {
    if (!this.isConfigured) {
      return { sent: 0, skipped: "missing_firebase_config" };
    }

    this._initialize();

    const tokenRows = await pushTokenService.getTokensForUser(userId);
    const tokens = tokenRows.map((row) => row.fcm_token).filter(Boolean);

    if (tokens.length === 0) {
      return { sent: 0, skipped: "missing_fcm_tokens" };
    }

    const payloadData = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, value == null ? "" : String(value)])
    );

    const result = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title,
        body: body || "",
      },
      data: payloadData,
      android: {
        priority: "high",
        notification: {
          channelId: "high_importance_channel",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
          },
        },
      },
    });

    const invalidTokens = [];

    result.responses.forEach((response, index) => {
      if (response.success) return;

      const code = response.error?.code || "";
      if (
        code.includes("registration-token-not-registered") ||
        code.includes("invalid-argument")
      ) {
        invalidTokens.push(tokens[index]);
      }
    });

    if (invalidTokens.length > 0) {
      await pushTokenService.deleteTokensByValues(invalidTokens);
    }

    return {
      sent: result.successCount,
      failed: result.failureCount,
    };
  }
}

module.exports = new PushService();
