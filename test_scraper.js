const BusinessScraper = require('./src/scraper');

async function test() {
    console.log("Starting test...");
    const scraper = new BusinessScraper();
    await scraper.init();

    // Hook into browser console
    scraper.browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
            const page = await target.page();
            page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
        }
    });

    try {
        const results = await scraper.scrapeGoogleMaps('Lawyers in New Jersey', 20);
        console.log(`Test complete. Extracted ${results.length} results.`);
    } catch (e) {
        console.error(e);
    } finally {
        await scraper.close();
    }
}

test();
