import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "@/lib/db";
import { checkout, polar, portal } from "@polar-sh/better-auth";
import { polarClient } from "./polar";
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql", // or "mysql", "postgresql", ...etc
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  plugins: [
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: [
        portal(),
        checkout({
          products: [
            {
              productId: "095f6166-6708-4137-a6a1-780b0bc08917",
              slug: "Nodebase", // Custom slug for easy reference in Checkout URL, e.g. /checkout/Nodebase
            },
          ],
          successUrl: process.env.POLAR_CHECKOUT_SUCCESS_URL,
          authenticatedUsersOnly: true,
        }),
      ],
    }),
  ],
  // secret: process.env.BETTER_AUTH_SECRET!,
  // baseUrl: process.env.BETTER_AUTH_URL!,
});
