const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["paid", "due"], // Define enum values including "paid"
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client", // Reference to the Client model
      required: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
