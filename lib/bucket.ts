export function getBucketName(): string {
  let b = process.env.SUPABASE_BUCKET || "images";
  // Trim whitespace and strip CR/LF
  b = b.trim().replace(/[\r\n]/g, "");
  // Remove wrapping quotes if present
  b = b.replace(/^['"]|['"]$/g, "");
  // Remove any percent-encoded sequences like %0D%0A
  b = b.replace(/%[0-9A-Fa-f]{2}/g, "");
  // Remove slashes/backslashes and spaces
  b = b.replace(/[\\/\s]/g, "");
  // Force lowercase for consistency
  b = b.toLowerCase();
  if (!b) b = "images";
  return b;
}

export function sanitizePublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Remove any encoded CR/LF that may sneak into URLs
  return url.replace(/%0D%0A|%0D|%0A/gi, "");
}

