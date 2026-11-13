import { formattedSender, resend, smtpSender, smtpTransporter } from "../../config/emailmailer.js";

export interface SendEmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    replyTo?: string;
    from?: string;
}

export const sendEmail = async ({ to, subject, html, replyTo, from }: SendEmailOptions) => {
    const fromAddress = from || formattedSender;

    // Primary: Resend API
    if (process.env.RESEND_API_KEY) {
        try {
            const recipients = Array.isArray(to) ? to : [to];
            const { data, error } = await resend.emails.send({
                from: fromAddress,
                to: recipients,
                subject,
                html,
                ...(replyTo ? { reply_to: replyTo } : {}),
            });

            if (error) {
                console.error("Resend API error:", error);
                throw new Error(error.message || "Failed to send email via Resend.");
            }

            return {
                messageId: data?.id ?? "",
                accepted: recipients,
                rejected: [],
                response: "250 OK (Resend)",
            };
        } catch (error) {
            console.error("Resend delivery failed, attempting SMTP fallback if configured:", error);
            if (process.env.SMTP_USER && process.env.SMTP_PASS) {
                const info = await smtpTransporter.sendMail({
                    from: fromAddress,
                    to,
                    subject,
                    html,
                    ...(replyTo ? { replyTo } : {}),
                });

                return {
                    messageId: info.messageId,
                    accepted: info.accepted ?? [],
                    rejected: info.rejected ?? [],
                    response: info.response,
                };
            }
            if (error instanceof Error) {
                throw new Error(error.message);
            }
            throw new Error("Unable to send email via Resend.");
        }
    }

    // Fallback: SMTP transporter
    try {
        const info = await smtpTransporter.sendMail({
            from: fromAddress,
            to,
            subject,
            html,
            ...(replyTo ? { replyTo } : {}),
        });

        return {
            messageId: info.messageId,
            accepted: info.accepted ?? [],
            rejected: info.rejected ?? [],
            response: info.response,
        };
    } catch (error) {
        console.error("SMTP email error:", error);
        if (error instanceof Error) {
            throw new Error(error.message);
        }
        throw new Error("Unable to send email.");
    }
};
