const axios = require('axios');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const { chromium } = require('playwright');

const API_KEY = '6767f3b8aa507a5819bdb55c995a451e2e3d4f4a0fc258c187b6aa2ba68577d9';
const CSV_FILE_PATH = 'company-info.csv'; // Replace with the path to your CSV file
const OUTPUT_FOLDER = 'output'; // Folder to save the results

// Ensure the output folder exists
if (!fs.existsSync(OUTPUT_FOLDER)) {
  fs.mkdirSync(OUTPUT_FOLDER);
}

async function fetchSerpData(query) {
  try {
    const response = await axios.get(`https://serpapi.com/search?api_key=${API_KEY}&q=${encodeURIComponent(query)}`);

    // Check if the request was successful
    if (response.status === 200) {
      return response.data.organic_results; // Return the SERP data
    } else {
      console.error('Error fetching SERP data for query:', query, response.statusText);
      return null; // Return null on error
    }
  } catch (error) {
    console.error('An error occurred:', error.message);
    return null; // Return null on error
  }
}

async function processCsvField() {
  fs.createReadStream(CSV_FILE_PATH)
    .pipe(csv())
    .on('data', async (row) => {
      const firstName = row['first_name'];
      const lastName = row['last_name'];
      const companyName = row['company_name'];

      // Combine the fields into a single query
      const query = `${firstName} ${lastName} ${companyName}`;
      const serpData = await fetchSerpData(query);

      if (serpData) {
        // Create a subfolder for each query (row)
        const queryFolder = path.join(OUTPUT_FOLDER, query);
        if (!fs.existsSync(queryFolder)) {
          fs.mkdirSync(queryFolder);
        }

        // Open each link with Playwright and extract links from the pages
        await extractLinksFromPages(serpData, queryFolder);
      }
    })
    .on('end', () => {
      console.log(`All queries processed.`);
    });
}

async function extractLinksFromPages(serpData, queryFolder) {
  const browser = await chromium.launch();
  const context = await browser.newContext();

  for (const result of serpData) {
    try {
      const page = await context.newPage();
      await page.goto(result.link);

      const allLinks = await page.$$eval('a', (links) => links.map((link) => link.href));

      const pageLinksCSVFile = path.join(queryFolder, 'page_links.csv');
      fs.appendFileSync(pageLinksCSVFile, allLinks.join('\n') + '\n');

      console.log(`Links from ${result.link} page appended to ${pageLinksCSVFile}`);

      await page.close();
    } catch (error) {
      console.error(`Error visiting link '${result.link}': ${error.message}`);
    }
  }

  await context.close();
  await browser.close();
}

// Example usage
processCsvField();
