import type { Express, Request, Response } from "express";
import { stripe, isStripeConfigured, NEUROTEXT_CREDITS_PACKAGE, hasUnlimitedCredits } from "../lib/stripe-config";
import { storage } from "../storage";

export function registerPaymentRoutes(app: Express) {
  // Create Stripe Checkout Session for $100 NeuroText Credits package
  app.post("/api/payments/checkout", async (req: Request, res: Response) => {
    try {
      if (!isStripeConfigured || !stripe) {
        return res.status(503).json({ message: "Payment system not configured" });
      }

      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Check if user has unlimited credits (JMK)
      if (hasUnlimitedCredits(req.user.username)) {
        return res.status(400).json({ 
          message: "You have unlimited credits and don't need to purchase more" 
        });
      }

      // Get the price ID from environment
      const priceId = process.env.STRIPE_PRICE_ID_100;
      console.log(`[Stripe Checkout] ========================================`);
      console.log(`[Stripe Checkout] STRIPE_PRICE_ID_100 = "${priceId}"`);
      console.log(`[Stripe Checkout] ========================================`);
      if (!priceId) {
        return res.status(503).json({ message: "Stripe price not configured" });
      }

      // Create pending transaction
      const transaction = await storage.createCreditTransaction({
        userId: req.user.id,
        provider: "neurotext",
        amount: NEUROTEXT_CREDITS_PACKAGE.priceInCents,
        credits: NEUROTEXT_CREDITS_PACKAGE.credits,
        transactionType: "purchase",
        status: "pending",
        metadata: { package: "neurotext-100" },
      });

      // Build success/cancel URLs - use deployed domain, not localhost
      const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0];
      const baseUrl = domain ? `https://${domain}` : `https://${req.get('host')}`;
      console.log(`[Stripe Checkout] Success/Cancel URL base: ${baseUrl}`);

      // Create Stripe Checkout Session using the pre-configured Price ID
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${baseUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}?payment=cancelled`,
        client_reference_id: String(req.user.id),
        metadata: {
          userId: String(req.user.id),
          credits: String(NEUROTEXT_CREDITS_PACKAGE.credits),
          transactionId: String(transaction.id),
        },
      });

      // Update transaction with Stripe session ID
      await storage.updateCreditTransactionSessionId(transaction.id, session.id);

      res.json({ sessionId: session.id, url: session.url });
    } catch (error: any) {
      console.error("Checkout error:", error);
      res.status(500).json({ message: "Error creating checkout session", error: error.message });
    }
  });

  // Stripe Webhook Handler
  app.post("/api/payments/webhook", async (req: Request, res: Response) => {
    console.log(`[Webhook] ========================================`);
    console.log(`[Webhook] Received webhook request`);
    
    if (!isStripeConfigured || !stripe) {
      console.log(`[Webhook] ERROR: Payment system not configured`);
      return res.status(503).send("Payment system not configured");
    }

    const sig = req.headers["stripe-signature"];
    console.log(`[Webhook] Signature present: ${!!sig}`);
    
    if (!sig) {
      console.log(`[Webhook] ERROR: No signature`);
      return res.status(400).send("No signature");
    }

    let event: any;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
      console.log(`[Webhook] Event verified successfully`);
      console.log(`[Webhook] Event type: ${event.type}`);
      console.log(`[Webhook] Event ID: ${event.id}`);
    } catch (err: any) {
      console.error(`[Webhook] Signature verification FAILED:`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      
      console.log(`[Webhook] Processing checkout.session.completed`);
      console.log(`[Webhook] Session ID: ${session.id}`);
      console.log(`[Webhook] Payment status: ${session.payment_status}`);
      console.log(`[Webhook] Metadata:`, JSON.stringify(session.metadata));
      
      try {
        const userId = parseInt(session.metadata?.userId || "0");
        const credits = parseInt(session.metadata?.credits || "1000");
        const transactionId = parseInt(session.metadata?.transactionId || "0");

        console.log(`[Webhook] Parsed - userId: ${userId}, credits: ${credits}, transactionId: ${transactionId}`);

        if (!userId) {
          console.log(`[Webhook] ERROR: No userId in metadata`);
          return res.json({ received: true, error: "No userId" });
        }

        // Get current credits or initialize for "neurotext" provider (general credits)
        let userCredits = await storage.getUserCredits(userId, "neurotext");
        console.log(`[Webhook] Current credits:`, userCredits);
        
        if (!userCredits) {
          console.log(`[Webhook] Initializing credits for user ${userId}`);
          userCredits = await storage.initializeUserCredits(userId, "neurotext");
          console.log(`[Webhook] Initialized:`, userCredits);
        }

        const newBalance = userCredits.credits + credits;
        console.log(`[Webhook] Adding ${credits} credits. Old: ${userCredits.credits}, New: ${newBalance}`);

        // Add credits
        await storage.updateUserCredits(
          userId,
          "neurotext",
          newBalance
        );

        // Update transaction status
        if (transactionId) {
          await storage.updateCreditTransactionStatus(
            transactionId,
            "completed",
            session.payment_intent as string
          );
          console.log(`[Webhook] Transaction ${transactionId} marked completed`);
        }

        console.log(`[Webhook] ✅ SUCCESS: ${credits} credits added for user ${userId}`);
      } catch (error: any) {
        console.error(`[Webhook] ERROR processing webhook:`, error.message);
        console.error(`[Webhook] Stack:`, error.stack);
      }
    } else {
      console.log(`[Webhook] Ignoring event type: ${event.type}`);
    }

    console.log(`[Webhook] ========================================`);
    res.json({ received: true });
  });

  // Verify payment and add credits (fallback for when webhook doesn't work)
  app.post("/api/payments/verify-session", async (req: Request, res: Response) => {
    try {
      if (!isStripeConfigured || !stripe) {
        return res.status(503).json({ message: "Payment system not configured" });
      }

      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { sessionId } = req.body;
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID required" });
      }

      console.log(`[Payment Verify] Checking session: ${sessionId}`);

      // Retrieve the session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (session.payment_status !== "paid") {
        return res.status(400).json({ message: "Payment not completed" });
      }

      // Check if this session was already processed
      const existingTransaction = await storage.getCreditTransactionByStripeSession(sessionId);
      if (existingTransaction && existingTransaction.status === "completed") {
        console.log(`[Payment Verify] Session ${sessionId} already processed`);
        return res.json({ success: true, message: "Payment already processed", credits: existingTransaction.credits });
      }

      // Verify the user matches
      const userId = parseInt(session.metadata?.userId || "0");
      if (userId !== req.user.id) {
        return res.status(403).json({ message: "Session does not belong to this user" });
      }

      const credits = parseInt(session.metadata?.credits || "1000");
      
      // Get or initialize user credits
      let userCredits = await storage.getUserCredits(userId, "neurotext");
      if (!userCredits) {
        userCredits = await storage.initializeUserCredits(userId, "neurotext");
      }

      // Add credits
      await storage.updateUserCredits(
        userId,
        "neurotext",
        userCredits.credits + credits
      );

      // Update transaction status if exists
      if (existingTransaction) {
        await storage.updateCreditTransactionStatus(
          existingTransaction.id,
          "completed",
          session.payment_intent as string
        );
      }

      console.log(`✅ [Payment Verify] Credits added: ${credits} for user ${userId}`);
      
      res.json({ success: true, message: "Credits added successfully", credits });
    } catch (error: any) {
      console.error("[Payment Verify] Error:", error);
      res.status(500).json({ message: "Error verifying payment", error: error.message });
    }
  });

  // Get user credit balance
  app.get("/api/credits/balance", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.json({
          credits: 0,
          total: 0,
          unlimited: false,
        });
      }

      // Check for unlimited credits
      if (hasUnlimitedCredits(req.user.username)) {
        return res.json({
          credits: Infinity,
          total: Infinity,
          unlimited: true,
        });
      }

      const credits = await storage.getAllUserCredits(req.user.id);
      
      let total = 0;
      credits.forEach((credit) => {
        total += credit.credits;
      });

      res.json({
        credits: total,
        total: total,
        unlimited: false,
      });
    } catch (error: any) {
      console.error("Error fetching balance:", error);
      res.status(500).json({ message: "Error fetching credit balance" });
    }
  });
}
