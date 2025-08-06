global.File = global.File || class File extends Object {}; // Polyfill for Playwright

require("dotenv").config();
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// Import scrape route
const scrapeRoutes = require("./routes/scrape");

app.use(express.json());
app.use("/api/data", scrapeRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Welcome to Restaurant Scraper API (Node.js)" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
