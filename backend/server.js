const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });
const cors = require("cors");
const app = require("./app");

app.use(cors());

const DB = process.env.DATABASE.replace(
  "<PASSWORD>",
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useFindAndModify: false,
    useCreateIndex: true,
  })
  .then(() => {
    console.log("DB connection successful");
  });

const port = process.env.PORT || 3000;
const server = app.listen(port, () =>
  console.log(`App listening on port ${port}`)
);

process.on("unhandledRejection", (err) => {
  console.log(err.name, err.message);
  console.log("Unhandled rejection. Shutting down");
  server.close(() => {
    process.exit(1);
  });
});
