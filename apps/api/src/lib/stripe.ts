import Stripe from "stripe";
import { PayoutPreset } from "@prisma/client";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});

// Payout splits per preset (percentages, must sum to 100)
export const PAYOUT_SPLITS: Record<PayoutPreset, { place: number; percent: number }[]> = {
  WINNER_TAKES_ALL: [{ place: 1, percent: 100 }],
  TOP_TWO: [
    { place: 1, percent: 70 },
    { place: 2, percent: 30 },
  ],
  TOP_THREE: [
    { place: 1, percent: 60 },
    { place: 2, percent: 25 },
    { place: 3, percent: 15 },
  ],
};

// Platform fee: 5%
export const PLATFORM_FEE_PERCENT = 5;

export function calculatePayouts(
  totalPotCents: number,
  preset: PayoutPreset
): { place: number; amountCents: number }[] {
  const afterFee = Math.floor(totalPotCents * (1 - PLATFORM_FEE_PERCENT / 100));
  return PAYOUT_SPLITS[preset].map(({ place, percent }) => ({
    place,
    amountCents: Math.floor(afterFee * (percent / 100)),
  }));
}
