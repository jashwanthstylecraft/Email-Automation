import nodemailer from 'nodemailer';

/**
 * Sends an email using the SMTP settings configured in the .env environment.
 * If credentials are not present, it logs the outgoing email details for simulation.
 */
export async function sendOutgoingMail(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);

  console.log(`[SMTP Mail Dispatch Request]: To: ${to}, Subject: ${subject}`);

  if (!smtpUser || !smtpPassword || !smtpHost) {
    console.log('------------------------------------------------------------');
    console.log('[SMTP Dispatch Bypass (Development Mode - Keys Missing)]');
    console.log(`Recipient: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Message Body:\n${body}`);
    console.log('------------------------------------------------------------');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // SSL for 465, STARTTLS for 587
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    const info = await transporter.sendMail({
      from: `"StyleCraft Support" <${smtpUser}>`,
      to,
      subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
      text: body,
      html: `<div style="font-family: sans-serif; white-space: pre-wrap; line-height: 1.6; color: #1f2937;">${body}</div>`,
    });

    console.log(`[SMTP Dispatch Success]: Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('[SMTP Dispatch Failure]: Failed to send outgoing mail:', error);
    throw error;
  }
}
