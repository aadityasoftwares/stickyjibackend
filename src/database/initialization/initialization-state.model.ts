import mongoose, { Schema, Model, Document } from "mongoose";

export enum InitializationStatus {
    PENDING = "PENDING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
}

export interface IInitializationState {
    version: number;
    name: string;
    status: InitializationStatus;
    startedAt: Date;
    completedAt?: Date;
    executedBy: string;
    details?: Record<string, unknown>;
    error?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IInitializationStateDocument extends IInitializationState, Document {}

const InitializationStateSchema = new Schema<IInitializationStateDocument>(
    {
        version: {
            type: Number,
            required: true,
            unique: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        status: {
            type: String,
            enum: Object.values(InitializationStatus),
            required: true,
            default: InitializationStatus.PENDING,
            index: true,
        },
        startedAt: {
            type: Date,
            required: true,
            default: Date.now,
        },
        completedAt: {
            type: Date,
            default: null,
        },
        executedBy: {
            type: String,
            required: true,
            trim: true,
        },
        details: {
            type: Schema.Types.Mixed,
            default: {},
        },
        error: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
        collection: "initializationstates",
    },
);

InitializationStateSchema.index({ version: 1, status: 1 });

export const InitializationStateModel: Model<IInitializationStateDocument> =
    mongoose.model<IInitializationStateDocument>("InitializationState", InitializationStateSchema);
