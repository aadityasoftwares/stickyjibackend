import { EmailButton } from "../components/EmailButton.js";
import { EmailCard } from "../components/EmailCard.js";
import { EmailLayout } from "../components/EmailLayout.js";
import { emailStyles } from "../config/emailStyles.js";
import { emailTheme } from "../config/emailTheme.js";

export interface WorkspaceMemberInvitationEmailProps {
    recipientName?: string;
    workspaceName: string;
    inviterName: string;
    roleName: string;
    invitationUrl: string;
    expiresAt: Date;
    message?: string | null;
}

export const workspaceMemberInvitationEmailTemplate = ({
    recipientName = "there",
    workspaceName,
    inviterName,
    roleName,
    invitationUrl,
    expiresAt,
    message = null,
}: WorkspaceMemberInvitationEmailProps): string => {
    const firstName = recipientName.trim() || "there";

    const formattedExpiry = expiresAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    return EmailLayout({
        title: `You're invited to ${workspaceName}`,
        preheader: `${inviterName} invited you to join ${workspaceName}.`,
        showHeader: true,
        showFooter: true,
        children: `
            <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
            >
                <tr>
                    <td
                        align="center"
                        style="
                            padding-bottom: ${emailTheme.spacing.stackLg};
                        "
                    >
                        <p
                            style="
                                margin: 0 0 10px;
                                font-family: ${emailTheme.typography.labelBold.fontFamily};
                                font-size: ${emailTheme.typography.labelSmall.fontSize};
                                line-height: ${emailTheme.typography.labelSmall.lineHeight};
                                font-weight: 700;
                                letter-spacing: 1px;
                                text-transform: uppercase;
                                color: ${emailTheme.colors.onSurfaceVariant};
                            "
                        >
                            WORKSPACE INVITATION
                        </p>

                        <h1
                            class="email-heading"
                            style="
                                ${emailStyles.h1}
                                max-width: 520px;
                                margin: 0 auto 12px;
                                text-align: center;
                            "
                        >
                            You're invited to join
                            ${workspaceName}
                        </h1>

                        <p
                            style="
                                ${emailStyles.bodyLarge}
                                max-width: 480px;
                                margin: 0 auto;
                                text-align: center;
                            "
                        >
                            Hi ${firstName}! ${inviterName}
                            invited you to collaborate on
                            ${workspaceName}.
                        </p>
                    </td>
                </tr>
            </table>

            ${EmailCard({
                variant: "yellow",
                content: `
                    <p
                        style="
                            margin: 0 0 8px;
                            font-family: ${emailTheme.typography.labelBold.fontFamily};
                            font-size: ${emailTheme.typography.labelSmall.fontSize};
                            line-height: ${emailTheme.typography.labelSmall.lineHeight};
                            font-weight: 700;
                            letter-spacing: 1px;
                            text-transform: uppercase;
                            color: ${emailTheme.colors.notes.yellow.goldenrod};
                        "
                    >
                        YOU'RE INVITED
                    </p>

                    <h2
                        style="
                            ${emailStyles.h3}
                            margin-bottom: 8px;
                        "
                    >
                        ${workspaceName}
                    </h2>

                    <p
                        style="
                            ${emailStyles.bodyText}
                            margin-bottom: 12px;
                        "
                    >
                        You've been invited by
                        <strong>${inviterName}</strong>
                        to join this workspace as
                        <strong>${roleName}</strong>.
                    </p>

                    ${
                        message
                            ? `
                                <p
                                    style="
                                        ${emailStyles.mutedText}
                                        margin: 0;
                                    "
                                >
                                    "${message}"
                                </p>
                            `
                            : ""
                    }
                `,
            })}

            <div
                style="
                    height: ${emailTheme.spacing.stackLg};
                    line-height: ${emailTheme.spacing.stackLg};
                "
            >
                &nbsp;
            </div>

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
                                font-size: 24px;
                                margin-bottom: 10px;
                                text-align: center;
                            "
                        >
                            Ready to collaborate?
                        </h2>

                        <p
                            style="
                                ${emailStyles.bodyText}
                                max-width: 420px;
                                margin: 0 auto 20px;
                                text-align: center;
                            "
                        >
                            Accept the invitation to join
                            the workspace and start
                            collaborating with your team.
                        </p>

                        ${EmailButton({
                            text: "Accept Invitation",
                            href: invitationUrl,
                            variant: "primary",
                        })}
                    </td>
                </tr>
            </table>

            <div
                style="
                    height: ${emailTheme.spacing.stackLg};
                    line-height: ${emailTheme.spacing.stackLg};
                "
            >
                &nbsp;
            </div>

            ${EmailCard({
                variant: "blue",
                content: `
                    <p
                        style="
                            margin: 0 0 8px;
                            font-family: ${emailTheme.typography.labelBold.fontFamily};
                            font-size: ${emailTheme.typography.labelSmall.fontSize};
                            line-height: ${emailTheme.typography.labelSmall.lineHeight};
                            font-weight: 700;
                            letter-spacing: 1px;
                            text-transform: uppercase;
                            color: ${emailTheme.colors.notes.blue.steelBlue};
                        "
                    >
                        INVITATION DETAILS
                    </p>

                    <p
                        style="
                            ${emailStyles.bodyText}
                            margin: 0 0 6px;
                        "
                    >
                        <strong>Workspace:</strong>
                        ${workspaceName}
                    </p>

                    <p
                        style="
                            ${emailStyles.bodyText}
                            margin: 0 0 6px;
                        "
                    >
                        <strong>Role:</strong>
                        ${roleName}
                    </p>

                    <p
                        style="
                            ${emailStyles.mutedText}
                            margin: 0;
                        "
                    >
                        This invitation expires on
                        ${formattedExpiry}.
                    </p>
                `,
            })}

            <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="
                    margin-top: ${emailTheme.spacing.stackLg};
                "
            >
                <tr>
                    <td align="center">
                        <p
                            style="
                                margin: 0;
                                ${emailStyles.mutedText}
                            "
                        >
                            If you weren't expecting
                            this invitation, you can
                            safely ignore this email.
                        </p>
                    </td>
                </tr>
            </table>
        `,
    });
};
