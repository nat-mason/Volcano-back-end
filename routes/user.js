var express = require("express");
var router = express.Router();
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;
const authorization = require("../middleware/authorization");
const bcrypt = require("bcrypt");
const { json } = require("stream/consumers");

const expires_in = 60 * 60 * 24;
const exp = Math.floor(Date.now() / 1000) + expires_in;

/* GET users listing. */
router.get("/", function (req, res, next) {
  res.send("respond with a resource");
});
/* Authentication */
// user registration
router.post("/register", (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  if (!email || !password) {
    res.status(400).json({
      error: true,
      message: `Request body incomplete, both email and password are required`,
    });
  } else {
    const queryUsers = req.db
      .from("users")
      .select("*")
      .where("email", "=", email);
    queryUsers.then((users) => {
      if (users.length > 0) {
        res.status(409).json({ error: true, message: "User already exists" });
      } else {
        // Insert user into DB
        const saltRounds = 10;
        const hash = bcrypt.hashSync(password, saltRounds);
        return req.db
          .from("users")
          .insert({ email, hash })
          .then(() => {
            res.status(201).json({ message: "User created" });
          })
          .catch((error) => {});
      }
    });
  }
});
router.post("/login", function (req, res, next) {
  const email = req.body.email;
  const password = req.body.password;
  if (!email || !password) {
    res.status(400).json({
      error: true,
      message: `Request body incomplete, both email and password are required`,
    });
  } else {
    const queryUsers = req.db
      .from("users")
      .select("*")
      .where("email", "=", email);

    queryUsers
      .then((users) => {
        if (users.length === 0) {
          res.status(401).json({ message: "User does not exist" });
        } else {
          // Compare password hashes
          const user = users[0];
          return bcrypt.compare(password, user.hash).then((match) => {
            if (!match) {
              res
                .status(401)
                .json({ error: true, message: "Passwords do not match" });
            } else {
              const expires_in = 60 * 60 * 24;
              const exp = Math.floor(Date.now() / 1000) + expires_in;
              const payload = { email, exp };
              const token = jwt.sign(payload, process.env.JWT_SECRET);
              res.status(200).json({
                token,
                token_type: "Bearer",
                expires_in,
              });
            }
          });
        }
      })
      .catch((error) => {
        res.status(500).json({ message: error.message });
      });
  }
});

/* Profile requests */
// User profile
router.get("/:email/profile", authorization, function (req, res, next) {
  const email = req.params.email;

  // Check if the request is unauthorized
  if (!req.isAuthorized) {
    req.db
      .from("users")
      .where("email", "=", email)
      .select("email", "firstName", "lastName")
      .then((rows) => {
        if (rows.length === 0) {
          res.status(404).json({
            error: true,
            message: "User not found",
          });
        } else {
          res.status(200).json(rows[0]);
        }
      })
      .catch((err) => {
        console.log(err);
        res.json({ Error: true, Message: "Error in MySQL query" });
      });
  } else {
    // Check if the authenticated email matches the request email
    const token = req.headers.authorization.replace(/^Bearer /, "");
    try {
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
      if (decodedToken.email !== email) {
        // If the authenticated email doesn't match the request email, proceed with basic profile retrieval
        req.db
          .from("users")
          .where("email", "=", email)
          .select("email", "firstName", "lastName")
          .then((rows) => {
            if (rows.length === 0) {
              res.status(404).json({
                error: true,
                message: "User not found",
              });
            } else {
              res.status(200).json(rows[0]);
            }
          })
          .catch((err) => {
            console.log(err);
            res.json({ Error: true, Message: "Error in MySQL query" });
          });
      } else {
        // If the authenticated email matches the request email, proceed with full profile retrieval
        req.db
          .from("users")
          .where("email", "=", email)
          .select("email", "firstName", "lastName", "dob", "address")
          .then((rows) => {
            if (rows.length === 0) {
              res.status(404).json({
                error: true,
                message: "User not found",
              });
            } else {
              res.status(200).json(rows[0]);
            }
          })
          .catch((err) => {
            console.log(err);
            res.json({ Error: true, Message: "Error in MySQL query" });
          });
      }
    } catch (error) {
      return res.status(401).json({
        error: true,
        message: "Invalid JWT token",
      });
    }
  }
});

