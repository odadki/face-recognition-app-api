// import express from "express";
const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt-nodejs");
const cors = require("cors");
const knex = require("knex");
const fetch = require("node-fetch");
require("dotenv").config();

console.log("PAT:", process.env.CLARIFAI_PAT);
console.log("USER_ID:", process.env.CLARIFAI_USER_ID);
console.log("APP_ID:", process.env.CLARIFAI_APP_ID);

//no user inputted
const db = knex({
  client: "pg",
  connection: {
    host: "127.0.0.1",
    user: "",
    password: "",
    database: "smart-brain",
  },
});

const app = express();

app.use(cors());
app.use(express.json());
// app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send(database.users);
});

//COMMENTED OUT 7-11
// db.select("*")
//   .from("users")
//   .then((data) => {
//     console.log(data);
//   });

app.post("/signin", (req, res) => {
  db.select("email", "hash")
    .from("login")
    .where("email", "=", req.body.email)
    .then((data) => {
      const isValid = bcrypt.compareSync(req.body.password, data[0].hash);

      if (isValid) {
        return db
          .select("*")
          .from("users")
          .where("email", "=", req.body.email)
          .then((user) => {
            res.json(user[0]);
          })
          .catch((err) => res.status(400).json("unable to get user"));
      } else {
        res.status(400).json("wrong credentials");
      }
    })
    .catch((err) => res.status(400).json("wrong credentials"));
});

app.post("/register", (req, res) => {
  const { email, name, password } = req.body;
  const hash = bcrypt.hashSync(password);
  db.transaction((trx) => {
    trx
      .insert({
        hash: hash,
        email: email,
      })
      .into("login")
      .returning("email")
      .then((loginEmail) => {
        return trx("users")
          .returning("*")
          .insert({
            email: loginEmail[0].email,
            name: name,
            joined: new Date(),
          })
          .then((user) => {
            res.json(user[0]);
          });
      })
      .then(trx.commit)
      .catch(trx.rollback);
  }).catch((err) => res.status(400).json("unable to register"));
});

app.get("/profile/:id", (req, res) => {
  const { id } = req.params;
  db.select("*")
    .from("users")
    .where({ id })
    .then((user) => {
      if (user.length) {
        res.json(user[0]);
      } else {
        res.status(400).json("not found");
      }
    })
    .catch((err) => res.status(400).json("error getting user"));
});

app.put("/image", (req, res) => {
  const { id } = req.body;
  db("users")
    .where("id", "=", id)
    .increment("entries", 1)
    .returning("entries")
    .then((entries) => {
      res.json(entries[0].entries);
    })
    .catch((err) => res.status(400).json("unable to get entries"));
});

app.listen(5001, () => {
  console.log("app is running on port 5001");
});

//signin POST = success/fail
//register --> POST = user
//profile/:userID --> GET = user
//image PUT --> user

app.post("/clarifai", (req, res) => {
  const { input } = req.body;

  const raw = JSON.stringify({
    user_app_id: {
      user_id: process.env.CLARIFAI_USER_ID, // store these in environment variables
      app_id: process.env.CLARIFAI_APP_ID,
    },
    inputs: [
      {
        data: {
          image: { url: input },
        },
      },
    ],
  });

  fetch("https://api.clarifai.com/v2/models/face-detection/outputs", {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: "Key " + process.env.CLARIFAI_PAT,
    },
    body: raw,
  })
    .then((response) => response.json())
    .then((data) => res.json(data))
    .catch((err) => res.status(400).json("unable to work with Clarifai API"));
});
