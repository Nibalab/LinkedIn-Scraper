const puppeteer = require('puppeteer');
const fs = require('fs');
const randomUseragent = require('random-useragent');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const scrapeLinkedIn = async (keyword) => {
  try {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    // Randomize User-Agent
    const userAgent = randomUseragent.getRandom();
    await page.setUserAgent(userAgent);

    console.log('Navigating to LinkedIn Jobs page...');
    await page.goto(`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}`, { waitUntil: 'networkidle2' });

    // Wait for the job listings to load, adjust the selector as necessary
    console.log('Waiting for job listings to load...');
    try {
      await page.waitForSelector('.job-card-container', { timeout: 90000 }); // Increased timeout to 90 seconds
      console.log('Job listings loaded. Extracting job data...');
    } catch (error) {
      console.error('Failed to find job listings:', error);
      // Take a screenshot for debugging
      await page.screenshot({ path: 'debug_screenshot.png' });
      await browser.close();
      return;
    }

    const jobData = await page.evaluate(() => {
      const jobElements = document.querySelectorAll('.job-card-container');
      const jobs = [];

      jobElements.forEach(jobElement => {
        const jobTitle = jobElement.querySelector('.job-card-list__title')?.innerText || '';
        const companyName = jobElement.querySelector('.job-card-container__company-name')?.innerText || '';
        const jobLocation = jobElement.querySelector('.job-card-container__metadata-item')?.innerText || '';
        const jobDescription = jobElement.querySelector('.job-card-list__description')?.innerText || '';
        const jobPostDate = jobElement.querySelector('.job-card-container__listed-date')?.innerText || '';
        const skills = Array.from(jobElement.querySelectorAll('.job-card-container__skills span')).map(skill => skill.innerText).join(', ') || '';
        const applicationLink = jobElement.querySelector('.job-card-list__title a')?.href || '';

        jobs.push({
          jobTitle,
          companyName,
          jobLocation,
          jobDescription,
          jobPostDate,
          skills,
          applicationLink
        });
      });

      return jobs;
    });

    await browser.close();

    // Save data to JSON file
    console.log('Writing data to jobs.json...');
    fs.writeFileSync('jobs.json', JSON.stringify(jobData, null, 2), 'utf8');
    console.log('Data has been written to jobs.json');
  } catch (error) {
    console.error('An error occurred:', error);
    if (error.message.includes('429')) {
      console.log('Rate limit exceeded. Retrying after a delay...');
      await delay(60000); // Delay for 60 seconds before retrying
      return scrapeLinkedIn(keyword);
    }
  }
};

// Example usage
scrapeLinkedIn('MLOps').then(() => console.log('Scraping complete.'));
