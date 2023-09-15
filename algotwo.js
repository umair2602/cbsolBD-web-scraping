
const axios = require('axios');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const API_KEY = '6767f3b8aa507a5819bdb55c995a451e2e3d4f4a0fc258c187b6aa2ba68577d9';
const CSV_FILE_PATH = 'company-info.csv'; // Replace with the path to your CSV file
const OUTPUT_FOLDER = 'output'; // Folder to save the results

// Ensure the output folder exists
if (!fs.existsSync(OUTPUT_FOLDER)) {
  fs.mkdirSync(OUTPUT_FOLDER);
}

// Function to create a subfolder inside the output folder
function createSubfolder(subfolderName) {
  const subfolderPath = path.join(OUTPUT_FOLDER, subfolderName);
  if (!fs.existsSync(subfolderPath)) {
    fs.mkdirSync(subfolderPath);
  }
  return subfolderPath;
}

// Function to extract and save displayed links from SERP data
function extractAndSaveDisplayedLinks(serpData, outputFilePath) {
  const displayedLinks = serpData.map((result) => result.displayed_link);
  fs.writeFileSync(outputFilePath, JSON.stringify(displayedLinks, null, 2));
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

// Function to read CSV file and make SERP queries for a field
async function processCsvField(fieldName) {
  const subfolderPath = createSubfolder(fieldName);
  const results = [];

  fs.createReadStream(CSV_FILE_PATH)
    .pipe(csv())
    .on('data', async (row) => {
      const fieldValue = row[fieldName];
      const query = `${fieldValue}`;
      const serpData = await fetchSerpData(query);
      if (serpData) {
        const outputFile = path.join(subfolderPath, `${fieldValue}_displayed_links.json`);
        extractAndSaveDisplayedLinks(serpData, outputFile);
        results.push({ query, outputFile });
      }
    })
    .on('end', () => {
      console.log(`Displayed links for '${fieldName}' queries saved in the '${subfolderPath}' folder.`);
    });
}

// Example usage for each field
processCsvField('first_name');
processCsvField('last_name');
processCsvField('company_name');
