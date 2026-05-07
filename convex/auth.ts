import { convexAuth } from "@convex-dev/auth/server";
import Resend from "@auth/core/providers/resend";

const ALLOWED_EMAILS = new Set([
  "contact@lonewolfaisolutions.com",
  "sammipetersen1720@yahoo.co.nz",
]);

const isAllowed = (email: string | undefined | null): boolean =>
  !!email && ALLOWED_EMAILS.has(email.trim().toLowerCase());

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Resend({
      from: "Uni Citation <noreply@festiverides.online>",
      apiKey: process.env.RESEND_API_KEY,
      maxAge: 60 * 30,
      async sendVerificationRequest(params) {
        const to = params.identifier;
        if (!isAllowed(to)) {
          // Silently drop — don't even send the email to non-allow-listed addresses.
          return;
        }
        const apiKey = (params.provider as { apiKey?: string }).apiKey;
        const from = (params.provider as { from?: string }).from;
        const subject = "Sign in to Uni Citation Tool";
        const html = `
          <div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; padding: 24px; max-width: 480px;">
            <h2 style="margin: 0 0 12px;">Sign in to your Uni Citation Tool</h2>
            <p style="margin: 0 0 16px; color: #444;">Click the button below to sign in. This link expires in 30 minutes.</p>
            <p style="margin: 0 0 24px;"><a href="${params.url}" style="display:inline-block;background:#0284c7;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;">Sign in</a></p>
            <p style="margin: 0 0 8px; font-size: 12px; color: #777;">If the button doesn't work, paste this link into your browser:</p>
            <p style="margin: 0; font-size: 12px; color: #777; word-break: break-all;">${params.url}</p>
          </div>
        `;
        const text = `Sign in to your Uni Citation Tool: ${params.url}\n\nThis link expires in 30 minutes.`;
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from, to, subject, html, text }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`Resend send failed (${res.status}): ${body}`);
        }
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      const email = args.profile.email as string | undefined;
      if (!isAllowed(email)) {
        throw new Error("This email is not authorised to use the Uni Citation Tool.");
      }
      if (args.existingUserId) return args.existingUserId;
      return await ctx.db.insert("users", {
        email: email!.toLowerCase().trim(),
      });
    },
  },
});
