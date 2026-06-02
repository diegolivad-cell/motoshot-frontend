export const CEO_EMAIL = (import.meta.env.VITE_CEO_EMAIL || "motoshotgt@gmail.com").toLowerCase().trim();

export const getAdminEmails = () => {
  const fromEnv = (import.meta.env.VITE_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([CEO_EMAIL, ...fromEnv])];
};

export const isCeo = (email) => !!email && email.toLowerCase().trim() === CEO_EMAIL;

export const isAdmin = (email) => {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase().trim());
};

export const isStaff = (email) => isAdmin(email);

export const getUserRole = (email) => {
  if (isCeo(email)) return "ceo";
  if (isAdmin(email)) return "admin";
  return "user";
};
