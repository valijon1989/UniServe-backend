import mongoose, { Document, Schema } from "mongoose";

export interface IPayoutAccount extends Document {
  ownerId: mongoose.Types.ObjectId;
  accountType?: "BANK_ACCOUNT" | "CARD" | "WALLET";
  provider: string;
  accountLabel: string;
  accountMask: string;
  holderName?: string | null;
  bankName?: string | null;
  routingOrBankCode?: string | null;
  encryptedPayload?: string | null;
  currency: string;
  countryCode?: string;
  isVerified?: boolean;
  isDefault: boolean;
  status: "ACTIVE" | "PENDING_REVIEW" | "BLOCKED";
  createdAt: Date;
  updatedAt: Date;
}

const PayoutAccountSchema = new Schema<IPayoutAccount>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    accountType: { type: String, enum: ["BANK_ACCOUNT", "CARD", "WALLET"], default: "BANK_ACCOUNT", index: true },
    provider: { type: String, required: true, trim: true },
    accountLabel: { type: String, required: true, trim: true },
    accountMask: { type: String, required: true, trim: true },
    holderName: { type: String, trim: true, default: null },
    bankName: { type: String, trim: true, default: null },
    routingOrBankCode: { type: String, trim: true, default: null },
    encryptedPayload: { type: String, default: null },
    currency: { type: String, default: "USD" },
    countryCode: { type: String, trim: true, uppercase: true },
    isVerified: { type: Boolean, default: false, index: true },
    isDefault: { type: Boolean, default: false },
    status: { type: String, enum: ["ACTIVE", "PENDING_REVIEW", "BLOCKED"], default: "PENDING_REVIEW", index: true }
  },
  { timestamps: true }
);

export const PayoutAccount = mongoose.model<IPayoutAccount>("PayoutAccount", PayoutAccountSchema);