router.put("/:email/profile", authorization, function (req, res, next) {
  const email = req.params.email;
  const firstName = req.body.firstName;
  const lastName = req.body.lastName;
  const dob = req.body.dob;
  const address = req.body.address;
  let token;
  if (req.headers.authorization) {
    token = req.headers.authorization.replace(/^Bearer /, "");
  } else {
    return res.status(401).json({
      error: true,
      message: "Unauthorized",
    });
  }
  if (req.params.email !== jwt.verify(token, process.env.JWT_SECRET).email) {
    return res.status(403).json({
      error: true,
      message: "Forbidden",
    });
  }

  if (!firstName || !lastName || !dob || !address) {
    return res.status(400).json({
      error: true,
      message:
        "Request body incomplete: firstName, lastName, dob and address are required.",
    });
  }

  // check for correct data
  if (
    typeof firstName !== "string" ||
    typeof lastName !== "string" ||
    typeof address !== "string"
  ) {
    return res.status(400).json({
      error: true,
      message:
        "Request body invalid: firstName, lastName and address must be strings only.",
    });
  }

  const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dobRegex.test(dob)) {
    return res.status(400).json({
      error: true,
      message: "Invalid input: dob must be a real date in format YYYY-MM-DD.",
    });
  }
  if (dob) {
    const dobDate = new Date(dob);
    const currentDate = new Date();
    if (dobDate.getTime() > currentDate.getTime()) {
      return res.status(400).json({
        error: true,
        message: "Invalid input: dob must be a date in the past.",
      });
    }
    if (
      isNaN(dobDate.getTime()) ||
      dobDate.getDate() !== parseInt(dob.split("-")[2])
    ) {
      // Invalid date format or non-existent date
      return res.status(400).json({
        error: true,
        message: "Invalid input: dob must be a real date in format YYYY-MM-DD.",
      });
    }
  }

  const filter = {
    email: req.params.email,
  };

  req.db
    .from("users")
    .where(filter)
    .update({
      firstName: firstName,
      lastName: lastName,
      dob: dob,
      address: address,
    })
    .then((updatedRows) => {
      return req.db
        .from("users")
        .where(filter)
        .select("firstName", "lastName", "dob", "address");
    })
    .then((updatedRows) => {
      const dateString = dob;
      const dateOnlyString = dateString.substring(0, 10);
      res
        .status(200)
        .json({ email, firstName, lastName, dob: dateOnlyString, address });
    })
    .catch((error) => {
      console.log(error);
      res.status(500).json({ Error: true, Message: "Error in MySQL query" });
    });
});

// let a user post a review for a certain volcano id
router.post("/:email/review", authorization, function (req, res, next) {
  const token = req.headers.authorization.replace(/^Bearer /, "");
  const userEmail = req.params.email;
  const comment = req.body.comment;
  const rating = req.body.rating;
  const volcanoID = req.body.ID;

  if (req.params.email !== jwt.verify(token, process.env.JWT_SECRET).email) {
    return res.status(403).json({
      error: true,
      message: "Forbidden",
    });
  }

  if (!comment || !rating || !volcanoID) {
    return res.status(400).json({
      error: true,
      message:
        "Request body incomplete: Comment, rating and volcano ID required",
    });
  }

  if (rating < 1 || rating > 5) {
    return res.status(422).json({
      error: true,
      message: "Invalid rating: please select a number between 1-5",
    });
  }

  const queryComments = req.db
    .from("comments")
    .select("*")
    .where("userEmail", "=", userEmail)
    .andWhere("volcanoID", "=", volcanoID);

  queryComments.then((comments) => {
    if (comments.length > 0) {
      res.status(401).json({
        error: true,
        message: "User has already commented on this volcano",
      });
    } else {
      req.db
        .from("comments")
        .where("userEmail", "=", userEmail)
        .insert({
          commentscol: comment,
          rating: rating,
          userEmail: req.params.email,
          volcanoID: volcanoID,
        })
        .then((updatedRecord) => {
          res.status(201).json({ comment, rating, volcanoID });
        })
        .catch((error) => {
          console.error(error);
          res
            .status(500)
            .json({ Error: true, Message: "Error in MySQL query" });
        });
    }
  });
});
module.exports = router;
