import OpenAI from 'openai';
import readline from 'readline';
import { chromium } from 'playwright';
import env from 'dotenv/config';

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

async function analyzeText(text, promptText) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are an expert content analyzer.' },
        { role: 'user', content: promptText + text },
      ],
    });
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error with OpenAI API:', error);
    return null;
  }
}

async function scrapeWebsite(url) {
  try {
    const browser = await chromium.launch({
      // headless: false,
      // executablePath:
      // '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(url);

    const companyName =
      (await page.$eval('meta[property="og:site_name"]', (element) =>
        element.getAttribute('content')
      )) || (await page.title());

    const websiteUrl = url;

    const socialMediaLinks = await page.$$eval(
      'a[href*="facebook.com"], a[href*="twitter.com"], a[href*="instagram.com"], a[href*="linkedin.com"], a[href*="tiktok.com"], a[href*="pinterest.com"]',
      (elements) => elements.map((element) => element.getAttribute('href'))
    );

    const logoUrls = await page.$$eval(
      'img[alt*="logo"], img[src*="logo"], span[class*="logo"] svg',
      (elements) => elements.map((element) => element.getAttribute('src'))
    );

    const brandColors = await page.$$eval('button, h1', (elements) => {
      const colors = [];

      elements.forEach((element) => {
        const color = colorToHex(window.getComputedStyle(element).color);
        const bgColor = colorToHex(
          window.getComputedStyle(element).backgroundColor
        );

        function colorToHex(color) {
          if (color.startsWith('#')) return color;

          color = color.replace(/\s/g, '').toLowerCase();

          if (color.startsWith('rgb')) {
            const rgbValues = color.match(/\d+/g).slice(0, 3);

            const hexValues = rgbValues.map((value) => {
              const hex = parseInt(value).toString(16);
              return hex.length === 1 ? '0' + hex : hex;
            });

            return '#' + hexValues.join('');
          }

          return null;
        }

        if (color && !colors.includes(color)) {
          colors.push(color);
        }
        if (bgColor && !colors.includes(bgColor)) {
          colors.push(bgColor);
        }
      });

      return colors;
    });

    const imageUrls = await page.$$eval('img', (elements) =>
      elements.map((element) => element.getAttribute('src'))
    );

    const ogTitle = await page.$eval('meta[property="og:title"]', (element) =>
      element.getAttribute('content')
    );
    const ogDescription = await page.$eval(
      'meta[property="og:description"]',
      (element) => element.getAttribute('content')
    );

    let pageText = await page.$$eval('p, h1, h2, h3, h4, h5, h6', (elements) =>
      elements.map((element) => element.textContent).join(' ')
    );

    const writingStylePrompt =
      'Analyze the writing style of the following text. Describe elements such as tone, voice, syntax, diction, and any notable literary devices or techniques used. Provide an overview of how these elements contribute to the overall impact and effectiveness of the paragraph in 20 words or less.';
    const targetAudiencePrompt =
      'Identify the target audience of the following text in less in 20 words or less:\n\n';
    const writingStyle = await analyzeText(pageText, writingStylePrompt);
    const targetAudience = await analyzeText(pageText, targetAudiencePrompt);

    await browser.close();

    return {
      companyName,
      websiteUrl,
      logoUrls,
      brandColors,
      imageUrls,
      ogTitle,
      ogDescription,
      writingStyle,
      targetAudience,
      socialMediaLinks,
    };
  } catch (error) {
    console.error('Error scraping the website:', error);
    return null;
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter the company’s website URL: ', async (url) => {
  url = 'http://' + url;
  const data = await scrapeWebsite(url);
  console.log(data);
  rl.close();
});
