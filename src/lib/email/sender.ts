import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
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

    const info = await transport.sendMail({
      from: `"MovieTracker" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });

    const messageId =
      typeof info === "object" &&
      info !== null &&
      "messageId" in info &&
      typeof info.messageId === "string"
        ? ` messageId=${info.messageId}`
        : "";

    console.log(`[Email] Sent to ${to}: ${subject}${messageId}`);
    return true;
  } catch (error) {
    console.error(
      `[Email] Failed to send to ${to}:`,
      error instanceof Error ? error.message : error
    );
    return false;
  }
}
