// require("dotenv").config();
// const playwright = require("playwright");
// const axios = require("axios");
// const cheerio = require("cheerio");

// async function scrapeByLocation(city, area, limit) {
//   console.log("Scraping area:", area);

//   const normalizedCity = city.trim().toLowerCase().replace(/\s+/g, "-");
//   const normalizedArea = area.trim() ? area.trim().toLowerCase().replace(/\s+/g, "-") : "";
//   const path = normalizedArea
//     ? `/${normalizedCity}/${normalizedArea}-restaurants`
//     : `/${normalizedCity}/restaurants`;

//   const url = process.env.ZOMATO_BASE_URL + path;
//   const browser = await playwright.firefox.launch({ headless: true });
//   const context = await browser.newContext();
//   const page = await context.newPage();
//   const links = new Set();

//   try {
//     await page.goto(url, { timeout: 60000 });
//     await page.waitForTimeout(3000);

//     // Scroll and collect restaurant URLs
//     while (links.size < limit) {
//       await page.mouse.wheel(0, 50000);
//       await page.waitForTimeout(3000);
//       const content = await page.content();
//       const $ = cheerio.load(content);
//       $('a[href^="/"]').each((i, el) => {
//         const href = $(el).attr("href");
//         if (href.includes(`/${normalizedCity}/`) && href.includes("/info")) {
//           links.add(process.env.ZOMATO_BASE_URL + href);
//         }
//       });
//       if (links.size >= limit) break;
//     }
// console.log(`🔗 Collected URLs (${links.size}):`, Array.from(links).slice(0, limit));

//     // Fetch restaurant details
// //     const results = [];
// //     for (const link of Array.from(links).slice(0, limit)) {
// //       try {
// //         // const resp = await axios.get(link);
// //         // const $ = cheerio.load(resp.data);
// //         // const jsonLd = JSON.parse($('script[type="application/ld+json"]').eq(1).html());
// //         // results.push({
// //         //   name: jsonLd.name || null,
// //         //   address: jsonLd.address?.streetAddress || null,
// //         //   phone: jsonLd.telephone || "NA",
// //         // });
// //       } catch (e) {
// //         results.push({ error: `Failed to parse ${link}` });
// //       }
// //     }
// // console.log(`📋 Parsed restaurant data (${results.length}):`, results.slice(0, 3));

//     return Array.from(links).slice(0, limit);
//   } finally {
//     await browser.close();
//   }
// }

// module.exports = { scrapeByLocation };



// scraper/zomatoScraper.js
require('dotenv').config();
const playwright = require('playwright');
const axios      = require('axios');
const cheerio    = require('cheerio');

async function scrapeByLocation(city, area = '', limit = parseInt(process.env.AREA_LIMIT, 10) || 50) {
  console.log(`[INFO] Start scraping for city='${city}', area='${area || 'default'}', limit=${limit}`);

  // Normalize inputs
  const normalizedCity = city.trim().toLowerCase().replace(/\s+/g, '-');
  const normalizedArea = area.trim().toLowerCase().replace(/\s+/g, '-');
  const locationPath  = normalizedArea
    ? `${normalizedCity}/${normalizedArea}-restaurants`
    : `${normalizedCity}/restaurants`;
  const baseURL       = process.env.ZOMATO_BASE_URL;

  const categoryIds = [null, 1, 3];  // default, delivery, cafés
  const allLinks    = new Set();
  const t0          = Date.now();

  // Launch headless Firefox
  const browser = await playwright.firefox.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0',
    viewport:  { width: 1280, height: 800 },
    locale:    'en-US'
  });
  const page = await context.newPage();

  // Step 1: Collect links category by category
  for (const cat of categoryIds) {
    let pageURL = `${baseURL}/${locationPath}`;
    if (cat) pageURL += `?category=${cat}`;
    console.log(`\n[INFO] Navigating to (${cat||'default'}): ${pageURL}`);

    try {
      await page.goto(pageURL, { timeout: 60000 });
      await page.waitForTimeout(3000);
      if (cat === 1) {
        // extra wait for delivery cards
        await page.waitForSelector("div[class*='sc-']", { timeout: 15000 });
        await page.waitForTimeout(5000);
      }
    } catch (err) {
      console.warn(`[WARN] Failed to load ${pageURL}: ${err.message}`);
      continue;
    }

    let stagnant = 0;
    while (allLinks.size < limit) {
      const before = allLinks.size;
      await page.mouse.wheel(0, 50000);
      await page.waitForTimeout(5000);

      const $ = cheerio.load(await page.content());
      $('a[href^="/"]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        if (cat === 1) {
          // delivery category: match order/menu/restaurant
          if (/(order|menu|restaurant)/.test(href)) {
            allLinks.add(baseURL + href);
          }
        } else {
          // default & cafés
          if (href.includes(`/${normalizedCity}/`) && href.includes('/info')) {
            allLinks.add(baseURL + href);
          }
        }
      });

      console.log(`[CAT ${cat||'default'}] Links collected: ${allLinks.size}`);
      if (allLinks.size >= limit) break;
      if (allLinks.size === before) {
        stagnant++;
        if (stagnant >= 8) {
          console.log('[WARN] No new links; moving to next category');
          break;
        }
      } else stagnant = 0;
    }

    if (allLinks.size >= limit) {
      console.log('[✅] Global limit reached, stopping category loop');
      break;
    }
  }

  await browser.close();
  console.log(`[INFO] Collected ${allLinks.size} links in ${((Date.now()-t0)/1000).toFixed(2)}s`);

  // Step 2: Fetch JSON-LD details from each restaurant page
  const results = [];
  const toFetch = Array.from(allLinks).slice(0, limit);
  //console.log(`[INFO] Fetching details for ${toFetch.length} restaurants`);

  // for (const link of toFetch) {
  //   try {
  //     const resp = await axios.get(link, { timeout: 10000 });
  //     const $    = cheerio.load(resp.data);
  //     const scripts = $('script[type="application/ld+json"]');
  //     // Try the 2nd JSON-LD block first, fallback to the 1st
  //     const raw = scripts.eq(1).html() || scripts.eq(0).html();
  //     const data = JSON.parse(raw);
  //     results.push({
  //       name:    data.name    || null,
  //       address: data.address?.streetAddress || null,
  //       phone:   data.telephone || 'NA'
  //     });
  //   } catch (err) {
  //     console.warn(`[WARN] Parse failed for ${link}: ${err.message}`);
  //     results.push({ error: `Failed to parse ${link}` });
  //   }
  // }

  //console.log(`[INFO] Parsed ${results.length} restaurant records`);
  return toFetch;
}

module.exports = { scrapeByLocation };
