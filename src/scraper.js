const puppeteer = require("puppeteer");

class BusinessScraper {
  constructor() {
    this.browser = null;
    this.results = [];
    this.delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: true, // Set true untuk production
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    console.log("Browser initialized");
  }

  async scrapeGoogleMaps(searchQuery, maxResults = 100) {
    if (!this.browser) await this.init();

    const page = await this.browser.newPage();
    // Use high-res screen to load more items per view
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    try {
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
      console.log(`Searching: ${searchUrl}`);

      await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });
      await this.delay(3000);

      const allBusinesses = new Map(); // Use Map to deduplicate by ID/Name
      let totalExtracted = 0;
      let noNewResultsCount = 0;
      const MAX_NO_change = 5;

      // Find scroll container
      let scrollContainerSelector = '[role="feed"]';
      let scrollContainer = await page.$(scrollContainerSelector);
      if (!scrollContainer) {
        // Fallback selectors
        const scrollSelectors = [
          '.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde.ecceSd',
          'div[aria-label^="Hasil"][role="main"]',
          'div[aria-label^="Results"][role="main"]',
        ];
        for (const s of scrollSelectors) {
          if (await page.$(s)) {
            scrollContainerSelector = s;
            break;
          }
        }
      }

      console.log(`Using scroll container: ${scrollContainerSelector}`);

      // Loop: Scroll -> Extract -> Scroll -> Extract
      while (totalExtracted < maxResults) {
        // 1. Extract visible items
        const businesses = await page.evaluate(() => {
          const results = [];

          // Strategy: Look for ANY element that acts like a business card.
          // .Nv2PK is the specific class, but we also check for generic containers with links to /maps/place
          // This captures items even if .Nv2PK is renamed, as long as the structure is somewhat preserved.
          const allElements = document.querySelectorAll('.Nv2PK, div[role="article"], a[href*="/maps/place"]');

          // We need to be careful not to duplicate processing if we select parent and child.
          // So we'll process the elements but use a Set of found URLs to de-dupe *within* this single pass.
          const seenInBatch = new Set();

          for (const element of allElements) {
            // Normalize element: If it's an anchor, look up to find the card container? 
            // Actually, simply checking if the element OR its children has the link is enough.

            let card = element;
            let mainLink = element.tagName === 'A' ? element : element.querySelector('a[href*="/maps/place"]');

            // If this element doesn't have the link, and isn't the link, skip it.
            if (!mainLink) continue;

            // If we are looking at the anchor itself, try to find the container div for better text extraction
            // The container usually has the class .Nv2PK or role="article"
            if (element.tagName === 'A') {
              const closestCard = element.closest('.Nv2PK, div[role="article"]');
              if (closestCard) card = closestCard;
            }

            const url = mainLink.href.split('?')[0];
            if (seenInBatch.has(url)) continue;
            seenInBatch.add(url);

            let textContent = card.innerText || "";
            textContent = textContent.replace(/\n/g, '  ');

            if (textContent.length < 10) continue;

            // 1. Name Extraction
            let name = card.getAttribute('aria-label') || "";

            if (!name) {
              const headline = card.querySelector('.fontHeadlineSmall, .qBF1Pd, .hfV9m');
              if (headline) name = headline.textContent.trim();
            }

            if (!name) {
              // Try getting text from the link itself or h3/h4 in the card
              if (mainLink.getAttribute('aria-label')) name = mainLink.getAttribute('aria-label');
            }

            if (!name) {
              const boldElement = card.querySelector('div.fontHeadlineSmall');
              if (boldElement) name = boldElement.textContent.trim();
              else if (textContent.length > 3) name = textContent.split(/[\r\n]+/)[0].trim();
            }

            if (!name) continue;

            // 2. Phone Extraction
            const phoneMatch = textContent.match(/(?:\+?\d{1,3}[ -]?)?\(?\d{2,4}\)?[ -]?\d{3,4}[ -]?\d{3,4}/);
            const phone = phoneMatch ? phoneMatch[0].trim() : "";

            // 3. Rating Extraction
            const ratingMatch = textContent.match(/(\d\.\d)\s*\(\d+\)/);
            const rating = ratingMatch ? ratingMatch[1] : "";

            // 4. Website Extraction
            let website = "";
            const links = card.querySelectorAll('a');
            for (const link of links) {
              const href = link.href;
              if (href && !href.includes('google.com') && !href.includes('javascript:') && !href.includes('plus.codes')) {
                website = href;
                break;
              }
            }

            // 5. Address Extraction
            let address = "";
            let addressText = textContent
              .replace(name, '')
              .replace(phone, '')
              .replace(/(\d\.\d)\s*\(\d+\)/, '')
              .replace(/Buka.*?tutup/gi, '')
              .replace(/Open.*?closes/gi, '')
              .replace(/Website/gi, '')
              .replace(/Rute/gi, '')
              .replace(/Directions/gi, '')
              .replace(/Save/gi, '')
              .replace(/Nearby/gi, '')
              .replace(/Send to your phone/gi, '')
              .replace(/Share/gi, '')
              .trim();

            const chunks = addressText.split(/[\r\n]+/).filter(c => c.trim().length > 5);
            if (chunks.length > 0) {
              address = chunks[0].trim();
            }

            results.push({
              id: url,
              name,
              address,
              phone,
              rating,
              website,
              referenceLink: mainLink.href,
              hasWebsite: !!website
            });
          }
          return results;
        });

        // Process current batch
        let newFound = 0;
        for (const b of businesses) {
          if (!allBusinesses.has(b.id)) {
            allBusinesses.set(b.id, b);
            newFound++;
            console.log(`[DEBUG] Found: ${b.name}`);
          }
        }

        totalExtracted = allBusinesses.size;
        console.log(`Progress: ${totalExtracted} / ${maxResults} (New: ${newFound})`);

        if (totalExtracted >= maxResults) break;

        // 2. Scroll Logic
        if (newFound === 0) {
          noNewResultsCount++;
          if (noNewResultsCount >= MAX_NO_change) {
            console.log("Stopping: No new results found after scrolling.");
            break;
          }
        } else {
          noNewResultsCount = 0;
        }

        // Scroll down
        await page.evaluate((selector) => {
          const container = document.querySelector(selector);
          if (container) container.scrollTop = container.scrollHeight;
        }, scrollContainerSelector);

        await this.delay(2000); // Wait for load
      }

