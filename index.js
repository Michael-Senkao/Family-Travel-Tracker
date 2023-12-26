import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dtenv from "dotenv";

const app = express();
const port = process.env.port || 3000;
dtenv.config();

//Database connection setup
const db = new pg.Client({
  user: process.env.user,
  host: process.env.host,
  database: process.env.database,
  password: process.env.password,
  port: 5432,
});
db.connect();

//Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId;
let currentUser;
let users;

//Check countries visited by current user
async function checkVisisted(currentUserId) {
  try {
    const result = await db.query(
      "SELECT c.country_code AS code FROM visited_countries v JOIN countries c ON v.country_id = c.id AND v.user_id = $1",
      [currentUserId]
    );

    let countries = [];
    result.rows.forEach((country) => {
      countries.push(country.code);
    });
    return countries;
  } catch (err) {
    console.log(err);
  }
}

async function getCurrentUser() {
  return users.find((user) => user.id == currentUserId);
}

//Get users
app.get("/", async (req, res) => {
  try {
    users = users || (await db.query("SELECT * FROM users")).rows;
    currentUser = (await getCurrentUser()) || users[0];
    try {
      const countries = await checkVisisted(currentUser.id);
      res.render("index.ejs", {
        countries: countries,
        total: countries.length,
        users: users,
        color: currentUser.color,
      });
    } catch (err) {
      console.log(err);
    }
  } catch (err) {
    console.log(err);
  }
});

//Add a new country visited by current user
app.post("/add", async (req, res) => {
  const input = req.body.country.trim();
  if (input.length > 0) {
    try {
      const result = await db.query(
        "SELECT id FROM countries WHERE LOWER(country_name) LIKE $1 || '%';",
        [input.toLowerCase()]
      );

      if (result.rowCount > 0) {
        const data = result.rows[0];
        const countryId = data.id;
        try {
          const result2 = await db.query(
            "INSERT INTO visited_countries VALUES ($1, $2)",
            [currentUserId, countryId]
          );

          res.redirect("/");
        } catch (err) {
          console.log(err);
        }
      } else {
        try {
          const countries = await checkVisisted(currentUserId);
          res.render("index.ejs", {
            countries: countries,
            total: countries.length,
            users: users,
            color: currentUser.color,
            error: "Country name not found. Try again.",
          });
        } catch (err) {
          console.log(err);
        }
      }
    } catch (err) {
      console.log(err);
    }
  } else {
    try {
      const countries = await checkVisisted(currentUserId);
      res.render("index.ejs", {
        countries: countries,
        total: countries.length,
        users: users,
        color: currentUser.color,
        error: "Please enter a country name.",
      });
    } catch (err) {
      console.log(err);
    }
  }
});

//Switch to a new user or tab to add a new family member
app.post("/user", async (req, res) => {
  if (req.body.add) {
    res.render("new.ejs");
  } else {
    currentUserId = parseInt(req.body.user) || currentUserId;
    try {
      currentUser = await getCurrentUser();
      res.redirect("/");
    } catch (err) {
      console.log(err);
    }
  }
});

//Add a new family member infromation to database
app.post("/new", async (req, res) => {
  const color = req.body.color || "yellow";
  const name = req.body.name;
  try {
    const result = await db.query(
      "INSERT INTO users(name, color) values ($1, $2) RETURNING *",
      [name, color]
    );
    users.push(result.rows[0]);
    currentUser = result.rows[0];
    currentUserId = currentUser.id;
    res.redirect("/");
  } catch (err) {
    console.log(err);
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
