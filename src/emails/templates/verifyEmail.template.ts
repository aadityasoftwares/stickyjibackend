import { EmailButton } from "../components/EmailButton.js";
import { EmailCard } from "../components/EmailCard.js";
import { EmailLayout } from "../components/EmailLayout.js";
import { emailStyles } from "../config/emailStyles.js";
import { emailTheme } from "../config/emailTheme.js";

export interface VerifyEmailProps {
    verificationUrl: string;
    expiresInMinutes: number;
}

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

export const verifyEmailTemplate = ({ verificationUrl, expiresInMinutes }: VerifyEmailProps): string => {
    const safeVerificationUrl = escapeHtml(verificationUrl);
    const safeExpiry = Math.max(1, Math.floor(expiresInMinutes));

    return EmailLayout({
        title: `Verify your ${emailTheme.brand.name} email address`,
        preheader: `Confirm your email address for ${emailTheme.brand.name}. This link expires in ${safeExpiry} minutes.`,
        showHeader: true,
        showFooter: true,
        children: `
        <!-- HERO -->
        <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="margin: 0 0 ${emailTheme.spacing.stackLg};"
        >
            <tr>
                <td align="center">
                    <h1
                        style="
                            margin: 0 0 12px;
                            font-size: 26px;
                            line-height: 1.25;
                            font-weight: 700;
                            color: ${emailTheme.colors.text};
                            letter-spacing: -0.5px;
                        "
                    >
                        Verify your email address ✉️
                    </h1>
                    <p
                        style="
                            margin: 0;
                            font-size: 16px;
                            line-height: 1.55;
                            color: ${emailTheme.colors.textMuted};
                            max-width: 440px;
                        "
                    >
                        Welcome to ${emailTheme.brand.name}! Please confirm your email address to secure your account and unlock all features.
                    </p>
                </td>
            </tr>
        </table>

        <!-- MAIN CARD -->
        ${EmailCard({
            variant: "default",
            content: `
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                    <td>
                        <p
                            style="
                                margin: 0 0 ${emailTheme.spacing.stackMd};
                                font-size: 15px;
                                line-height: 1.6;
                                color: ${emailTheme.colors.textSecondary};
                            "
                        >
                            Click the button below to verify your email address. This verification link will expire in <strong>${safeExpiry} minutes</strong>.
                        </p>

                        <div style="text-align: center; margin: 28px 0;">
                            ${EmailButton({
                                href: safeVerificationUrl,
                                text: "Verify Email Address",
                                variant: "primary",
                                fullWidth: true,
                            })}
                        </div>

                        <p
                            style="
                                margin: 0;
                                font-size: 13px;
                                line-height: 1.5;
                                color: ${emailTheme.colors.textMuted};
                            "
                        >
                            If you did not create an account on ${emailTheme.brand.name}, you can safely disregard this email.
                        </p>
                    </td>
                </tr>
            </table>
            `,
        })}

        <!-- LINK FALLBACK -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 20px;">
            <tr>
                <td>
                    <p style="font-size: 12px; line-height: 1.5; color: ${emailTheme.colors.textMuted}; word-break: break-all;">
                        Button not working? Copy and paste this URL into your browser:<br />
                        <a href="${safeVerificationUrl}" style="color: ${emailTheme.colors.primary}; text-decoration: underline;">
                            ${safeVerificationUrl}
                        </a>
                    </p>
                </td>
            </tr>
        </table>
        `,
    });
};
