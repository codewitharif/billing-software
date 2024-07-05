const jwt = require("jsonwebtoken");
//const dotenv = require("dotenv");
const userModel = require("../Model/userModel");
//dotenv.config({ path: "../config.env" });

const Authenticate = async (req, res, next) => {
  console.log("authenticating");
  const token = req.cookies.jwtoken;
  try {
    const token = req.cookies.jwtoken;
    console.log(`getting the token from cookies ${token}`);
    const verifyToken = jwt.verify(token, process.env.SECRET_KEY);
    console.log(`verifying the token from cookies ${verifyToken}`);
    const rootUser = await userModel.findOne({
      _id: verifyToken._id,
      "tokens.token": token,
    });

    if (!rootUser) {
      res.status(404).send({ status: 404, message: "User not found" });
    }
    req.token = token;
    req.rootUser = rootUser;
    req.userID = rootUser._id;
    next();
  } catch (error) {
    console.log("i am trying to authenticate, uff catch block entered");
    res
      .status(401)
      .json({ status: 401, message: "unauthorized token provided" });
    //console.log(error);
  }
  next();
};

module.exports = Authenticate;
