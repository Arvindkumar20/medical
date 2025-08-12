// controllers/paymentController.js
import razorpay from '../config/razorpay.js';

const paymentController = {
  /**
   * @desc    Create Razorpay Order
   * @route   POST /api/v1/payments/create-order
   * @access  Private
   */
  createRazorpayOrder: async (req, res) => {
    const { amount, currency = "INR", receipt } = req.body;

    try {
      const options = {
        amount: amount * 100, // Razorpay expects amount in paise
        currency,
        receipt: receipt || `receipt_${Date.now()}`,
        payment_capture: 1 // Auto-capture payment
      };

      const order = await razorpay.orders.create(options);

      res.status(200).json({
        success: true,
        data: {
          orderId: order.id,
          amount: order.amount,
          currency: order.currency
        }
      });
    } catch (error) {
      console.error("Razorpay Order Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create Razorpay order",
        error: error.error?.description || error.message
      });
    }
  },

  /**
   * @desc    Verify Razorpay Payment & Save to DB
   * @route   POST /api/v1/payments/verify
   * @access  Private
   */
  verifyRazorpayPayment: async (req, res) => {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    try {
      // 1. Verify Signature
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({
          success: false,
          message: "Payment verification failed: Invalid signature"
        });
      }

      // 2. Fetch Payment Details from Razorpay
      const payment = await razorpay.payments.fetch(razorpay_payment_id);

      // 3. Save to Database (using our Payment model)
      const dbPayment = await Payment.create({
        paymentId: `rzp_${razorpay_payment_id}`,
        order: req.body.orderId, // Link to your order
        payer: req.user.id,
        amount: payment.amount / 100, // Convert back to rupees
        currency: payment.currency,
        method: payment.method,
        status: "captured",
        transactionId: razorpay_payment_id,
        gateway: {
          name: "razorpay",
          gatewayStatus: payment.status,
          rawResponse: payment
        }
      });

      // 4. Update Order Status (example)
      await Order.findByIdAndUpdate(req.body.orderId, {
        paymentStatus: "paid",
        payment: dbPayment._id
      });

      res.status(200).json({
        success: true,
        message: "Payment verified and saved",
        data: dbPayment
      });

    } catch (error) {
      console.error("Payment Verification Error:", error);
      res.status(500).json({
        success: false,
        message: "Payment verification failed",
        error: error.message
      });
    }
  },

  /**
   * @desc    Razorpay Webhook Handler
   * @route   POST /api/v1/payments/webhook/razorpay
   * @access  Public (Razorpay calls this)
   */
  handleRazorpayWebhook: async (req, res) => {
    const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    try {
      // 1. Verify Webhook Signature
      const shasum = crypto.createHmac('sha256', WEBHOOK_SECRET);
      shasum.update(JSON.stringify(req.body));
      const digest = shasum.digest('hex');

      if (digest !== signature) {
        return res.status(401).json({ success: false, message: "Invalid signature" });
      }

      // 2. Process Events
      const event = req.body;
      console.log("Razorpay Webhook Event:", event.event);

      switch (event.event) {
        case 'payment.captured':
          await handleSuccessfulPayment(event.payload.payment.entity);
          break;
        
        case 'payment.failed':
          await handleFailedPayment(event.payload.payment.entity);
          break;
        
        case 'refund.processed':
          await handleRefund(event.payload.refund.entity);
          break;
        
        default:
          console.log("Unhandled event type:", event.event);
      }

      res.status(200).json({ success: true, message: "Webhook processed" });

    } catch (error) {
      console.error("Webhook Error:", error);
      res.status(500).json({ success: false, message: "Webhook processing failed" });
    }
  }
};

// Helper Functions for Webhook
async function handleSuccessfulPayment(payment) {
  // Update your database
  await Payment.findOneAndUpdate(
    { transactionId: payment.id },
    {
      status: "captured",
      "gateway.gatewayStatus": payment.status,
      "gateway.rawResponse": payment
    }
  );
}

async function handleFailedPayment(payment) {
  await Payment.findOneAndUpdate(
    { transactionId: payment.id },
    {
      status: "failed",
      "gateway.gatewayStatus": payment.status,
      "gateway.rawResponse": payment
    }
  );
}

async function handleRefund(refund) {
  await Payment.findOneAndUpdate(
    { transactionId: refund.payment_id },
    {
      $push: {
        refunds: {
          amount: refund.amount / 100,
          reason: refund.notes?.reason || "Customer request",
          status: "completed",
          transactionId: refund.id,
          refundedAt: new Date(refund.created_at * 1000)
        }
      },
      status: refund.amount === refund.payment.entity.amount ? "refunded" : "partially_refunded"
    }
  );
}

export default paymentController;