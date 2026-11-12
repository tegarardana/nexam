/**
 * Format a teacher or user display name with their academic title (gelar) when provided.
 * Example: formatNameWithTitle("Budi Santoso", "S.Pd., M.Kom.") => "Budi Santoso, S.Pd., M.Kom."
 */
export function formatNameWithTitle(
  displayName?: string | null,
  title?: string | null
): string {
  const cleanName = displayName?.trim() || "";
  if (!cleanName) return "";

  const cleanTitle = title?.trim() || "";
  if (!cleanTitle || cleanTitle === "-") {
    return cleanName;
  }

  // Avoid duplicating title if it's already appended to displayName
  if (cleanName.toLowerCase().endsWith(cleanTitle.toLowerCase())) {
    return cleanName;
  }

  if (cleanName.endsWith(",")) {
    return `${cleanName} ${cleanTitle}`;
  }

  return `${cleanName}, ${cleanTitle}`;
}

