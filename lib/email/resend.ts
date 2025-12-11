import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  throw new Error('RESEND_API_KEY is not set in environment variables');
}

export const resend = new Resend(resendApiKey);

export const FROM_EMAIL = 'Festive Rides <noreply@festiverides.online>';
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'sammipetersen1720@yahoo.co.nz';
