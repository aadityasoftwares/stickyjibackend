import mongoose from "mongoose";
import { mongoConnectionOptions } from "./mongoConnectionOptions.js";
import dotenv from "dotenv";
import { monitorSaveCommands, savePerformanceEnabled } from "../utils/savePerformance.util.js";
dotenv.config();

const MONGO_URI = process.env.MONGO_URI as string;

export async function connectDatabase(uri?: string): Promise<void> {
    try {
        const targetUri = uri || MONGO_URI;
        if (!targetUri) {
            throw new Error("MONGO_URI environment variable is required to connect to MongoDB.");
        }
        await mongoose.connect(
            targetUri,
            mongoConnectionOptions({ monitorCommands: savePerformanceEnabled() }),
        );
        if (savePerformanceEnabled()) monitorSaveCommands(mongoose.connection.getClient());
        console.log("MongoDB connected successfully");
    } catch (error) {
        console.error("MongoDB connection failed:", error);
        throw error;
    }
}
