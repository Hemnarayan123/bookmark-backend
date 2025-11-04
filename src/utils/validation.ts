import { z } from 'zod';

export const createBookmarkSchema = z.object({
  url: z.string().url('Invalid URL format'),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  favicon: z.string().url().optional(),
  folder: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).optional()
});

export const updateBookmarkSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  folder: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).optional()
});

export const createTagSchema = z.object({
  name: z.string().min(1).max(50).trim()
});

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const sanitizeString = (str: string): string => {
  return str.trim().replace(/\s+/g, ' ');
};