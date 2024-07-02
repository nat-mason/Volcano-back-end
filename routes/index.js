const { count, error } = require("console");
var express = require("express");
var router = express.Router();
const authorization = require("../middleware/authorization");

/* Data requests */
// Get Countries
router.get("/countries", function (req, res, next) {
  if (Object.keys(req.query).length > 0) {
    res.status(400).json({
      error: true,
      message: "Invalid query parameters. Query parameters are not permitted.",
    });
  } else {
    req.db
      .from("data")
      .select("country")
      .distinct()
      .orderBy("country")
      .then((rows) => {
        const countryNames = rows.map((rows) => rows.country);
        res.status(200).json(countryNames);
      })
      .catch(() => {
        res.status(500).json({ Error: true, Message: "Error in MySQL query" });
      });
  }
});

// Get Volcanoes
router.get("/volcanoes", function (req, res, next) {
  const allowedParams = ["populatedWithin", "country"];

  const invalidParams = Object.keys(req.query).filter(
    (param) => !allowedParams.includes(param)
  );
  if (invalidParams.length > 0) {
    return res.status(400).json({ error: true, message: "Bad Request" });
  }
  var popstring = "population_" + req.query.populatedWithin;

  popDistance = req.query.populatedWithin;
  var country = req.query.country;

  if (!country) {
    res
      .status(400)
      .json({ error: true, message: "Country is a required query parameter." });
  } else {
    if (!req.query.populatedWithin) {
      req.db
        .from("data")
        .select("id", "name", "country", "region", "subregion")
        .where("country", "=", country)
        .then((rows) => {
          if (rows.length === 0) {
            res.status(200).json([]);
          } else {
            res.status(200).json(rows);
          }
        })
        .catch(() => {
          res
            .status(500)
            .json({ error: true, message: "Error in MySQL query" });
        });
    } else {
      req.db
        .from("data")
        .select("id", "name", "country", "region", "subregion", popstring)
        .where("country", "=", req.query.country)
        .andWhere(popstring, "!=", 0)
        .then((rows) => {
          if (rows.length === 0) {
            res.status(200).json(rows);
          } else {
            res.status(200).json(rows);
          }
        })
        .catch(() => {
          res.json({ Error: true, Message: "Error in MySQL query" });
        });
    }
  }
});

// Get Volcano based on id
router.get("/volcano/:id", authorization, function (req, res, next) {
  const volcanoID = req.params.id;
  if (isNaN(parseInt(volcanoID))) {
    return res.status(400).json({
      error: true,
      message: "Invalid query parameters. Query parameters are not permitted.",
    });
  }

  const selectFields = req.isAuthorized
    ? "*"
    : [
        "id",
        "name",
        "country",
        "region",
        "subregion",
        "last_eruption",
        "summit",
        "elevation",
        "latitude",
        "longitude",
      ];

  req.db
    .from("data")
    .select(selectFields)
    .where("id", "=", volcanoID)
    .then((rows) => {
      if (rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "Volcano with ID: " + volcanoID + " not found",
        });
      } else {
        return res.status(200).json(rows[0]);
      }
    })
    .catch(() => {
      return res
        .status(500)
        .json({ error: true, message: "Error in MySQL query" });
    });
});

// view reviews of volcanoes
router.get("/volcano/:id/reviews", function (req, res, next) {
  const email = "userEmail as email";
  const comments = "commentscol as comments";
  const rating = "rating";
  const volcanoID = req.params.id;
  if (isNaN(parseInt(volcanoID))) {
    res.status(400)({
      error: true,
      message: "Invalid query parameters. Query parameters are not permitted.",
    });
  } else {
    req.db
      .from("data")
      .where("id", "=", volcanoID)
      .first() // Retrieve the first row
      .then((volcano) => {
        if (!volcano) {
          // Volcano with the provided ID does not exist
          return res.status(404).json({
            error: true,
            message: "Volcano not found.",
          });
        } else {
          req.db
            .from("comments")
            .select(email, comments, rating)
            .where("volcanoID", "=", req.params.id)
            .then((rows) => {
              if (rows.length === 0) {
                // No reviews found for the volcano
                res.status(204).json({ reviews: [], averageRating: 0 });
              } else {
                const totalRating = rows.reduce(
                  (sum, row) => sum + row.rating,
                  0
                );
                const averageRating = totalRating / rows.length;

                res.status(200).json({ reviews: rows, averageRating });
              }
            })
            .catch((err) => {
              console.error(err);
              res
                .status(500)
                .json({ Error: true, Message: "Error in MySQL query" });
            });
        }
      });
  }
});
/* Administration */
router.get("/me", function (req, res, next) {
  res
    .status(200)
    .json({ name: "Nathaniel Mason", student_number: "n11412402" });
});
module.exports = router;
