import dotenv from "dotenv";
dotenv.config();

import nodemailer from "nodemailer";
import { Resend } from "resend";

export const resend =
    new Resend(
        process.env.RESEND_API_KEY,
    );

export const smtpTransporter =
    nodemailer.createTransport({
        service:
            "gmail",

        auth: {
            user:
                process.env.SMTP_USER,

            pass:
                process.env.SMTP_PASS,
        },
    });

export const smtpSender =
    process.env.SMTP_FROM ||
    `MyMessyNotes <${process.env.SMTP_USER}>`;

export const mailSender = {
    name:
        process.env.MAIL_FROM_NAME ||
        "MyMessyNotes",

    email:
        process.env.MAIL_FROM_EMAIL ||
        "onboarding@resend.dev",
};

export const formattedSender =
    `${mailSender.name} <${mailSender.email}>`;