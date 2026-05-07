import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

const ALLOWED_EMAILS = new Set([
  "contact@lonewolfaisolutions.com",
  "sammipetersen1720@yahoo.co.nz",
]);

const isAllowed = (email: string | undefined | null): boolean =>
  !!email && ALLOWED_EMAILS.has(email.trim().toLowerCase());

// Email + password auth via Convex Auth's built-in Password provider.
// Convex hashes/salts the password server-side; we just gate sign-up by
// the allow-list so only the two known emails can ever create accounts.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = (params.email as string | undefined) ?? "";
        return { email: email.toLowerCase().trim() };
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      const email = args.profile.email as string | undefined;
      if (!isAllowed(email)) {
        throw new Error("This email is not authorised for the Uni Citation Tool.");
      }
      if (args.existingUserId) return args.existingUserId;
      return await ctx.db.insert("users", {
        email: email!.toLowerCase().trim(),
      });
    },
  },
});
