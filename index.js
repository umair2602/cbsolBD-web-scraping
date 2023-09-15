const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const websiteUrl = "https://cbsol.co.uk/latest-vacancies/";

  await page.goto(websiteUrl);

  // Define a regular expression to match valid email addresses
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

  // Function to extract and validate email addresses from text
  const extractAndValidateEmails = (text) => {
    const matches = text.match(emailRegex);
    return matches ? matches.filter((email) => emailRegex.test(email)) : [];
  };

  // Function to filter out email addresses found within script tags
  const filterEmailsInScripts = (html) => {
    return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  };

  // Extract all the text content from the page excluding script tags
  const pageContent = await page.evaluate(() => {
    const body = document.body.cloneNode(true);
    const scripts = body.querySelectorAll('script');
    scripts.forEach((script) => script.remove());
    return body.textContent;
  });

  // Search for email addresses in the filtered content
  const emailAddresses = extractAndValidateEmails(pageContent);

  // Search in anchor tags' href attributes
  const links = await page.$$('a');
  for (const link of links) {
    const href = await link.getAttribute('href');
    if (href && (href.includes('mailto:') || href.includes('mail:') || href.includes('email:'))) {
      const email = href.replace('mailto:', '').replace('mail:', '').replace('email:', '');
      if (emailRegex.test(email)) {
        emailAddresses.push(email);
      }
    }
  }

  // Remove duplicate email addresses
  const uniqueEmailAddresses = [...new Set(emailAddresses)];

  // Save the email addresses in a text file
  const folderName = 'azeemcbsolkisoul';
  if (!fs.existsSync(folderName)) {
    fs.mkdirSync(folderName);
  }
  const filePath = `${folderName}/emails.txt`;
  fs.writeFileSync(filePath, uniqueEmailAddresses.join('\n'));

  console.log(`Email addresses saved in ${filePath}`);

  await browser.close();
})();
