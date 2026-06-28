import nodemailer from "nodemailer";
import { execFileSync } from "node:child_process";

let transporter: nodemailer.Transporter | null = null;

function getGmailAppPassword(): string {
  if (process.env.GMAIL_APP_PASSWORD) {
    return process.env.GMAIL_APP_PASSWORD;
  }

  const user = process.env.GMAIL_USER;
  const service = process.env.GMAIL_KEYCHAIN_SERVICE;

  if (!user || !service) {
    throw new Error(
      "Set GMAIL_USER and either GMAIL_APP_PASSWORD or GMAIL_KEYCHAIN_SERVICE"
    );
  }

  return execFileSync(
    "/usr/bin/security",
    ["find-generic-password", "-a", user, "-s", service, "-w"],
    { encoding: "utf8" }
  ).trim();
}

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: getGmailAppPassword(),
      },
    });
  }
  return transporter;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const transport = getTransporter();

    await transport.sendMail({
      from: `"MovieTracker" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log(`[Email] Sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error(
      `[Email] Failed to send to ${to}:`,
      error instanceof Error ? error.message : error
    );
    return false;
  }
}
