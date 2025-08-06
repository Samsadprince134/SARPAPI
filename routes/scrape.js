const express = require("express");
const router = express.Router();
const { scrapeByLocation } = require("../scraper/zomatoScraper");
console.log("hello route")
// GET /api/data/location?city=kolkata&area=park-street&limit=5
router.get("/location", async (req, res) => {
  const { city, area, limit } = req.query;
  console.log("city", "limit", city, limit)

  if (!city) return res.status(400).json({ error: "city parameter is required" });

  try {
    const max = parseInt(limit) || parseInt(process.env.AREA_LIMIT) || 5;
    console.log("max", max)
    const data = await scrapeByLocation(city, area || "", max);
    res.json({ message: `${data.length} results for ${city}`, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Scraping failed", details: err.message });
  }
});

module.exports = router;
