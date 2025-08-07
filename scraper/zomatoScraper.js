require('dotenv').config();
const playwright = require('playwright');
const cheerio = require('cheerio');

async function scrapeByLocation(city, area = '', limit = parseInt(process.env.AREA_LIMIT, 10) || 50) {
  console.log(`[INFO] Start scraping for city='${city}', area='${area || 'default'}', limit=${limit}`);

  const normalizedCity = city.trim().toLowerCase().replace(/\s+/g, '-');
  const normalizedArea = area.trim().toLowerCase().replace(/\s+/g, '-');
  const locationPath = normalizedArea
    ? `${normalizedCity}/${normalizedArea}-restaurants`
    : `${normalizedCity}/restaurants`;
  const baseURL = process.env.ZOMATO_BASE_URL;

  const categoryIds = [null, 1, 3];
  const allLinks = new Set();
  const t0 = Date.now();

  // Optional proxy setup
  const proxyServer = process.env.PROXY || null;
  console.log(`[DEBUG] Proxy: ${proxyServer || 'No proxy used'}`);

  const launchOptions = {
    headless: true,
  };
  if (proxyServer) {
    launchOptions.proxy = { server: proxyServer };
  }

  const browser = await playwright.firefox.launch(launchOptions);
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();

  for (const cat of categoryIds) {
    let pageURL = `${baseURL}/${locationPath}`;
    if (cat) pageURL += `?category=${cat}`;
    console.log(`\n[INFO] Navigating to (${cat || 'default'}): ${pageURL}`);

    try {
      await page.goto(pageURL, { timeout: 60000 });
      await page.waitForTimeout(3000);

      if (cat === 1) {
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
      await page.waitForTimeout(5000);
      await page.mouse.wheel(0, 30000);
      await page.waitForTimeout(3000);

      const $ = cheerio.load(await page.content());
      $('a[href^="/"]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        if (cat === 1) {
          if (/(order|menu|restaurant)/.test(href)) {
            allLinks.add(baseURL + href);
          }
        } else {
          if (href.includes(normalizedCity) && href.includes('/info')) {
            allLinks.add(baseURL + href);
          }
        }
      });

      console.log(`[CAT ${cat || 'default'}] Links collected: ${allLinks.size}`);
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
  console.log(`[INFO] Collected ${allLinks.size} links in ${((Date.now() - t0) / 1000).toFixed(2)}s`);

  const toFetch = Array.from(allLinks).slice(0, limit);
  return toFetch;
}

module.exports = { scrapeByLocation };















































// require('dotenv').config();
// const cheerio = require('cheerio');
// const { firefox } = require('playwright-extra');
// const stealth = require('playwright-extra-plugin-stealth')();
// firefox.use(stealth);

// const userAgents = [
//   'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0',
//   'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)',
//   'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)',
//   'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)',
// ];

// function randomDelay(min = 3000, max = 6000) {
//   return new Promise(res => setTimeout(res, Math.random() * (max - min) + min));
// }

// async function scrapeByLocation(city, area = '', limit = parseInt(process.env.AREA_LIMIT, 10) || 50) {
//   console.log(`[INFO] Start scraping for city='${city}', area='${area || 'default'}', limit=${limit}`);

//   const normalizedCity = city.trim().toLowerCase().replace(/\s+/g, '-');
//   const normalizedArea = area.trim().toLowerCase().replace(/\s+/g, '-');
//   const locationPath = normalizedArea
//     ? `${normalizedCity}/${normalizedArea}-restaurants`
//     : `${normalizedCity}/restaurants`;
//   const baseURL = process.env.ZOMATO_BASE_URL;

//   const categoryIds = [null, 1, 3];  // default, delivery, cafés
//   const allLinks = new Set();
//   const t0 = Date.now();

//   const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
//   const browser = await firefox.launch({ headless: true });
//   const context = await browser.newContext({
//     userAgent,
//     viewport: { width: 1280, height: 800 },
//     locale: 'en-US'
//   });
//   const page = await context.newPage();

//   for (const cat of categoryIds) {
//     let pageURL = `${baseURL}/${locationPath}`;
//     if (cat) pageURL += `?category=${cat}`;
//     console.log(`\n[INFO] Navigating to (${cat || 'default'}): ${pageURL}`);

//     try {
//       await page.goto(pageURL, { timeout: 60000 });
//       await randomDelay(2000, 4000);

//       if (cat === 1) {
//         await page.waitForSelector("div[class*='sc-']", { timeout: 15000 });
//         await randomDelay(4000, 6000);
//       }
//     } catch (err) {
//       console.warn(`[WARN] Failed to load ${pageURL}: ${err.message}`);
//       continue;
//     }

//     let stagnant = 0;
//     while (allLinks.size < limit) {
//       const before = allLinks.size;
//       await page.mouse.wheel(0, 50000);
//       await randomDelay(3000, 5000);

//       const $ = cheerio.load(await page.content());
//       $('a[href^="/"]').each((_, el) => {
//         const href = $(el).attr('href');
//         if (!href) return;
//         if (cat === 1) {
//           if (/(order|menu|restaurant)/.test(href)) {
//             allLinks.add(baseURL + href);
//           }
//         } else {
//           if (href.includes(normalizedCity) && href.includes('/info')) {
//             allLinks.add(baseURL + href);
//           }
//         }
//       });

//       console.log(`[CAT ${cat || 'default'}] Links collected: ${allLinks.size}`);
//       if (allLinks.size >= limit) break;
//       if (allLinks.size === before) {
//         stagnant++;
//         if (stagnant >= 8) {
//           console.log('[WARN] No new links; moving to next category');
//           break;
//         }
//       } else {
//         stagnant = 0;
//       }
//     }

//     if (allLinks.size >= limit) {
//       console.log('[✅] Global limit reached, stopping category loop');
//       break;
//     }
//   }

//   await browser.close();
//   console.log(`[INFO] Collected ${allLinks.size} links in ${((Date.now() - t0) / 1000).toFixed(2)}s`);

//   const toFetch = Array.from(allLinks).slice(0, limit);
//   return toFetch;
// }

// module.exports = { scrapeByLocation };

