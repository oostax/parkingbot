import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Telegram",
      credentials: {
        telegramData: { label: "Telegram Data", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.telegramData) {
          return null;
        }

        try {
          // Parse the telegram auth data
          const telegramData = JSON.parse(credentials.telegramData) as {
            id: string | number;
            first_name?: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
          };
          
          // The ID from Telegram will be used as the unique identifier
          const { id, first_name, last_name, username, photo_url } = telegramData;
          
          if (!id) {
            throw new Error("No Telegram ID found");
          }

          // Check if user exists, if not create a new one
          let user = await prisma.user.findUnique({
            where: { id: id.toString() },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                id: id.toString(),
                firstName: first_name,
                lastName: last_name,
                username,
              },
            });
            console.log("Created new user:", user);
          } else {
            // Update user information if it has changed
            user = await prisma.user.update({
              where: { id: id.toString() },
              data: {
                firstName: first_name || user.firstName,
                lastName: last_name || user.lastName,
                username: username || user.username,
              },
            });
            console.log("Updated existing user:", user);
          }

          return {
            id: user.id,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            email: user.username ? `${user.username}@telegram.org` : undefined,
            image: photo_url,
          };
        } catch (error) {
          console.error("Error in authorize:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        // Initial sign in - set all user data in token
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
        token.createdAt = Date.now();
        console.log("JWT callback - new sign in", { user: user.id });
      } else if (trigger === "update" && token?.id) {
        // Refresh the user data on session update
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
          });
          
          if (dbUser) {
            token.name = `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim();
            token.email = dbUser.username ? `${dbUser.username}@telegram.org` : undefined;
            token.updatedAt = Date.now();
            console.log("JWT callback - session update", { user: token.id });
          }
        } catch (error) {
          console.error("Error updating JWT:", error);
        }
      } else {
        // Regular token refresh - just update timestamp
        token.refreshedAt = Date.now();
      }
      
      return token;
    },
    
    async session({ session, token }) {
      if (token && session.user) {
        // Copy data from token to session
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.image = token.picture as string;
        
        // Add additional session metadata with a safer cast
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session as any).lastRefreshed = Date.now();
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  debug: process.env.NODE_ENV === 'development',
  pages: {
    signIn: "/",
  },
}; 