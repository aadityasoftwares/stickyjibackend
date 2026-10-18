import mongoose, { Schema } from "mongoose";
import type { Document, Model, Types } from "mongoose";
export interface IStickyNoteCounter {
  workspaceId: Types.ObjectId;
  key: string;
  sequence: number;
  createdAt?: Date;
  updatedAt?: Date;
}
export interface IStickyNoteCounterDocument
  extends IStickyNoteCounter, Document {
  _id: Types.ObjectId;
}
const StickyNoteCounterSchema = new Schema<IStickyNoteCounterDocument>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    key: { type: String, required: true, trim: true },
    sequence: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false },
);
StickyNoteCounterSchema.index(
  { workspaceId: 1, key: 1 },
  { name: "counter_workspace_key_unique", unique: true },
);
// Keep the existing collection: renaming the model must not reset saved sequences.
export const StickyNoteCounterModel: Model<IStickyNoteCounterDocument> =
  (mongoose.models.StickyNoteCounter as
    Model<IStickyNoteCounterDocument> | undefined) ??
  mongoose.model<IStickyNoteCounterDocument>(
    "StickyNoteCounter",
    StickyNoteCounterSchema,
    "counters",
  );
