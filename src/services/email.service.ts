import nodemailer, { type Transporter } from "nodemailer";
import ejs from "ejs";
import path from "path";

const TEMPLATES_DIR = path.join(__dirname, "templates");

interface MailConfig {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
}

export interface WorkspaceInvitationData {
    appName: string;
    appUrl: string;
    currentYear: number;
    unsubscribeUrl: string;

    recipientName: string | null;
    recipientEmail: string;

    inviterName: string;
    inviterEmail: string;
    inviterInitials: string;

    workspaceName: string;

    roleName: string;

    roleBadge: "admin" | "member" | "viewer" | "editor";
    roleDescription?: string;

    invitationUrl: string;
    expiresAt: string;
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .slice(0, 2)
        .map((n: any) => n[0].toUpperCase())
        .join("");
}

function formatExpiry(date: Date): string {
    return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
}

export class EmailService {
    private transporter: Transporter;
    private fromAddress: string;

    constructor(config: MailConfig, fromAddress: string) {
        this.transporter = nodemailer.createTransport(config);
        this.fromAddress = fromAddress;
    }

    private async render(template: string, data: Record<string, unknown>): Promise<string> {
        const file = path.join(TEMPLATES_DIR, `${template}.ejs`);
        return ejs.renderFile(file, data, { async: false });
    }

    private async send(to: string, subject: string, html: string): Promise<void> {
        await this.transporter.sendMail({
            from: this.fromAddress,
            to,
            subject,
            html,
            text: html
                .replace(/<[^>]+>/g, " ")
                .replace(/\s{2,}/g, " ")
                .trim(),
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public mailers (one per email type)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Send a workspace invitation email.
     *
     * @example
     * await emailService.sendWorkspaceInvitation({
     *   invitation: invitationDoc,
     *   workspace:  workspaceDoc,
     *   inviter:    inviterUser,
     * });
     */
    async sendWorkspaceInvitation(params: {
        invitation: {
            email: string;
            token: string;
            expiresAt: Date;
            role: { name: string };
        };
        workspace: { name: string };
        inviter: { name: string; email: string };
        appName?: string;
        appUrl?: string;
    }): Promise<void> {
        const {
            invitation,
            workspace,
            inviter,
            appName = process.env.APP_NAME,
            appUrl = process.env.APP_URL,
        } = params;

        const roleName = invitation.role.name;

        const roleBadgeMap: Record<string, WorkspaceInvitationData["roleBadge"]> = {
            admin: "admin",
            owner: "admin",
            editor: "editor",
            member: "member",
            viewer: "viewer",
        };
        const roleBadge = roleBadgeMap[roleName.toLowerCase()] ?? "member";

        const data: any = {
            appName,
            appUrl,
            currentYear: new Date().getFullYear(),
            unsubscribeUrl: `${appUrl}/unsubscribe`,

            recipientName: invitation.email.split("@")[0] || null,
            recipientEmail: invitation.email,

            inviterName: inviter.name,
            inviterEmail: inviter.email,
            inviterInitials: getInitials(inviter.name),

            workspaceName: workspace.name,

            roleName,
            roleBadge,
            roleDescription: this.roleDescriptions[roleName.toLowerCase()],

            invitationUrl: `${appUrl}/invite/accept?token=${invitation.token}`,
            expiresAt: formatExpiry(invitation.expiresAt),
        };

        const html = await this.render("workspace-invitation", data);
        const subject = `${inviter.name} invited you to join ${workspace.name} on ${appName}`;

        await this.send(invitation.email, subject, html);
    }

    /** Human-readable role descriptions shown as a feature bullet */
    private roleDescriptions: Record<string, string> = {
        admin: "Full admin privileges: manage members, billing, and workspace settings",
        owner: "Owner-level access: complete control over this workspace",
        editor: "Create and edit content, manage projects and tasks",
        member: "Access all team resources, collaborate on shared projects",
        viewer: "Read-only access to workspace content and reports",
    };
}

// ─── Singleton factory (use in Express app) ────────────────────────────────

let _emailService: EmailService | null = null;

export function getEmailService(): EmailService {
    if (!_emailService) {
        _emailService = new EmailService(
            {
                host: process.env.SMTP_HOST ?? "smtp.example.com",
                port: Number(process.env.SMTP_PORT ?? 587),
                secure: process.env.SMTP_SECURE === "true",
                auth: {
                    user: process.env.SMTP_USER ?? "",
                    pass: process.env.SMTP_PASS ?? "",
                },
            },
            process.env.MAIL_FROM ?? `"${process.env.APP_NAME}" <no-reply@yourapp.com>`,
        );
    }
    return _emailService;
}
