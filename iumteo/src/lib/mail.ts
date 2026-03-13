import nodemailer from 'nodemailer';
import { queueMailOutbox } from '@/lib/firestore-mirror';
import type { MailOutboxEntry } from '@/lib/domain';

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendManagedMail(entry: MailOutboxEntry) {
  const transporter = createTransport();

  if (!transporter) {
    await queueMailOutbox({ ...entry, status: 'SKIPPED', errorMessage: 'SMTP is not configured.' });
    return { sent: false, skipped: true };
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: entry.to,
      subject: entry.subject,
      html: entry.html,
    });

    await queueMailOutbox({ ...entry, status: 'SENT', sentAt: new Date().toISOString() });
    return { sent: true, skipped: false };
  } catch (error) {
    await queueMailOutbox({
      ...entry,
      status: 'FAILED',
      errorMessage: error instanceof Error ? error.message : 'Unknown mail error',
    });
    throw error;
  }
}
