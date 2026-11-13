import dotenv from "dotenv";
dotenv.config();

import nodemailer from "nodemailer";
import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

export const smtpTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export const smtpSender = process.env.SMTP_FROM || `StickyJi <${process.env.SMTP_USER}>`;

export const mailSender = {
    name: process.env.MAIL_FROM_NAME || "StickyJi",
    email: process.env.MAIL_FROM_EMAIL || "hello@stickyji.com",
};

export const formattedSender = `${mailSender.name} <${mailSender.email}>`;
export const helloSender = `${mailSender.name} <${process.env.MAIL_FROM_HELLO_EMAIL || "hello@stickyji.com"}>`;
