export const cleanCcEmails = (
  ccString: string | null | undefined,
): string[] | undefined => {
  if (!ccString || ccString.trim() === "") return undefined;

  const emailArray = ccString
    .split(/[,;]+/) // Split by comma or semicolon
    .map((email) => email.trim()) // Remove surrounding whitespace
    .filter((email) => email.length > 0); // Remove empty entries (e.g., if someone typed "a@b.com, , c@d.com")

  return emailArray.length > 0 ? emailArray : undefined;
};

export const parseEmailList = (
  emailString: string | null | undefined,
): string[] => {
  if (!emailString || emailString.trim() === "") return [];

  return emailString
    .split(/[,;]+/)
    .map((email) => email.trim())
    .filter((email) => email.length > 0);
};
