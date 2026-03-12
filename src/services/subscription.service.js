const { supabase } = require("../config/supabase");
const stripe = require("../config/stripe");

class SubscriptionService {
  // ---- GET PLANS ----
  async getPlans() {
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("price", { ascending: true });

    if (error) throw new Error(error.message);
    return data;
  }

  // ---- GET CURRENT SUBSCRIPTION ----
  async getCurrentSubscription(userId) {
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("user_id", userId)
      .eq("status", "active")
      .gte("end_date", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") throw new Error(error.message);
    return data;
  }

  // ---- SUBSCRIBE (with Stripe) ----
  async subscribe(userId, { planId }) {
    // Get plan details
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (!plan) {
      throw Object.assign(new Error("Plan not found"), { statusCode: 404 });
    }

    // Free plan - no payment needed
    if (plan.price === 0) {
      return this._createFreeSubscription(userId, plan);
    }

    // Get user email from Supabase Auth for Stripe
    const { data: authData } = await supabase.auth.admin.getUserById(userId);
    const user = authData?.user;

    // Create or get Stripe customer
    let stripeCustomerId;
    const { data: existingSub } = await supabase
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .not("stripe_customer_id", "is", null)
      .limit(1)
      .single();

    if (existingSub?.stripe_customer_id) {
      stripeCustomerId = existingSub.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId },
      });
      stripeCustomerId = customer.id;
    }

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(plan.price * 100), // Stripe uses cents
      currency: "usd",
      customer: stripeCustomerId,
      metadata: {
        userId,
        planId: plan.id,
        planName: plan.name,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      stripeCustomerId,
      plan,
    };
  }

  // ---- CONFIRM SUBSCRIPTION (after payment) ----
  async confirmSubscription(userId, { paymentIntentId, planId }) {
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (!plan) {
      throw Object.assign(new Error("Plan not found"), { statusCode: 404 });
    }

    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      throw Object.assign(new Error("Payment not completed"), { statusCode: 400 });
    }

    // Deactivate any existing active subscriptions
    await supabase
      .from("user_subscriptions")
      .update({ status: "cancelled" })
      .eq("user_id", userId)
      .eq("status", "active");

    // Create subscription
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration_days);

    const { data: subscription, error } = await supabase
      .from("user_subscriptions")
      .insert({
        user_id: userId,
        plan_id: planId,
        stripe_subscription_id: paymentIntentId,
        stripe_customer_id: paymentIntent.customer,
        status: "active",
        end_date: endDate.toISOString(),
      })
      .select("*, plan:subscription_plans(*)")
      .single();

    if (error) throw new Error(error.message);

    // Create notification
    await supabase.from("notifications").insert({
      user_id: userId,
      title: "Subscription Activated",
      subtitle: `Your ${plan.name} plan is now active!`,
      type: "subscription",
    });

    return subscription;
  }

  // ---- CANCEL SUBSCRIPTION ----
  async cancelSubscription(userId) {
    const { data: sub } = await supabase
      .from("user_subscriptions")
      .select("id, stripe_subscription_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (!sub) {
      throw Object.assign(new Error("No active subscription found"), { statusCode: 404 });
    }

    await supabase
      .from("user_subscriptions")
      .update({ status: "cancelled" })
      .eq("id", sub.id);

    return { message: "Subscription cancelled" };
  }

  // ---- FREE SUBSCRIPTION ----
  async _createFreeSubscription(userId, plan) {
    // Deactivate existing
    await supabase
      .from("user_subscriptions")
      .update({ status: "cancelled" })
      .eq("user_id", userId)
      .eq("status", "active");

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration_days);

    const { data, error } = await supabase
      .from("user_subscriptions")
      .insert({
        user_id: userId,
        plan_id: plan.id,
        status: "active",
        end_date: endDate.toISOString(),
      })
      .select("*, plan:subscription_plans(*)")
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}

module.exports = new SubscriptionService();
