const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const websiteUrl = 'https://lifeline-tech.web.app/';

  await page.goto(websiteUrl);

  // Extract all the text content from the page
  const pageContent = await page.content();

  // Search for email addresses in the HTML content
  const emailAddresses = [];

  // Function to extract email addresses from text
  const extractEmails = (text) => {
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
    const matches = text.match(emailRegex);
    if (matches) {
      emailAddresses.push(...matches);
    }
  };

  // Search in text content of the entire page
  extractEmails(pageContent);

  // Search in anchor tags' href attributes
  const links = await page.$$('a');
  for (const link of links) {
    const href = await link.getAttribute('href');
    if (href && (href.includes('mailto:') || href.includes('mail:') || href.includes('email:'))) {
      const email = href.replace('mailto:', '').replace('mail:', '').replace('email:', '');
      extractEmails(email);
    }
  }

  // Remove duplicate email addresses
  const uniqueEmailAddresses = [...new Set(emailAddresses)];

  // Save the email addresses in a text file
  const folderName = 'lifeline-tech-emails';
  if (!fs.existsSync(folderName)) {
    fs.mkdirSync(folderName);
  }
  const filePath = `${folderName}/emails.txt`;
  fs.writeFileSync(filePath, uniqueEmailAddresses.join('\n'));

  console.log(`Email addresses saved in ${filePath}`);

  await browser.close();
})();
