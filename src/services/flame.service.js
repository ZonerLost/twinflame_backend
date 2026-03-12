const { supabase } = require("../config/supabase");
const stripe = require("../config/stripe");

class FlameService {
  async getFlames(userId) {
    const { data, error } = await supabase
      .from("flames").select("*").eq("user_id", userId).single();
    if (error && error.code === "PGRST116") {
      const { data: newFlame, error: insertErr } = await supabase
        .from("flames").insert({ user_id: userId, remaining_flames: 0 }).select().single();
      if (insertErr) throw new Error(insertErr.message);
      return newFlame;
    }
    if (error) throw new Error(error.message);
    return data;
  }

  async grantDailyFlames(userId) {
    const flame = await this.getFlames(userId);
    if (flame.last_daily_grant) {
      const lastGrant = new Date(flame.last_daily_grant);
      const today = new Date();
      if (lastGrant.toDateString() === today.toDateString()) {
        return { granted: false, message: "Daily flames already granted", remaining: flame.remaining_flames };
      }
    }
    const { data: sub } = await supabase
      .from("user_subscriptions").select("*, plan:subscription_plans(*)").eq("user_id", userId)
      .eq("status", "active").gte("end_date", new Date().toISOString())
      .order("created_at", { ascending: false }).limit(1).single();
    const dailyFlames = sub?.plan?.daily_flames || 0;
    if (dailyFlames === 0) {
      return { granted: false, message: "No flames available on your plan", remaining: flame.remaining_flames };
    }
    const { data: updated, error } = await supabase
      .from("flames").update({ remaining_flames: flame.remaining_flames + dailyFlames, last_daily_grant: new Date().toISOString() })
      .eq("user_id", userId).select().single();
    if (error) throw new Error(error.message);
    return { granted: true, flamesGranted: dailyFlames, remaining: updated.remaining_flames };
  }

  async useFlame(userId) {
    const flame = await this.getFlames(userId);
    if (flame.remaining_flames <= 0) {
      throw Object.assign(new Error("No flames remaining. Purchase more or wait for your daily allotment."), { statusCode: 400 });
    }
    const { data, error } = await supabase
      .from("flames").update({ remaining_flames: flame.remaining_flames - 1 }).eq("user_id", userId).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async purchaseFlames(userId, { packageName }) {
    const packages = { "3_flames": { count: 3, price: 5.00 }, "10_flames": { count: 10, price: 12.00 }, "25_flames": { count: 25, price: 25.00 } };
    const pkg = packages[packageName];
    if (!pkg) throw Object.assign(new Error("Invalid flame package"), { statusCode: 400 });
    const { data: user } = await supabase.from("users").select("account_status").eq("id", userId).single();
    if (user?.account_status === "banned") throw Object.assign(new Error("Banned users cannot purchase flames"), { statusCode: 403 });
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(pkg.price * 100), currency: "usd", metadata: { userId, packageName, flameCount: pkg.count },
    });
    return { clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id, package: packageName, flameCount: pkg.count, price: pkg.price };
  }

  async confirmPurchase(userId, { paymentIntentId, packageName }) {
    const packages = { "3_flames": { count: 3, price: 5.00 }, "10_flames": { count: 10, price: 12.00 }, "25_flames": { count: 25, price: 25.00 } };
    const pkg = packages[packageName];
    if (!pkg) throw Object.assign(new Error("Invalid flame package"), { statusCode: 400 });
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== "succeeded") throw Object.assign(new Error("Payment not completed"), { statusCode: 400 });
    await supabase.from("flame_purchases").insert({ user_id: userId, package_name: packageName, flame_count: pkg.count, price: pkg.price, stripe_payment_id: paymentIntentId });
    const flame = await this.getFlames(userId);
    const { data, error } = await supabase.from("flames").update({ remaining_flames: flame.remaining_flames + pkg.count }).eq("user_id", userId).select().single();
    if (error) throw new Error(error.message);
    return { remaining: data.remaining_flames, purchased: pkg.count };
  }

  async getPackages() {
    return [
      { name: "3_flames", count: 3, price: 5.00, label: "3 Flames" },
      { name: "10_flames", count: 10, price: 12.00, label: "10 Flames" },
      { name: "25_flames", count: 25, price: 25.00, label: "25 Flames" },
    ];
  }
}
module.exports = new FlameService();
