export const avatarColors = ["lavender", "sky", "mint", "pink", "peach", "butter"];

// Call once when creating a profile, then persist the returned color in your database.
export function pickRandomAvatarColor() {
  return avatarColors[Math.floor(Math.random() * avatarColors.length)];
}

// Copy PNG files to your application's public/avatars directory.
export function avatarUrl(savedColor, basePath = "/avatars") {
  const color = avatarColors.includes(savedColor) ? savedColor : "lavender";
  return basePath.replace(/\/$/, "") + "/ghost-" + color + ".png";
}
// Render with width/height equal and CSS border-radius: 50%; object-fit: cover.

