const mongoose = require("mongoose");
const Client = require("./clientModel"); // Assuming clientModel.js exports the Client model

const inventorySchema = new mongoose.Schema(
  {
    itemcode: {
      type: String,
      required: true,
    },
    itemname: {
      type: String,
      required: true,
    },
    mrp: {
      type: String,
      required: true,
    },
    disc: {
      type: String,
      required: true,
    },
    discrs: {
      type: String,
      required: true,
    },
    rate: {
      type: String,
      required: true,
    },
    qty: {
      type: String,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client", // Referencing the Client model
      required: true,
    },
  },
  { timestamps: true }
);

const Inventory = mongoose.model("Inventory", inventorySchema);

module.exports = Inventory;
