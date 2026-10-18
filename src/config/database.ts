import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGO_URI as string;

export async function connectDatabase(uri?: string): Promise<void> {
    try {
        const targetUri = uri || MONGO_URI;
        if (!targetUri) {
            throw new Error("MONGO_URI environment variable is required to connect to MongoDB.");
        }
        await mongoose.connect(targetUri);
        console.log("MongoDB connected successfully");
    } catch (error) {
        console.error("MongoDB connection failed:", error);
        throw error;
    }
}