      const finalResults = Array.from(allBusinesses.values()).slice(0, maxResults);
      console.log(`Successfully extracted ${finalResults.length} businesses`);
      this.results = [...this.results, ...finalResults];

      await page.close();
      return finalResults;

    } catch (error) {
      console.error("Error scraping Google Maps:", error);
      if (page) await page.close();
      return [];
    }
  }

  // Legacy method removed
  async scrollResults(page, maxResults) { return; }

  async scrapeYellowPages(searchQuery, location = "Jakarta") {
    if (!this.browser) await this.init();

    const page = await this.browser.newPage();

    try {
      // Contoh untuk direktori bisnis Indonesia
      const searchUrl = `https://www.yellowpages.co.id/search?q=${encodeURIComponent(
        searchQuery
      )}&location=${encodeURIComponent(location)}`;
      console.log(`Searching Yellow Pages: ${searchUrl}`);

      await page.goto(searchUrl, { waitUntil: "networkidle2" });
      await this.delay(2000);

      const businesses = await page.evaluate(() => {
        const results = [];
        const businessElements = document.querySelectorAll(
          ".listing-item, .business-item"
        );

        businessElements.forEach((element) => {
          const nameElement = element.querySelector(
            "h3, .business-name, .listing-name"
          );
          const addressElement = element.querySelector(
            ".address, .business-address"
          );
          const phoneElement = element.querySelector(".phone, .business-phone");

          const business = {
            name: nameElement?.textContent?.trim() || "",
            address: addressElement?.textContent?.trim() || "",
            phone: phoneElement?.textContent?.trim() || "",
            source: "YellowPages",
          };

          if (business.name && business.address) {
            results.push(business);
          }
        });

        return results;
      });

      console.log(`Found ${businesses.length} businesses from Yellow Pages`);
      this.results = [...this.results, ...businesses];

      await page.close();
      return businesses;
    } catch (error) {
      console.error("Error scraping Yellow Pages:", error);
      await page.close();
      return [];
    }
  }

  cleanPhoneNumber(phone) {
    if (!phone) return "";

    // Remove common prefixes and format
    return phone
      .replace(/\D/g, "") // Remove non-digits
      .replace(/^62/, "0") // Convert +62 to 0
      .replace(/^0+/, "0"); // Remove multiple leading zeros
  }

  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Email generation skipped for now
  async findEmails(businessName, location) {
    return []; // Skip email generation for now
  }

  async processResults() {
    console.log("Processing and cleaning results...");

    const processedResults = await Promise.all(
      this.results.map(async (business, index) => {
        const cleanPhone = this.cleanPhoneNumber(business.phone);
        const possibleEmails = await this.findEmails(
          business.name,
          business.address
        );

        return {
          id: index + 1,
          name: business.name,
          address: business.address,
          phone: cleanPhone,
          website: business.website || "",
          referenceLink: business.referenceLink || "",
          possibleEmails: possibleEmails,
          rating: business.rating || "N/A",
          source: business.source || "Google Maps",
          scrapedAt: new Date().toISOString(),
        };
      })
    );

    // Remove duplicates based on name and address
    const uniqueResults = processedResults.filter(
      (business, index, self) =>
        index ===
        self.findIndex(
          (b) =>
            b.name.toLowerCase() === business.name.toLowerCase() &&
            b.address.toLowerCase() === business.address.toLowerCase()
        )
    );

    console.log(`Processed ${uniqueResults.length} unique businesses`);
    return uniqueResults;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log("Browser closed");
    }
  }
}

module.exports = BusinessScraper; 