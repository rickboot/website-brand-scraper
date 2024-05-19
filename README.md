# website-brand-scraper

## What it does

This javascript scraper prompts for a website url and then runs a Playwright to
fetch brand information in json format:

```
{
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
}
```

Playwright scrapes the website for userland text, brand colors, and urls for the social, logos, and img.

Brand colors are currently grabbed from the css color and background-colors of specific elements.

The text is fed into OpenAI GPT to generate a description of the brand writing style and target audience.

## To use

Add .env file with OPENAI_API_KEY

```
npm i
```

```
node scraper.py
```

## Todo

Add:

- return json file instead of just logging
- robust error handling
