const express = require('express');
const multer = require('multer');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const Verifier = require('email-verifier');
const axios = require('axios'); // Import axios for making HTTP requests
const { chromium } = require('playwright');
const ExcelJS = require('exceljs'); // Import ExcelJS for creating Excel files
const validator = require('email-validator'); // Import validator for email validation
const cors = require('cors')

const app = express();
app.use(cors());

app.use(cors({
  origin: '*'
}))
const port = 3001;

const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage });

app.use(express.json());

const API_KEY = '0938863b743881ccd61ed300e9ca3dc9d774bdeb4686aa908faf7581bb5d9050'; // Replace with your SerpApi API key
const EMAIL_VERIFIER_API_KEY ='at_Lzsg1IJZ6NBVmqT0ICBo7a2gq01vA' // Replace with your Email Verifier API key
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

    async function extractEmailsFromLinks(serpData) {
      const browser = await chromium.launch();
      const context = await browser.newContext();
    
      const emailAddresses = new Set(); // Use a Set to store unique email addresses
    const limitedSerpData = serpData.slice(0,100)
      for (const result of limitedSerpData) {
        try {
          const page = await context.newPage();
          await page.goto(result.link);
    
          const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    
          const pageContent = await page.content();
          const extractedEmails = pageContent.match(emailRegex);
    
          if (extractedEmails) {
            for (const email of extractedEmails) {
             
              emailAddresses.add(email); // Use a Set to automatically ensure uniqueness
            }
          }
    
          await page.close();
    
          // Check if the Set size exceeds 100 and return if true
         
        } catch (error) {
          console.error(`Error visiting link '${result.link}': ${error.message}`);
        }
      }
    
      const uniqueEmailAddresses = Array.from(emailAddresses); // Convert Set to an Array
    
      await context.close();
      await browser.close();
    
      return uniqueEmailAddresses.slice(0, 100); // Return up to 100 unique email addresses
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
      const validEmails = [];
    
      for (const email of emails) {
        const verificationResult = await verifyEmail(email);
        if (verificationResult.isValid) {
          validEmails.push(email);
        }
      }
    
      return validEmails;
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

    async function saveEmailsToExcel(verificationResults, extractedEmails, filePath, firstName, lastName, companyDomain, fullName, verifierEmails) {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Extracted Emails');
    
      // Define columns for the worksheet
      worksheet.columns = [
        { header: 'Extracted-Email', key: 'extractedEmail', width: 40 },
        { header: 'Verifier', key: 'verifier', width: 40 },
      ];
    
      // Add verifier findings to the worksheet
      // verificationResults.forEach((result) => {
      //   worksheet.addRow(result);
      // });
    
      // // Add a separator row between verifier findings and extracted emails
      // worksheet.addRow({});
    
      // Add extracted emails to the worksheet
      extractedEmails.forEach((email) => {
        worksheet.addRow({ extractedEmail: email, verifier: '' }); // Empty verifier in the 'verifier' column
      });
    
      // Add verifierEmails to the worksheet
      verifierEmails.forEach((verifier) => {
        worksheet.addRow({ extractedEmail: '', verifier });
        console.log("verifier", verifier);
      });
    
      await workbook.xlsx.writeFile(filePath);
    
      return await filePath;
    }
    
    

    async function processCsvField(csvBuffer) {
        console.log(csvBuffer, "here i am")
        let excelFilePath='';
        let extractedEmails = [];
        let fullName ='';
        let filteredEmails='';
        let extractedEmailsVerification = '';
        let firstName = '';
        let lastName = '';
        let companyName = '';
        let companySite = '';
        let companyDomain = extractDomain(companySite);
        let fDomain;
        let lDomain;
        let flDomain;
        let verifierEmails = [];
      try {
        const csvData = csvBuffer.toString();//<-
        const rows = csvData.split('\n');
console.log("rows ",rows)
        for (const row of rows) {

          const columns = row.split(',');
console.log("columns ",columns)
          if (columns.length >= 4) {
            firstName = columns[0].trim();
            lastName = columns[1].trim();
            companyName = columns[3].trim();
            companySite = columns[4].trim();
            companyDomain = extractDomain(companySite);
            fDomain = `${firstName}@${companyDomain}`
            lDomain = `${lastName}@${companyDomain}`
            flDomain = `${firstName}.${lastName}@${companyDomain}`
            verifierEmails.push(fDomain, lDomain, flDomain)
            console.log("verifierEmails", verifierEmails)
            
          

            const query = `${firstName} ${lastName} ${companyName}`;
            const serpData = await fetchSerpData(query);
            
            // const queryFolder = path.join(OUTPUT_FOLDER, query);
             excelFilePath= path.join(OUTPUT_FOLDER, 'filtered_emails.xlsx');
            //  console.log("serpdata", serpData)
            if (serpData) {
              extractedEmails = await extractEmailsFromLinks(serpData);
              console.log("extracted emails", extractedEmails);
              fullName = `${firstName} ${lastName}`;
              filteredEmails = filterEmailsByNames(extractedEmails, firstName, lastName, companyName);
              console.log(" filteredEmails ",filteredEmails)
              // extractedEmailsVerification = await verifyEmails(filteredEmails);
          
              
              console.log(`Filtered and verified emails for ${fullName} saved in ${excelFilePath}`);
            }
          }
        }
        file = await saveEmailsToExcel(filteredEmails, extractedEmails, excelFilePath, firstName, lastName, companyDomain, fullName, verifierEmails);

        console.log(`All queries processed.`,excelFilePath);
        console.log("file", file);
        return excelFilePath;
      } catch (error) {
        console.error('An error occurred during CSV processing:', error);
        throw error;
      }
    }

    // await processCsvField(csvBuffer).then((res)=>{
    //   const processingResult = { message: 'CSV processing completed successfully' , path:res};
    //   // Return the processing result
    //   return processingResult;
    // }).catch((err)=>{
    //   console.log("here is error getting file path ", err)
    //   const processingResult = { message: err , path:null};
    //   return processingResult;
    // });

    const processingResult = await processCsvField(csvBuffer);
    console.log(" return processingResult; ",processingResult)
    return processingResult;
    
  } catch (error) {
    console.error('An error occurred during CSV processing:', error);
    throw error; // You can choose to throw the error or handle it as needed
  }
}


app.post('/upload', upload.single('csvFile'), async (req, res) => {
  console.log("req", req)
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
  
      // Access the uploaded file from req.file
      const csvBuffer = req.file.buffer;
  
      // Call the CSV processing function and pass the csvBuffer as an argument
      const result = await processCsv(csvBuffer);
      console.log("result is here hre here", result)
    // Respond to the client with the processing result
    res.json({ result }); 
      
    } catch (error) {
      console.error('An error occurred:', error);
      res.status(500).json({ message: 'Error uploading and processing file' });
    }
  });
  

  app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'output', filename); // Update the path as needed
  
    // Check if the file exists
    if (fs.existsSync(filePath)) {
      // Set the appropriate headers for the file download
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  
      // Send the file to the client
      res.sendFile(filePath);
    } else {
      // If the file doesn't exist, return a 404 error
      res.status(404).send('File not found');
    }
  });
  

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

