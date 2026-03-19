import mongoose, { Document, Schema } from "mongoose";
import { LEDGER_ACCOUNT_OWNER_TYPE_VALUES, type LedgerAccountOwnerType } from "../types/paymentDomain";

export interface ILedgerAccount extends Document {
  accountOwnerType: LedgerAccountOwnerType;
  accountOwnerId?: mongoose.Types.ObjectId | null;
  accountCode: string;
  currency: string;
  balanceMinor: number;
  availableBalanceMinor: number;
  heldBalanceMinor: number;
  pendingPayoutBalanceMinor: number;
  isActive: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const LedgerAccountSchema = new Schema<ILedgerAccount>(
  {
    accountOwnerType: { type: String, enum: [...LEDGER_ACCOUNT_OWNER_TYPE_VALUES], required: true, index: true },
    accountOwnerId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    accountCode: { type: String, required: true, trim: true, index: true },
    currency: { type: String, default: "USD", trim: true, index: true },
    balanceMinor: { type: Number, required: true, default: 0, min: 0 },
    availableBalanceMinor: { type: Number, required: true, default: 0, min: 0 },
    heldBalanceMinor: { type: Number, required: true, default: 0, min: 0 },
    pendingPayoutBalanceMinor: { type: Number, required: true, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: null }
  },
  { timestamps: true, collection: "ledger_accounts" }
);

LedgerAccountSchema.index({ accountOwnerType: 1, accountOwnerId: 1, accountCode: 1, currency: 1 }, { unique: true });

export const LedgerAccount = mongoose.model<ILedgerAccount>("LedgerAccount", LedgerAccountSchema);
