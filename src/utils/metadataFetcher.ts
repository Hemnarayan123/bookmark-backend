import axios from 'axios';
import * as cheerio from 'cheerio';
import { MetadataResult } from '../types';

export const fetchMetadata = async (url: string): Promise<MetadataResult> => {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Extract title
    let title = $('meta[property="og:title"]').attr('content') ||
                $('meta[name="twitter:title"]').attr('content') ||
                $('title').text() ||
                'Untitled';

    // Extract description
    let description = $('meta[property="og:description"]').attr('content') ||
                     $('meta[name="twitter:description"]').attr('content') ||
                     $('meta[name="description"]').attr('content') ||
                     '';

    // Extract favicon
    let favicon = $('link[rel="icon"]').attr('href') ||
                 $('link[rel="shortcut icon"]').attr('href') ||
                 $('link[rel="apple-touch-icon"]').attr('href') ||
                 '';

    // Make favicon URL absolute
    if (favicon && !favicon.startsWith('http')) {
      const urlObj = new URL(url);
      if (favicon.startsWith('//')) {
        favicon = urlObj.protocol + favicon;
      } else if (favicon.startsWith('/')) {
        favicon = `${urlObj.protocol}//${urlObj.host}${favicon}`;
      } else {
        favicon = `${urlObj.protocol}//${urlObj.host}/${favicon}`;
      }
    }

    // Fallback to default favicon
    if (!favicon) {
      const urlObj = new URL(url);
      favicon = `${urlObj.protocol}//${urlObj.host}/favicon.ico`;
    }

    return {
      title: title.trim().substring(0, 500),
      description: description.trim().substring(0, 2000),
      favicon: favicon.substring(0, 2048)
    };
  } catch (error) {
    console.error('Metadata fetch error:', error);
    
    // Return minimal metadata on error
    const urlObj = new URL(url);
    return {
      title: urlObj.hostname,
      description: '',
      favicon: `${urlObj.protocol}//${urlObj.host}/favicon.ico`
    };
  }
};

export const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
};