const express = require('express');
const multer = require('multer');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const Verifier = require('email-verifier');
const axios = require('axios'); // Import axios for making HTTP requests
const chromium = require('playwright-chromium'); // Import Playwright for web scraping
const ExcelJS = require('exceljs'); // Import ExcelJS for creating Excel files
const validator = require('validator'); // Import validator for email validation

const app = express();
const port = 3001;

const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage });

app.use(express.json());

const API_KEY = '0938863b743881ccd61ed300e9ca3dc9d774bdeb4686aa908faf7581bb5d9050'; // Replace with your SerpApi API key
const EMAIL_VERIFIER_API_KEY ='at_lUQgplpwEGpBioomW7VSWwRVJau1k' // Replace with your Email Verifier API key
const OUTPUT_FOLDER = 'output'; // Folder to save the results

// Create an instance of the email verifier
const verifier = new Verifier(EMAIL_VERIFIER_API_KEY);

async function processCsv(csvBuffer) {
  try {
    if (!fs.existsSync(OUTPUT_FOLDER)) {
      fs.mkdirSync(OUTPUT_FOLDER);
    }

    async function fetchSerpData(query) {
      try {
        console.log('Making request to SerpApi:', `https://serpapi.com/search?api_key=${API_KEY}&q=${encodeURIComponent(query)}`);
        const response = await axios.get(`https://serpapi.com/search?api_key=${API_KEY}&q=${encodeURIComponent(query)}`);

        if (response.status === 200) {
          return response.data.organic_results;
        } else {
          console.error('Error fetching SERP data for query:', query, response.statusText);
          return null;
        }
      } catch (error) {
        console.error('An error occurred:', error.message);
        return null;
      }
    }

    async function extractEmailsFromLinks(serpData, queryFolder) {
        const browser = await chromium.launch();
        const context = await browser.newContext();

      const emailAddresses = [];

      for (const result of serpData) {
        try {
          const page = await context.newPage();
          await page.goto(result.link);

          const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

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

      const uniqueEmailAddresses = [...new Set(emailAddresses)];

      await context.close();
      await browser.close();

      return uniqueEmailAddresses;
    }

    function filterEmailsByNames(emails, firstName, lastName, companyName) {
      const fullName = `${firstName} ${lastName}`;

      const validEmails = emails.filter((email) => validator.validate(email));

      const scoredEmails = validEmails.map((email) => {
        let score = 0;

        if (email.includes(fullName) && email.includes(companyName)) {
          score = 4;
        } else if (email.includes(fullName)) {
          score = 3;
        } else if (email.includes(lastName)) {
          score = 2;
        } else if (email.includes(firstName)) {
          score = 1;
        }

        return { email, score };
      });

      scoredEmails.sort((a, b) => b.score - a.score);

      const sortedEmails = scoredEmails.map((scoredEmail) => scoredEmail.email);

      return sortedEmails;
    }

    async function verifyEmails(emails) {
      const verificationResults = [];

      for (const email of emails) {
        const verificationResult = await verifyEmail(email);
        verificationResults.push(verificationResult);
      }

      return verificationResults;
    }

    async function verifyEmail(email) {
      return new Promise((resolve, reject) => {
        verifier.verify(email, { hardRefresh: true }, (err, data) => {
          if (err) {
            console.error(`Error verifying email ${email}: ${err.message}`);
            reject(err);
          } else {
            const mxRecords = data.mxRecords || [];
            const verificationResult = {
              email,
              isValid: data.formatCheck === 'true' && data.smtpCheck === 'true' && data.dnsCheck === 'true' && mxRecords.length !== 0,
              formatCheck: data.formatCheck === 'true',
              smtpCheck: data.smtpCheck === 'true',
              dnsCheck: data.dnsCheck === 'true',
              mxRecords: mxRecords.length !== 0,
            };
            resolve(verificationResult);
          }
        });
      });
    }

    function extractDomain(urlString) {
      try {
        if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
          urlString = 'http://' + urlString;
        }

        const parsedUrl = new URL(urlString);
        let domain = parsedUrl.hostname;

        if (domain.startsWith('www.')) {
          domain = domain.substring(4);
        }

        return domain;
      } catch (error) {
        console.error(`Error extracting domain from URL: ${urlString}`);
        return '';
      }
    }

    async function saveEmailsToExcel(emails, filePath, firstName, lastName, companyDomain, fullName) {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Extracted Emails');

      worksheet.columns = [
        { header: 'Email', key: 'email', width: 40 },
        { header: 'IsValid', key: 'isValid', width: 15 },
        { header: 'Format Check', key: 'formatCheck', width: 15 },
        { header: 'SMTP Check', key: 'smtpCheck', width: 15 },
        { header: 'DNS Check', key: 'dnsCheck', width: 15 },
      ];

      emails.forEach((result) => {
        worksheet.addRow(result);
      });

      await workbook.xlsx.writeFile(filePath);
    }

    async function processCsvField(csvBuffer) {
        console.log(csvBuffer, "here i am")
      try {
        const csvData = csvBuffer.toString();
        const rows = csvData.split('\n');

        for (const row of rows) {
          const columns = row.split(',');

          if (columns.length >= 4) {
            const firstName = columns[0].trim();
            const lastName = columns[1].trim();
            const companyName = columns[2].trim();
            const companySite = columns[3].trim();
            const companyDomain = extractDomain(companySite);

            const query = `${firstName} ${lastName} ${companyName}`;
            const serpData = await fetchSerpData(query);

            if (serpData) {
              const queryFolder = path.join(OUTPUT_FOLDER, query);

              if (!fs.existsSync(queryFolder)) {
                fs.mkdirSync(queryFolder);
              }

              const extractedEmails = await extractEmailsFromLinks(serpData, queryFolder);
              const fullName = `${firstName} ${lastName}`;
              const filteredEmails = filterEmailsByNames(extractedEmails, firstName, lastName, companyName);
              const extractedEmailsVerification = await verifyEmails(filteredEmails);
              const excelFilePath = path.join(queryFolder, 'filtered_emails.xlsx');
              await saveEmailsToExcel(extractedEmailsVerification, excelFilePath, firstName, lastName, companyDomain, fullName);

              console.log(`Filtered and verified emails for ${fullName} saved in ${excelFilePath}`);
            }
          }
        }

        console.log(`All queries processed.`);
        return excelFilePath;
      } catch (error) {
        console.error('An error occurred during CSV processing:', error);
        throw error;
      }
    }

    await processCsvField(csvBuffer);

      
    const processingResult = { message: 'CSV processing completed successfully' };

    // Return the processing result
    return processingResult;
  } catch (error) {
    console.error('An error occurred during CSV processing:', error);
    throw error; // You can choose to throw the error or handle it as needed
  }
}

app.post('/api/upload-csv', upload.single('csvFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
  
      // Access the uploaded file from req.file
      const csvBuffer = req.file.buffer;
  
      // Call the CSV processing function and pass the csvBuffer as an argument
      const excelFilePath = await processCsv(csvBuffer);
  
      // Respond to the client with the processing result
      res.download(excelFilePath, 'filtered_emails.xlsx', (err) => {
        if (err) {
          console.error('Error while sending file for download:', err);
          res.status(500).json({ message: 'Error sending the file for download' });
        } else {
          console.log('Excel file sent for download');
        }
      });
    } catch (error) {
      console.error('An error occurred:', error);
      res.status(500).json({ message: 'Error uploading and processing file' });
    }
  });
  

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
