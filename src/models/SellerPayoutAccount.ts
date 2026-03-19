import mongoose, { Document, Schema } from "mongoose";

export interface ISellerPayoutAccount extends Document {
  userId: mongoose.Types.ObjectId;
  accountType: "BANK_ACCOUNT" | "CARD" | "WALLET";
  holderName: string;
  bankName?: string | null;
  accountNumberMasked: string;
  routingOrBankCode?: string | null;
  country?: string | null;
  currency: string;
  isVerified: boolean;
  isDefault: boolean;
  encryptedPayload?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const SellerPayoutAccountSchema = new Schema<ISellerPayoutAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    accountType: { type: String, enum: ["BANK_ACCOUNT", "CARD", "WALLET"], required: true, index: true },
    holderName: { type: String, required: true, trim: true },
    bankName: { type: String, trim: true, default: null },
    accountNumberMasked: { type: String, required: true, trim: true },
    routingOrBankCode: { type: String, trim: true, default: null },
    country: { type: String, trim: true, uppercase: true, default: null },
    currency: { type: String, default: "USD", trim: true },
    isVerified: { type: Boolean, default: false, index: true },
    isDefault: { type: Boolean, default: false, index: true },
    encryptedPayload: { type: String, default: null }
  },
  { timestamps: true, collection: "seller_payout_accounts" }
);

export const SellerPayoutAccount = mongoose.model<ISellerPayoutAccount>(
  "SellerPayoutAccount",
  SellerPayoutAccountSchema
);
