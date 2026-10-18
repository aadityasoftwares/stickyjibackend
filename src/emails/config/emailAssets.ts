// Sticky Ji — Email Assets

export const emailAssets = {
    logo: {
        primary: "https://aadityasoftwares.fun/mystickynotes/mystickynoteslogo.png",
    },

    links: {
        website: "https://aadityasoftwares.fun/mystickynotes",
        dashboard: "https://aadityasoftwares.fun/mystickynotes",
        login: "https://aadityasoftwares.fun/mystickynotes/login",
        signup: "https://aadityasoftwares.fun/mystickynotes/signup",
        pricing: "https://aadityasoftwares.fun/mystickynotes/pricing",
        support: "https://aadityasoftwares.fun/mystickynotes/support",
    },

    actions: {
        verifyEmail: "https://aadityasoftwares.fun/mystickynotes/verify-email",
        resetPassword: "https://aadityasoftwares.fun/mystickynotes/reset-password",
        unsubscribe: "https://aadityasoftwares.fun/mystickynotes/unsubscribe",
    },
} as const;

export type EmailAssets = typeof emailAssets;
