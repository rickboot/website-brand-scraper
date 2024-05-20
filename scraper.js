import OpenAI from 'openai';
import { chromium } from 'playwright';
import env from 'dotenv/config';
import readline from 'readline';

if (env.OPENAI_API_KEY === 'undefined') {
  console.log('Create .env file with OPENAI_API_KEY=""');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

async function analyzeText(text, promptText) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      // model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are an expert content analyzer.' },
        { role: 'user', content: promptText + text },
      ],
    });
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error with OpenAI API:', error.message);
    return 'Analysis not available';
  }
}

async function scrapeWebsite(url) {
  try {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url);

    const companyName = await page
      .$eval('meta[property="og:site_name"]', (el) =>
        el.getAttribute('content')
      )
      .catch(() => page.title());

    const socialMediaLinks = await page.$$eval(
      'a[href*="facebook.com"], a[href*="twitter.com"], a[href*="instagram.com"], a[href*="linkedin.com"], a[href*="tiktok.com"], a[href*="pinterest.com"]',
      (elements) => elements.map((el) => el.getAttribute('href'))
    );

    const logoUrls = await page.$$eval(
      'img[alt*="logo"], img[src*="logo"], span[class*="logo"] svg',
      (elements) =>
        elements.map((el) => {
          let url = el.getAttribute('src') || el.getAttribute('href');
          if (!url) {
            // Serialize inline SVG and convert to data URL
            const svg = new XMLSerializer().serializeToString(el);
            url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
          }
          return url;
        })
    );

    const brandColors = await page.$$eval('button, h1, h2, a', (elements) => {
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

      const colors = [];
      elements.forEach((el) => {
        const bgColor = colorToHex(window.getComputedStyle(el).backgroundColor);
        const color = colorToHex(window.getComputedStyle(el).color);
        if (bgColor && !colors.includes(bgColor)) colors.push(bgColor);
        if (color && !colors.includes(color)) colors.push(color);
      });
      return colors;
    });

    const imageUrls = await page.$$eval('img', (elements) =>
      elements.map((el) => el.getAttribute('src'))
    );

    const [ogTitle, ogDescription] = await Promise.all([
      page
        .$eval('meta[property="og:title"]', (el) => el.getAttribute('content'))
        .catch(() => null),
      page
        .$eval('meta[property="og:description"]', (el) =>
          el.getAttribute('content')
        )
        .catch(() => null),
    ]);

    const pageText = await page.$$eval(
      'p, h1, h2, h3, h4, h5, h6',
      (elements) => elements.map((el) => el.textContent).join(' ')
    );

    const [writingStyle, targetAudience] = await Promise.all([
      analyzeText(
        pageText,
        'Analyze the writing style of the following text. Describe elements such as tone, voice, syntax, diction, and any notable literary devices or techniques used. Provide an overview of how these elements contribute to the overall impact and effectiveness of the paragraph in 20 words or less.'
      ),
      analyzeText(
        pageText,
        'Identify the target audience of the following text in less than 20 words:\n\n'
      ),
    ]);

    await browser.close();

    return {
      companyName,
      websiteUrl: url,
      logoUrls,
      brandColors,
      // imageUrls,
      ogTitle,
      ogDescription,
      writingStyle,
      targetAudience,
      socialMediaLinks,
    };
  } catch (error) {
    console.error('Error scraping the website:', error.message);
    return null;
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function getUserInput() {
  return new Promise((resolve, reject) => {
    rl.question('Enter the company’s website URL: ', (url) => {
      resolve(url);
    });
  });
}

async function main() {
  const url = await getUserInput();
  const data = await scrapeWebsite(url);
  console.log(data);
  rl.close();
}

main();
