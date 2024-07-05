require("dotenv").config();
const nodemailer = require("nodemailer");
const express = require("express");
const easyinvoice = require("easyinvoice");
const mongoose = require("mongoose");
const cors = require("cors");
const db = require("./db/conn");
const cookieParser = require("cookie-parser");
const app = express();
const port = 3000;
const inventoryModel = require("./Model/myModel");
const userModel = require("./Model/userModel");
const paymentModel = require("./Model/payments");
const bcrypt = require("bcryptjs");
const authenticate = require("./middleware/authenticate");
const clientModel = require("./Model/clientModel");
const Contact = require("./Model/message");
const jwt = require("jsonwebtoken");

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;

const SECRET_KEY = process.env.SECRET_KEY;
const JWT_SECRET = "MYNAMEISMOHAMMADARIFILIVEINBOKARO";

const imageModel = require("./Model/imageModel");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.use(
  cors({
    origin: ["http://localhost:5173", "*"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Server is running!");
});

app.get("/items", async (req, res) => {
  try {
    const items = await inventoryModel.find();
    res.json(items);
  } catch (error) {
    console.error("Error fetching items:", error);
    res.status(500).json("Error fetching items");
  }
});

app.post("/create", async (req, res) => {
  const { itemcode, itemname, mrp, disc, qty, clientId } = req.body;

  if (!itemcode || !itemname || !mrp || !disc || !qty || !clientId) {
    return res.status(400).json("Please fill all input fields");
  }

  const mrpNum = parseFloat(mrp);
  const discNum = parseFloat(disc);
  const qtyNum = parseFloat(qty);

  if (isNaN(mrpNum) || isNaN(discNum) || isNaN(qtyNum)) {
    return res
      .status(400)
      .json("MRP, Discount, and Quantity must be valid numbers");
  }

  const discrs = (mrpNum * discNum * qtyNum) / 100;
  const rate = mrpNum * qtyNum;
  const total = rate - discrs;

  try {
    const newItem = await inventoryModel.create({
      itemcode,
      itemname,
      mrp: mrpNum,
      disc: discNum,
      qty: qtyNum,
      discrs,
      rate,
      total,
      client: clientId,
    });

    console.log("Item created successfully:", newItem);
    res.status(200).json(newItem);
  } catch (error) {
    console.error("Error creating item:", error);
    res.status(500).json({ error: "Error creating item" });
  }
});

app.delete("/items/:id", async (req, res) => {
  const itemId = req.params.id; // Retrieve the item ID from the URL parameters
  const clientId = req.body.clientId; // Retrieve the client ID from the request body

  console.log("Item ID:", itemId);
  console.log("Client ID:", clientId);

  try {
    const item = await inventoryModel.findOne({
      _id: itemId,
      client: clientId,
    });

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    await inventoryModel.findByIdAndDelete(itemId);
    res.status(200).json({ message: "Item deleted successfully" });
  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).json({ message: "Error deleting item", error });
  }
});

app.put("/items/:id", async (req, res) => {
  const itemId = req.params.id;
  const { itemcode, itemname, mrp, disc, qty, clientId } = req.body;

  if (!clientId) {
    return res.status(400).json({ error: "Client ID is required" });
  }

  const discrs = (mrp * disc) / 100;
  const rate = mrp - discrs;
  const total = rate * qty;

  try {
    const updatedItem = await inventoryModel.findOneAndUpdate(
      { _id: itemId, client: clientId },
      { itemcode, itemname, mrp, disc, discrs, rate, qty, total },
      { new: true }
    );

    if (!updatedItem) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json(updatedItem);
  } catch (error) {
    console.error("Error updating item:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/total-sum", async (req, res) => {
  try {
    const result = await inventoryModel.aggregate([
      {
        $group: {
          _id: null,
          totalSum: { $sum: "$total" },
        },
      },
    ]);
    res.send({ totalSum: result[0].totalSum });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Setup nodemailer transporter
const transporter3 = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "mdaman9939@gmail.com",
    pass: "juqn eaxc hkee jeuy",
  },
});

const sendVerificationEmail = async (email, verificationCode) => {
  const mailOptions = {
    from: "mdaman9939@gmail.com",
    to: email,
    subject: "Verify your email address",
    text: `Your verification code is: ${verificationCode}`,
  };

  try {
    await transporter3.sendMail(mailOptions);
    console.log("Verification email sent successfully");
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new Error("Could not send verification email");
  }
};

app.post("/users", async (req, res) => {
  const { firstName, lastName, email, mobile, address, password, dob, gender } =
    req.body;

  if (
    !firstName ||
    !lastName ||
    !email ||
    !mobile ||
    !address ||
    !password ||
    !dob ||
    !gender
  ) {
    return res.status(400).json({ error: "Please fill all the fields" });
  }

  try {
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "User with this email already exists" });
    }

    const verificationCode = Math.random().toString(36).substring(6);

    await sendVerificationEmail(email, verificationCode);

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = new userModel({
      firstName,
      lastName,
      email,
      mobile,
      address,
      password: hashedPassword,
      dob,
      gender,
      verificationCode,
      isVerified: false,
    });

    await newUser.save();

    res.status(201).json({ status: 201, message: "User created successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/verify-email", async (req, res) => {
  const { email, verificationCode } = req.body;

  try {
    const user = await userModel.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.verificationCode !== verificationCode) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    user.isVerified = true;
    await user.save();

    res
      .status(200)
      .json({ status: 200, message: "Email verified successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(email, password);
    const userLogin = await userModel.findOne({ email });

    if (!userLogin) {
      return res.status(401).json({ message: "User not found" });
    }

    const isPasswordMatch = await bcrypt.compare(password, userLogin.password);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: "Password does not match" });
    }

    const token = await userLogin.generateAuthToken();
    console.log("Generated token: ", token);

    res.cookie("jwtoken", token, {
      expires: new Date(Date.now() + 25892000000),
      httpOnly: true,
      secure: true,
    });

    const result = {
      user: userLogin,
      token,
    };
    console.log("Login successful");

    return res.status(200).json({ status: 200, result });
  } catch (error) {
    console.error("Error during login: ", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/profile", authenticate, (req, res) => {
  console.log("hello profile");
  res.status(200).json(req.rootUser);
});

app.get("/logout", (req, res) => {
  res.clearCookie("jwtoken", { path: "/" });
  res.status(200).json({ status: "200", message: "logout successfully" });
});

// POST create a new payment
app.post("/addPayments", async (req, res) => {
  const { invoiceNumber, amount, status, date, clientId } = req.body;

  try {
    const newPayment = new paymentModel({
      invoiceNumber,
      amount,
      status,
      date,
      client: clientId, // Assuming clientId is passed from the client
    });

    const savedPayment = await newPayment.save();
    res.status(201).json(savedPayment);
  } catch (error) {
    console.error("Error creating payment:", error);
    res.status(500).json({ message: "Error creating payment", error });
  }
});

app.get("/allPayments", async (req, res) => {
  try {
    const payments = await paymentModel.find();
    res.json(payments);
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ message: "Error fetching payments", error });
  }
});

// GET payments by client ID
app.get("/payments/:clientId", async (req, res) => {
  const clientId = req.params.clientId;

  try {
    const payments = await paymentModel.find({ client: clientId });
    res.json(payments);
  } catch (error) {
    console.error("Error fetching payments for client:", error);
    res
      .status(500)
      .json({ message: "Error fetching payments for client", error });
  }
});

app.put("/payments/:id", async (req, res) => {
  try {
    const payment = await paymentModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!payment) {
      res.status(404).json({ error: "Payment not found" });
    } else {
      res.json(payment);
    }
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// DELETE a payment
app.delete("/payments/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const deletedPayment = await paymentModel.findByIdAndDelete(id);

    if (!deletedPayment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    res.json({ message: "Payment deleted successfully" });
  } catch (error) {
    console.error("Error deleting payment:", error);
    res.status(500).json({ message: "Error deleting payment", error });
  }
});

// clients Routes
app.get("/clients", async (req, res) => {
  try {
    const clients = await clientModel.find();
    res.status(200).json(clients);
  } catch (err) {
    console.error("Error fetching clients:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/clients", async (req, res) => {
  const { name, address, zip, city, country, email } = req.body;
  const newClient = new clientModel({
    name,
    address,
    zip,
    city,
    country,
    email,
  });

  try {
    await newClient.save();
    res.status(201).json(newClient);
  } catch (err) {
    console.error("Error creating client:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/clients/:id", async (req, res) => {
  const { id } = req.params;
  const { name, address, zip, city, country, email } = req.body;

  try {
    const updatedClient = await clientModel.findByIdAndUpdate(
      id,
      { name, address, zip, city, country, email },
      { new: true }
    );
    res.json(updatedClient);
  } catch (err) {
    console.error("Error updating client:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.delete("/clients/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await clientModel.findByIdAndDelete(id);
    res.json({ message: "Client deleted successfully" });
  } catch (err) {
    console.error("Error deleting client:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/payment-summary", async (req, res) => {
  try {
    const summary = await paymentModel.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    res.json(summary[0] || { totalAmount: 0 });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/contacts", async (req, res) => {
  const { name, email, message } = req.body;

  try {
    const contact = new Contact({
      name,
      email,
      message,
    });

    await contact.save();
    res.status(201).json(contact);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/contacts", async (req, res) => {
  try {
    const contacts = await Contact.find();
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // Your email id
    pass: process.env.EMAIL_PASS, // Your password
  },
});

// New route to send email with invoice
app.post("/send-invoice", async (req, res) => {
  const { email, invoiceData } = req.body;

  try {
    const result = await easyinvoice.createInvoice(invoiceData);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Invoice",
      text: "Please find your invoice attached.",
      attachments: [
        {
          filename: "invoice.pdf",
          content: result.pdf,
          encoding: "base64",
        },
      ],
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ error: "Error sending email" });
      } else {
        console.log("Email sent:", info.response);
        res.status(200).json({ message: "Email sent successfully" });
      }
    });
  } catch (error) {
    console.error("Error generating invoice:", error);
    res.status(500).json({ error: "Error generating invoice" });
  }
});

// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Directory where uploaded files will be stored
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // Keep original file name
  },
});

const upload = multer({ storage: storage });

// Endpoint to handle file upload
app.post("/upload", upload.single("profilePicture"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Upload file to Cloudinary
    const result = await cloudinary.uploader.upload(file.path);

    // Create new image document in MongoDB
    const newImage = new imageModel({
      imageName: file.originalname,
      imageUrl: result.secure_url, // Store Cloudinary URL in imageUrl field
    });

    await newImage.save(); // Save image details to MongoDB

    // Optionally, you can delete the local file after uploading to Cloudinary
    fs.unlinkSync(file.path);

    res.status(201).json({ status: "success", image: newImage });
  } catch (error) {
    console.error("Error during file upload:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/images", async (req, res) => {
  try {
    const images = await imageModel.find();
    res.json(images);
  } catch (error) {
    console.error("Error fetching images:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Serve static files from the 'uploads' directory (optional)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.put("/updatePaymentStatus/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const updatedPayment = await paymentModel.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    res.status(200).json(updatedPayment);
  } catch (err) {
    console.error("Error updating payment status:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get items sold yesterday
app.get("/inventory/sold-yesterday", async (req, res) => {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const startOfYesterday = new Date(yesterday.setHours(0, 0, 0, 0));
    const endOfYesterday = new Date(yesterday.setHours(23, 59, 59, 999));

    const itemsSoldYesterday = await inventoryModel
      .find({
        createdAt: {
          $gte: startOfYesterday,
          $lt: endOfYesterday,
        },
      })
      .populate("client");

    res.status(200).json(itemsSoldYesterday);
  } catch (err) {
    console.error("Error fetching items sold yesterday:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Route for fetching weekly sales
app.get("/weekly-sum", async (req, res) => {
  try {
    const today = new Date();
    const oneWeekAgo = new Date(today.setDate(today.getDate() - 7)); // Calculate date one week ago

    const startOfWeek = new Date(oneWeekAgo.setHours(0, 0, 0, 0));
    const endOfWeek = new Date(oneWeekAgo.setHours(23, 59, 59, 999));

    const weeklySales = await inventoryModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfWeek, $lt: endOfWeek },
        },
      },
      {
        $group: {
          _id: null,
          weeklySum: { $sum: "$total" },
        },
      },
    ]);

    if (weeklySales.length > 0) {
      res.status(200).json({ weeklySum: weeklySales[0].weeklySum });
    } else {
      res.status(200).json({ weeklySum: 0 }); // Return 0 if no sales found
    }
  } catch (error) {
    console.error("Error fetching weekly sales:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
