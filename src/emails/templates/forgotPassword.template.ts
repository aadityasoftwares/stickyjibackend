import { EmailButton } from "../components/EmailButton.js";
import { EmailCard } from "../components/EmailCard.js";
import { EmailLayout } from "../components/EmailLayout.js";
import { emailStyles } from "../config/emailStyles.js";
import { emailTheme } from "../config/emailTheme.js";

export interface ForgotPasswordEmailProps {
    resetUrl: string;
    expiresInMinutes: number;
}

/**
 * Escapes user-controlled or dynamic text that is rendered
 * directly inside HTML.
 */
const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

/**
 * Password reset email.
 *
 * Important:
 * - The raw password-reset token is NEVER stored here.
 * - AuthService builds the final reset URL.
 * - This template only renders the provided URL.
 */
export const forgotPasswordEmailTemplate = ({
    resetUrl,
    expiresInMinutes,
}: ForgotPasswordEmailProps): string => {
    const safeResetUrl = escapeHtml(resetUrl);

    const safeExpiry = Math.max(1, Math.floor(expiresInMinutes));

    /**
     * Caveat is used only for expressive handwritten elements.
     *
     * Main content still uses the regular email typography
     * for maximum readability and email-client compatibility.
     */
    const handwrittenFont = "'Caveat', 'Comic Sans MS', 'Segoe Print', cursive";

    return EmailLayout({
        title: `Reset your ${emailTheme.brand.name} password`,

        preheader: `Reset your ${emailTheme.brand.name} password securely. This link expires in ${safeExpiry} minutes.`,

        showHeader: true,

        showFooter: true,

        children: `

        <!-- =========================================================
             HERO
        ========================================================== -->

        <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
                margin:
                    0 0
                    ${emailTheme.spacing.stackLg};
            "
        >
            <tr>

                <td align="center">

                    <!-- Security badge -->
                    <table
                        role="presentation"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        style="
                            margin:
                                0 auto 16px;
                        "
                    >
                        <tr>

                            <td
                                align="center"
                                style="
                                    padding:
                                        7px 14px;

                                    background-color:
                                        ${emailTheme.colors.notes.blue.iceBlue};

                                    border-radius:
                                        ${emailTheme.radius.full};
                                "
                            >

                                <span
                                    style="
                                        font-family:
                                            ${emailTheme.typography.labelBold.fontFamily};

                                        font-size: 11px;
                                        line-height: 1;

                                        font-weight: 700;

                                        letter-spacing:
                                            1.1px;

                                        text-transform:
                                            uppercase;

                                        color:
                                            ${emailTheme.colors.notes.blue.steelBlue};
                                    "
                                >
                                    🔒 SECURE PASSWORD RECOVERY
                                </span>

                            </td>

                        </tr>
                    </table>


                    <!-- Handwritten kicker -->
                    <p
                        style="
                            margin:
                                0 0 4px;

                            font-family:
                                ${handwrittenFont};

                            font-size: 30px;
                            line-height: 1.15;

                            font-weight: 700;

                            color:
                                ${emailTheme.colors.notes.yellow.goldenrod};

                            text-align: center;
                        "
                    >
                        Forgot something?
                    </p>


                    <!-- Heading -->
                    <h1
                        class="email-heading"
                        style="
                            ${emailStyles.h1}

                            max-width:
                                500px;

                            margin:
                                0 auto 14px;

                            text-align: center;
                        "
                    >
                        Let's get you back
                        to your notes.
                    </h1>


                    <!-- Intro -->
                    <p
                        style="
                            ${emailStyles.bodyLarge}

                            max-width:
                                465px;

                            margin:
                                0 auto;

                            text-align: center;
                        "
                    >
                        We received a request to reset
                        the password for your
                        ${emailTheme.brand.name} account.

                        Your notes, folders and workspaces
                        are exactly where you left them.
                    </p>

                </td>

            </tr>
        </table>



        <!-- =========================================================
             RESET STICKY NOTE
        ========================================================== -->

        <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
                margin:
                    0 0
                    ${emailTheme.spacing.stackLg};
            "
        >
            <tr>

                <td
                    align="center"
                    style="
                        padding:
                            10px 14px 14px;
                    "
                >

                    <div
                        style="
                            position: relative;

                            max-width:
                                430px;

                            box-sizing:
                                border-box;

                            padding:
                                25px 25px 23px;

                            background-color:
                                ${emailTheme.colors.notes.yellow.cream};

                            border-radius:
                                ${emailTheme.radius.sm};

                            box-shadow:
                                ${emailTheme.shadows.level2};

                            transform:
                                rotate(-0.7deg);
                        "
                    >

                        <!-- Tape -->
                        <div
                            style="
                                width: 78px;
                                height: 18px;

                                margin:
                                    -33px auto 17px;

                                background-color:
                                    rgba(255,255,255,.72);

                                border-left:
                                    1px solid rgba(29,29,29,.04);

                                border-right:
                                    1px solid rgba(29,29,29,.04);

                                transform:
                                    rotate(-1deg);
                            "
                        >
                            &nbsp;
                        </div>


                        <p
                            style="
                                margin:
                                    0 0 5px;

                                font-family:
                                    ${emailTheme.typography.labelBold.fontFamily};

                                font-size: 10px;
                                line-height: 1;

                                font-weight: 700;

                                letter-spacing:
                                    1px;

                                text-transform:
                                    uppercase;

                                color:
                                    ${emailTheme.colors.notes.yellow.goldenrod};
                            "
                        >
                            PASSWORD RESET
                        </p>


                        <p
                            style="
                                margin:
                                    0 0 9px;

                                font-family:
                                    ${handwrittenFont};

                                font-size: 28px;
                                line-height: 1.15;

                                font-weight: 700;

                                color:
                                    ${emailTheme.colors.onSurface};
                            "
                        >
                            A fresh password,
                            same familiar workspace.
                        </p>


                        <p
                            style="
                                ${emailStyles.mutedText}

                                margin: 0;
                            "
                        >
                            Choose a new password below.
                            Nothing inside your
                            ${emailTheme.brand.name}
                            workspace will be removed
                            or changed.
                        </p>

                    </div>

                </td>

            </tr>
        </table>



        <!-- =========================================================
             CTA
        ========================================================== -->

        <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
        >
            <tr>

                <td align="center">

                    <h2
                        style="
                            ${emailStyles.h2}

                            font-size:
                                23px;

                            margin:
                                0 0 8px;

                            text-align:
                                center;
                        "
                    >
                        Ready to reset your password?
                    </h2>


                    <p
                        style="
                            ${emailStyles.bodyText}

                            max-width:
                                400px;

                            margin:
                                0 auto 20px;

                            text-align:
                                center;
                        "
                    >
                        This secure link can only be used
                        for a limited time.
                    </p>


                    ${EmailButton({
                        text: "Reset My Password",
                        href: safeResetUrl,
                        variant: "primary",
                    })}


                    <p
                        style="
                            margin:
                                14px 0 0;

                            font-family:
                                ${emailTheme.typography.body.fontFamily};

                            font-size:
                                11px;

                            line-height:
                                1.5;

                            color:
                                ${emailTheme.colors.onSurfaceVariant};

                            text-align:
                                center;
                        "
                    >
                        Link expires in
                        <strong>
                            ${safeExpiry} minutes
                        </strong>.
                    </p>

                </td>

            </tr>
        </table>



        <!-- =========================================================
             SPACER
        ========================================================== -->

        <div
            style="
                height:
                    ${emailTheme.spacing.stackLg};

                line-height:
                    ${emailTheme.spacing.stackLg};
            "
        >
            &nbsp;
        </div>



        <!-- =========================================================
             SECURITY CARD
        ========================================================== -->

        ${EmailCard({
            variant: "blue",

            content: `

                <table
                    role="presentation"
                    width="100%"
                    cellspacing="0"
                    cellpadding="0"
                    border="0"
                >
                    <tr>

                        <td
                            width="44"
                            valign="top"
                        >

                            <div
                                style="
                                    width:
                                        36px;

                                    height:
                                        36px;

                                    line-height:
                                        36px;

                                    text-align:
                                        center;

                                    background-color:
                                        ${emailTheme.colors.notes.blue.iceBlue};

                                    border-radius:
                                        ${emailTheme.radius.sm};

                                    font-size:
                                        17px;
                                "
                            >
                                🔒
                            </div>

                        </td>


                        <td valign="top">

                            <h3
                                style="
                                    ${emailStyles.h3}

                                    font-size:
                                        17px;

                                    margin:
                                        0 0 6px;
                                "
                            >
                                Your account stays protected
                            </h3>


                            <p
                                style="
                                    ${emailStyles.mutedText}

                                    margin: 0;
                                "
                            >
                                After your password is changed,
                                your existing signed-in sessions
                                will be closed so your account can
                                start fresh with the new password.
                            </p>

                        </td>

                    </tr>
                </table>

            `,
        })}



        <!-- =========================================================
             NOT YOU?
        ========================================================== -->

        <div
            style="
                height: 12px;
                line-height: 12px;
            "
        >
            &nbsp;
        </div>


        ${EmailCard({
            variant: "yellow",

            content: `

                <p
                    style="
                        margin:
                            0 0 5px;

                        font-family:
                            ${handwrittenFont};

                        font-size:
                            21px;

                        line-height:
                            1.2;

                        font-weight:
                            700;

                        color:
                            ${emailTheme.colors.notes.yellow.goldenrod};
                    "
                >
                    Didn't ask for this?
                </p>


                <h3
                    style="
                        ${emailStyles.h3}

                        font-size:
                            17px;

                        margin:
                            0 0 7px;
                    "
                >
                    You don't need to do anything.
                </h3>


                <p
                    style="
                        ${emailStyles.mutedText}

                        margin: 0;
                    "
                >
                    If you didn't request a password reset,
                    simply ignore this email.

                    Your current password will continue
                    to work and no changes will be made
                    to your account.
                </p>

            `,
        })}



        <!-- =========================================================
             FALLBACK URL
        ========================================================== -->

        <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
                margin-top:
                    ${emailTheme.spacing.stackLg};
            "
        >
            <tr>

                <td>

                    <p
                        style="
                            margin:
                                0 0 6px;

                            font-family:
                                ${emailTheme.typography.body.fontFamily};

                            font-size:
                                11px;

                            line-height:
                                1.5;

                            font-weight:
                                600;

                            color:
                                ${emailTheme.colors.onSurfaceVariant};

                            text-align:
                                center;
                        "
                    >
                        Button not working?
                        Copy and paste this link
                        into your browser:
                    </p>


                    <div
                        style="
                            padding:
                                11px 13px;

                            background-color:
                                ${emailTheme.colors.surfaceContainer};

                            border:
                                1px dashed
                                ${emailTheme.colors.surfaceContainerHighest};

                            border-radius:
                                ${emailTheme.radius.sm};

                            font-family:
                                ${emailTheme.typography.body.fontFamily};

                            font-size:
                                10px;

                            line-height:
                                1.45;

                            text-align:
                                center;

                            word-break:
                                break-all;
                        "
                    >

                        <a
                            href="${safeResetUrl}"
                            style="
                                color:
                                    ${emailTheme.colors.notes.blue.steelBlue};

                                text-decoration:
                                    underline;
                            "
                        >
                            ${safeResetUrl}
                        </a>

                    </div>

                </td>

            </tr>
        </table>



        <!-- =========================================================
             SIGN OFF
        ========================================================== -->

        <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
                margin-top:
                    ${emailTheme.spacing.stackLg};
            "
        >
            <tr>

                <td align="center">

                    <div
                        style="
                            width:
                                42px;

                            height:
                                3px;

                            margin:
                                0 auto 13px;

                            border-radius:
                                ${emailTheme.radius.full};

                            background-color:
                                ${emailTheme.colors.surfaceContainerHighest};
                        "
                    >
                        &nbsp;
                    </div>


                    <p
                        style="
                            margin:
                                0 0 2px;

                            font-family:
                                ${handwrittenFont};

                            font-size:
                                21px;

                            line-height:
                                1.3;

                            color:
                                ${emailTheme.colors.onSurfaceVariant};
                        "
                    >
                        Your notes will be waiting.
                    </p>


                    <p
                        style="
                            margin: 0;

                            ${emailStyles.label}
                        "
                    >
                        The ${emailTheme.brand.name} Team
                    </p>

                </td>

            </tr>
        </table>

        `,
    });
};
