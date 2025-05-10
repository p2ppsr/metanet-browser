/**
 * Generates a deterministic color and initial for a given identifier
 * @param id - The unique identifier to generate an avatar for (pubkey, protocolID, etc)
 * @returns An object with background color, text color, and initial for avatar
 */

type AvatarData = {
  backgroundColor: string;
  textColor: string;
  initial: string;
};

/**
 * Simple hash function to convert a string to a number
 */
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

/**
 * Convert a hash to a color in HSL format
 */
const hashToColor = (hash: number): string => {
  // Use modulo to get a hue value between 0 and 360
  const hue = hash % 360;
  // Fixed saturation and lightness for good contrast
  return `hsl(${hue}, 65%, 55%)`;
};

/**
 * Get a contrasting text color (black or white) based on the background color
 */
const getContrastingTextColor = (hue: number): string => {
  // For simplicity, use white text for darker hues, black for lighter ones
  // This is an approximation - more complex algorithms exist for true contrast
  return (hue > 60 && hue < 180) ? '#000000' : '#FFFFFF';
};

/**
 * Generate deterministic avatar data for a given id
 */
export const deterministicImage = (id: string): AvatarData => {
  const hash = hashString(id);
  const hue = hash % 360;
  const backgroundColor = hashToColor(hash);
  const textColor = getContrastingTextColor(hue);
  
  // Use the first character of the id, or a fallback if id is empty
  const initial = id && id.length > 0 ? id.charAt(0).toUpperCase() : '?';
  
  return {
    backgroundColor,
    textColor,
    initial
  };
};

export default deterministicImage;
