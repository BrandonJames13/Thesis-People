// Passwords are stored as hashed values — never in plain text.
// Hash function: simple djb2-style hash for demo purposes.
// To add a new user, run: hashPassword("yourpassword") in the browser console.
function hashPassword(pw) {
  let h = 5381;
  for (let i = 0; i < pw.length; i++) {
    h = (h * 33) ^ pw.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

export { hashPassword };

export const USERS = {
  admin: {
    username: "admin",
    passwordHash: hashPassword("admin123"),
    name: "Admin User",
    initials: "AU",
    role: "admin",
  },
  faculty: {
    username: "faculty",
    passwordHash: hashPassword("faculty123"),
    name: "Faculty User",
    initials: "FU",
    role: "faculty",
  },
  reyes: {
    username: "reyes",
    passwordHash: hashPassword("reyes2025"),
    name: "Reyes, A.",
    initials: "RA",
    role: "faculty",
  },
  lim: {
    username: "lim",
    passwordHash: hashPassword("lim2025"),
    name: "Lim, K.",
    initials: "LK",
    role: "faculty",
  },
  santos: {
    username: "santos",
    passwordHash: hashPassword("santos2025"),
    name: "Santos, M.",
    initials: "SM",
    role: "faculty",
  },
  garcia: {
    username: "garcia",
    passwordHash: hashPassword("garcia2025"),
    name: "Garcia, L.",
    initials: "GL",
    role: "faculty",
  },
  cruz: {
    username: "cruz",
    passwordHash: hashPassword("cruz2025"),
    name: "Cruz, P.",
    initials: "CP",
    role: "faculty",
  },
};