// Sticky Ji — Email Assets

const frontendBase = (process.env.FRONTEND_URL || "https://stickyji.com").replace(/\/+$/, "");

export const emailAssets = {
    logo: {
        primary: "https://media.stickyji.com/companylogos/StickyJiHorizontalLogo.png",
    },

    links: {
        website: "https://stickyji.com",
        dashboard: `${frontendBase}/app`,
        login: `${frontendBase}/auth/login`,
        signup: `${frontendBase}/auth/signup`,
        pricing: "https://stickyji.com/pricing",
        support: "https://stickyji.com/support",
    },

    actions: {
        verifyEmail: `${frontendBase}/auth/verify-email`,
        resetPassword: `${frontendBase}/auth/reset-password`,
        unsubscribe: `${frontendBase}/unsubscribe`,
    },
} as const;

export type EmailAssets = typeof emailAssets;
