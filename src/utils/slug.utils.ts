import { customAlphabet } from 'nanoid';

// Create a nanoid generator with URL-safe characters (no special chars)
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);

/**
 * Generate a URL-friendly slug from a topic string
 * @param topic - The topic string to slugify
 * @returns A URL-friendly slug
 */
export function slugify(topic: string): string {
  return topic
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .substring(0, 50); // Limit length
}

/**
 * Generate a unique quiz slug
 * @param topic - The quiz topic
 * @returns A unique slug like "javascript-basics-a1b2c3d4"
 */
export function generateQuizSlug(topic: string): string {
  const baseSlug = slugify(topic);
  const uniqueId = nanoid();
  return `${baseSlug}-${uniqueId}`;
}

/**
 * Generate a unique attempt ID
 * @returns A unique attempt ID like "attempt-a1b2c3d4"
 */
export function generateAttemptId(): string {
  const uniqueId = nanoid();
  return `attempt-${uniqueId}`;
}

/**
 * Generate a unique result ID
 * @param topic - The quiz topic for context
 * @returns A unique result ID like "result-javascript-basics-a1b2c3d4"
 */
export function generateResultId(topic: string): string {
  const baseSlug = slugify(topic);
  const uniqueId = nanoid();
  return `result-${baseSlug}-${uniqueId}`;
}
