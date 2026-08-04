import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const googleConfigured = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: googleConfigured ? [Google] : [],
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    jwt({ token, profile }) {
      if (profile?.sub) {
        return { ...token, sub: profile.sub };
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) {
        return { ...session, userId: token.sub };
      }
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    userId?: string;
  }
}
