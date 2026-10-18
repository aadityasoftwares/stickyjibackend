import { CurrencyModel } from "../models/currency.model.js";
import { CurrencyCode, CurrencyType } from "../constants/currency.enums.js";

const CURRENCY_SEED_DATA = [
    {
        name: "Indian Rupee",
        code: CurrencyCode.INR,
        symbol: "₹",
        numericCode: "356",
        decimalPlaces: 2,
        type: CurrencyType.FIAT,
        isDefault: true,
        isSystem: true,
        isActive: true,
    },
] as const;

export const seedCurrencies = async (): Promise<void> => {
    console.log("🌱 Seeding currencies...");

    const operations: any = CURRENCY_SEED_DATA.map((currency) => ({
        updateOne: {
            filter: {
                code: currency.code,
            },
            update: {
                $set: {
                    name: currency.name,
                    symbol: currency.symbol,
                    numericCode: currency.numericCode,
                    decimalPlaces: currency.decimalPlaces,
                    type: currency.type,
                    isDefault: currency.isDefault,
                    isSystem: currency.isSystem,
                    isActive: currency.isActive,
                    updatedBy: null,
                },
                $setOnInsert: {
                    code: currency.code,
                    createdBy: null,
                },
            },
            upsert: true,
        },
    }));

    const result = await CurrencyModel.bulkWrite(operations);

    console.log("✅ Currencies seeded successfully.", {
        matched: result.matchedCount,
        modified: result.modifiedCount,
        inserted: result.upsertedCount,
    });
};
