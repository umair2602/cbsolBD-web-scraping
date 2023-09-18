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
    console.log('Making request to SerpApi:', `https://serpapi.com/search?api_key=${API_KEY}&q=${encodeURIComponent(query)}`);
    const response = await axios.get(`https://serpapi.com/search?api_key=${API_KEY}&q=${encodeURIComponent(query)}`);
    console.log('Response:', response.data);
    
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

        // Extract emails from the links
        const extractedEmails = await extractEmailsFromLinks(serpData, queryFolder);

        // Check if first_name, last_name, or both are present in the email and store them
        const fullName = `${firstName} ${lastName}`;
        const filteredEmails = filterEmailsByNames(extractedEmails, firstName, lastName);

        // Save the filtered emails in a CSV file
        const filteredEmailCSVFile = path.join(queryFolder, 'filtered_emails.csv');
        fs.writeFileSync(filteredEmailCSVFile, filteredEmails.join('\n'));

        console.log(`Filtered emails for ${fullName} saved in ${filteredEmailCSVFile}`);
      }
    })
    .on('end', () => {
      console.log(`All queries processed.`);
    });
}

async function extractEmailsFromLinks(serpData) {
  const browser = await chromium.launch();
  const context = await browser.newContext();

  const emailAddresses = [];

  for (const result of serpData) {
    try {
      const page = await context.newPage();
      await page.goto(result.link);

      // Define a regular expression to match valid email addresses
      const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

      // Extract emails from the page content
      const pageContent = await page.content();
      const extractedEmails = pageContent.match(emailRegex);

      if (extractedEmails) {
        extractedEmails.forEach((email) => {
          emailAddresses.push(email);
        });
      }

      await page.close();
    } catch (error) {
      console.error(`Error visiting link '${result.link}': ${error.message}`);
    }
  }

  // Remove duplicate email addresses
  const uniqueEmailAddresses = [...new Set(emailAddresses)];

  await context.close();
  await browser.close();

  return uniqueEmailAddresses;
}

function filterEmailsByNames(emails, firstName, lastName) {
  const fullName = `${firstName} ${lastName}`;
  const filteredEmails = [];

  for (const email of emails) {
    if (email.includes(firstName) || email.includes(lastName) || email.includes(fullName) ) {
      filteredEmails.push(email);
    }
  }

  return filteredEmails;
}

// Example usage
processCsvField();
