import { Types } from "mongoose";
import type {
    IPlan,
    IPlanCreate,
    IPlanResponse,
    IPlanUpdate,
    ISubscriptionPlanCard,
    ISubscriptionPlanFeature,
    ISubscriptionPlanPrice,
    ISubscriptionPlansCatalogResponse,
    IComparisonMatrixRow,
} from "../interfaces/plan.interface.js";
import { PlanModel } from "../models/plan.model.js";
import { PlanPriceModel } from "../../planprice/models/planPrice.model.js";
import { PlanFeatureModel } from "../../planfeature/models/planfeature.model.js";
import { UserSubscriptionModel } from "../../usersubscription/models/usersubscription.model.js";
import { UserSubscriptionStatus } from "../../usersubscription/constants/usersubscription.enums.js";
import { PlanRepository } from "../repositories/plan.repository.js";
import { PlanMessages } from "../constants/plan.messages.js";
import { PlanCode, PlanPricingModel, PlanType, PlanVisibility } from "../constants/plan.enums.js";
import { PLAN_CONSTANTS } from "../constants/plan.constants.js";
import { PlanValidation } from "../validations/plan.validation.js";
import { AuditLogService } from "../../auditlog/services/auditLog.service.js";
import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";
import { AuditLogAction } from "../../auditlog/constants/auditLog.enums.js";
import { AppModule } from "../../../utils/enums/appModule.enums.js";
import { AppError } from "../../../utils/errors/app.error.js";
import { AuditLogConfig } from "../../../config/auditlog.config.js";
import type { PlanListFilters } from "../validations/planList.schema.js";

export class PlanService {
    private readonly planRepository: PlanRepository;
    private readonly auditLogService: AuditLogService;

    constructor() {
        this.planRepository = new PlanRepository();
        this.auditLogService = new AuditLogService();
    }

    async getSubscriptionCatalog(userId?: string): Promise<ISubscriptionPlansCatalogResponse> {
        const [plans, prices, planFeatures] = await Promise.all([
            PlanModel.find({ isActive: true, visibility: PlanVisibility.PUBLIC })
                .sort({ sortOrder: 1, _id: 1 })
                .lean()
                .exec(),
            PlanPriceModel.find({ isActive: true })
                .populate("currencyId", "code symbol name decimalPlaces")
                .sort({ sortOrder: 1 })
                .lean()
                .exec(),
            PlanFeatureModel.find({ isEnabled: true })
                .populate("featureId", "code name description category type isActive")
                .sort({ sortOrder: 1 })
                .lean()
                .exec(),
        ]);

        let userSubscriptionInfo: ISubscriptionPlansCatalogResponse["userSubscription"] = null;
        let activePlanId: string | null = null;

        if (userId && Types.ObjectId.isValid(userId)) {
            const userSub = await UserSubscriptionModel.findOne({
                user: new Types.ObjectId(userId),
                isActive: true,
                status: {
                    $in: [UserSubscriptionStatus.ACTIVE, UserSubscriptionStatus.CANCELED],
                },
            })
                .populate("plan", "code")
                .lean()
                .exec();

            if (userSub) {
                activePlanId = userSub.plan
                    ? (userSub.plan as any)._id?.toString() || userSub.plan.toString()
                    : null;
                userSubscriptionInfo = {
                    planId: activePlanId || "",
                    planCode: (userSub.plan as any)?.code || "",
                    status: userSub.status,
                    billingInterval: userSub.billingInterval ?? null,
                    currentPeriodEnd: userSub.currentPeriodEnd ?? null,
                    cancelAtPeriodEnd: Boolean(userSub.cancelAtPeriodEnd),
                };
            }
        }

        const firstCurrency = prices[0]?.currencyId as any;
        const defaultCurrency = {
            code: firstCurrency?.code || "INR",
            symbol: firstCurrency?.symbol || "₹",
        };

        const distinctFeaturesMap = new Map<
            string,
            { code: string; name: string; description: string; category: string; type: string }
        >();

        for (const pf of planFeatures) {
            const f = pf.featureId as any;
            if (f && f.code && !distinctFeaturesMap.has(f.code)) {
                distinctFeaturesMap.set(f.code, {
                    code: f.code,
                    name: f.name,
                    description: f.description || "",
                    category: f.category || "CORE",
                    type: f.type || "BOOLEAN",
                });
            }
        }

        const mappedPlans: ISubscriptionPlanCard[] = plans.map((plan) => {
            const planIdStr = plan._id.toString();
            const isCurrent = activePlanId ? activePlanId === planIdStr : false;

            let planPrices: ISubscriptionPlanPrice[] = [];
            if (plan.type === PlanType.FREE) {
                planPrices = [
                    {
                        id: null,
                        billingInterval: "MONTHLY",
                        amountMinor: 0,
                        amountMajor: 0,
                        currency: defaultCurrency.code,
                        currencySymbol: defaultCurrency.symbol,
                        formatted: "Free",
                        monthlyEquivalent: 0,
                        savingsPercentage: 0,
                    },
                    {
                        id: null,
                        billingInterval: "YEARLY",
                        amountMinor: 0,
                        amountMajor: 0,
                        currency: defaultCurrency.code,
                        currencySymbol: defaultCurrency.symbol,
                        formatted: "Free",
                        monthlyEquivalent: 0,
                        savingsPercentage: 0,
                    },
                ];
            } else {
                const matched = prices.filter((p) => p.planId.toString() === planIdStr);
                const monthlyPrice = matched.find((p) => p.billingInterval === "MONTHLY");
                const yearlyPrice = matched.find((p) => p.billingInterval === "YEARLY");

                const monthlyMajor = monthlyPrice ? monthlyPrice.amountMinor / 100 : 0;
                const yearlyMajor = yearlyPrice ? yearlyPrice.amountMinor / 100 : 0;

                let savings = 0;
                if (monthlyMajor > 0 && yearlyMajor > 0) {
                    const annualMonthlyCost = monthlyMajor * 12;
                    if (annualMonthlyCost > yearlyMajor) {
                        savings = Math.round(((annualMonthlyCost - yearlyMajor) / annualMonthlyCost) * 100);
                    }
                }

                planPrices = matched.map((p) => {
                    const curr = p.currencyId as any;
                    const code = curr?.code || defaultCurrency.code;
                    const symbol = curr?.symbol || defaultCurrency.symbol;
                    const major = p.amountMinor / 100;
                    const isYearly = p.billingInterval === "YEARLY";
                    const monthlyEquiv = isYearly ? Math.round((major / 12) * 100) / 100 : major;

                    return {
                        id: p._id.toString(),
                        billingInterval: p.billingInterval as "MONTHLY" | "YEARLY",
                        amountMinor: p.amountMinor,
                        amountMajor: major,
                        currency: code,
                        currencySymbol: symbol,
                        formatted: `${symbol}${major}/${isYearly ? "year" : "month"}`,
                        monthlyEquivalent: monthlyEquiv,
                        savingsPercentage: isYearly ? savings : 0,
                    };
                });
            }

            const monthlyPricing = planPrices.find((p) => p.billingInterval === "MONTHLY") ?? null;
            const yearlyPricing = planPrices.find((p) => p.billingInterval === "YEARLY") ?? null;

            const matchedFeatures = planFeatures.filter((pf) => pf.planId.toString() === planIdStr);
            const featuresList: ISubscriptionPlanFeature[] = matchedFeatures.map((pf) => {
                const f = pf.featureId as any;
                const formatted = this.formatFeatureDisplay(
                    f?.code || "",
                    pf.limit,
                    pf.limitType,
                    pf.isUnlimited,
                );

                return {
                    code: f?.code || "",
                    name: f?.name || "",
                    description: f?.description || "",
                    category: f?.category || "CORE",
                    type: f?.type || "BOOLEAN",
                    isEnabled: Boolean(pf.isEnabled),
                    limit: pf.limit ?? 0,
                    limitType: pf.limitType || "NONE",
                    isUnlimited: Boolean(pf.isUnlimited),
                    formattedLimit: formatted,
                };
            });

            const featureCategories: Record<string, ISubscriptionPlanFeature[]> = {};
            for (const feat of featuresList) {
                if (!featureCategories[feat.category]) {
                    featureCategories[feat.category] = [];
                }
                featureCategories[feat.category]!.push(feat);
            }

            const highlights = this.buildPlanHighlights(plan.code, featuresList);

            let badge: string | null = null;
            if (plan.isPopular) badge = "Most Popular";
            else if (plan.type === PlanType.FREE) badge = "Free Forever";
            else if (plan.code === PlanCode.ENTERPRISE) badge = "Enterprise";

            return {
                id: planIdStr,
                name: plan.name,
                code: plan.code,
                type: plan.type,
                description: plan.description,
                badge,
                isPopular: Boolean(plan.isPopular),
                isDefault: Boolean(plan.isDefault),
                trialDays: plan.trialDays ?? 0,
                sortOrder: plan.sortOrder ?? 0,
                isCurrent,
                prices: planPrices,
                pricing: {
                    monthly: monthlyPricing,
                    yearly: yearlyPricing,
                },
                highlights,
                features: featuresList,
                featureCategories,
            };
        });

        const comparisonMatrix: IComparisonMatrixRow[] = [];
        for (const [featCode, featMeta] of distinctFeaturesMap.entries()) {
            const row: IComparisonMatrixRow = {
                featureCode: featCode,
                featureName: featMeta.name,
                category: featMeta.category,
                description: featMeta.description,
                type: featMeta.type,
                plans: {},
            };

            for (const plan of mappedPlans) {
                const pf = plan.features.find((f) => f.code === featCode);
                if (pf && pf.isEnabled) {
                    row.plans[plan.code] = {
                        included: true,
                        formattedValue: pf.formattedLimit,
                        isUnlimited: pf.isUnlimited,
                    };
                } else {
                    row.plans[plan.code] = {
                        included: false,
                        formattedValue: "-",
                        isUnlimited: false,
                    };
                }
            }

            comparisonMatrix.push(row);
        }

        return {
            plans: mappedPlans,
            billingIntervals: ["MONTHLY", "YEARLY"],
            currency: defaultCurrency,
            comparisonMatrix,
            userSubscription: userSubscriptionInfo,
        };
    }

    async createPlan(
        data: IPlanCreate,
        createdBy?: string,
        context?: IAuditLogContext,
    ): Promise<IPlanResponse> {
        this.validateAuditAction(AuditLogAction.CREATE);

        const normalizedName = PlanValidation.normalizeName(data.name);
        const normalizedCode = PlanValidation.normalizeCode(data.code);

        const codeExists = await this.planRepository.existsByCode(normalizedCode);
        if (codeExists) {
            throw new AppError(PlanMessages.ALREADY_EXISTS, 409);
        }

        const planToValidate: IPlan = {
            name: normalizedName,
            code: normalizedCode,
            description: data.description.trim(),
            type: data.type ?? PLAN_CONSTANTS.DEFAULT_TYPE,
            pricingModel: data.pricingModel ?? PLAN_CONSTANTS.DEFAULT_PRICING_MODEL,
            trialDays: data.trialDays ?? PLAN_CONSTANTS.DEFAULT_PAGE - 1,
            visibility: data.visibility ?? PLAN_CONSTANTS.DEFAULT_VISIBILITY,
            isPopular: data.isPopular ?? false,
            sortOrder: data.sortOrder ?? 0,
            isDefault: data.isDefault ?? false,
            isSystem: data.isSystem ?? false,
            isActive: data.isActive ?? true,
        };

        this.validatePlanBusinessRules(planToValidate);

        const userObjectId =
            createdBy && Types.ObjectId.isValid(createdBy) ? new Types.ObjectId(createdBy) : null;

        const plan = await this.planRepository.create({
            ...planToValidate,
            createdBy: userObjectId,
            updatedBy: userObjectId,
        });

        try {
            await this.auditLogService.logCreate(
                context ?? {},
                {
                    module: AppModule.PLAN,
                    resourceId: plan._id.toString(),
                    resourceName: plan.name,
                },
                `Plan "${plan.name}" (${plan.code}) was created successfully.`,
            );
        } catch (error) {
            await this.planRepository.deleteById(plan._id.toString());
            throw error;
        }

        return this.toPlanResponse(plan);
    }

    async getPlanById(id: string): Promise<IPlanResponse> {
        const plan = await this.planRepository.findById(id);
        if (!plan) {
            throw new AppError(PlanMessages.NOT_FOUND, 404);
        }
        return this.toPlanResponse(plan);
    }

    async getPlanByCode(code: string): Promise<IPlanResponse> {
        const normalizedCode = PlanValidation.normalizeCode(code);
        const plan = await this.planRepository.findByCode(normalizedCode);
        if (!plan) {
            throw new AppError(PlanMessages.NOT_FOUND, 404);
        }
        return this.toPlanResponse(plan);
    }

    async getPlans(filters: PlanListFilters) {
        const result = await this.planRepository.list(filters);
        return {
            data: result.data.map((plan) => this.toPlanResponse(plan)),
            pagination: result.pagination,
            counts: result.counts,
            statusFilters: result.statusFilters,
        };
    }

    async updatePlan(
        id: string,
        data: IPlanUpdate,
        updatedBy?: string,
        context?: IAuditLogContext,
    ): Promise<IPlanResponse> {
        this.validateAuditAction(AuditLogAction.UPDATE);

        const plan = await this.planRepository.findById(id);
        if (!plan) {
            throw new AppError(PlanMessages.NOT_FOUND, 404);
        }

        if (plan.isSystem) {
            throw new AppError(PlanMessages.SYSTEM_PLAN_UPDATE, 403);
        }

        if (plan.isDefault) {
            throw new AppError(PlanMessages.DEFAULT_PLAN_UPDATE, 403);
        }

        const updateData: Partial<IPlan> = {};
        const changes: Array<{ field: string; oldValue?: unknown; newValue?: unknown }> = [];

        if (data.name !== undefined) {
            const name = PlanValidation.normalizeName(data.name);
            if (name !== plan.name) {
                updateData.name = name;
                changes.push({ field: "name", oldValue: plan.name, newValue: name });
            }
        }

        if (data.code !== undefined) {
            const code = PlanValidation.normalizeCode(data.code);
            if (code !== plan.code) {
                const existing = await this.planRepository.findByCode(code);
                if (existing && existing._id.toString() !== id) {
                    throw new AppError(PlanMessages.CODE_ALREADY_EXISTS, 409);
                }
                updateData.code = code;
                changes.push({ field: "code", oldValue: plan.code, newValue: code });
            }
        }

        if (data.description !== undefined) {
            const description = data.description.trim();
            if (description !== plan.description) {
                updateData.description = description;
                changes.push({ field: "description", oldValue: plan.description, newValue: description });
            }
        }

        if (data.type !== undefined && data.type !== plan.type) {
            updateData.type = data.type;
            changes.push({ field: "type", oldValue: plan.type, newValue: data.type });
        }

        if (data.pricingModel !== undefined && data.pricingModel !== plan.pricingModel) {
            updateData.pricingModel = data.pricingModel;
            changes.push({ field: "pricingModel", oldValue: plan.pricingModel, newValue: data.pricingModel });
        }

        if (data.trialDays !== undefined && data.trialDays !== plan.trialDays) {
            updateData.trialDays = data.trialDays;
            changes.push({ field: "trialDays", oldValue: plan.trialDays, newValue: data.trialDays });
        }

        if (data.visibility !== undefined && data.visibility !== plan.visibility) {
            updateData.visibility = data.visibility;
            changes.push({ field: "visibility", oldValue: plan.visibility, newValue: data.visibility });
        }

        if (data.isPopular !== undefined && data.isPopular !== plan.isPopular) {
            updateData.isPopular = data.isPopular;
            changes.push({ field: "isPopular", oldValue: plan.isPopular, newValue: data.isPopular });
        }

        if (data.sortOrder !== undefined && data.sortOrder !== plan.sortOrder) {
            updateData.sortOrder = data.sortOrder;
            changes.push({ field: "sortOrder", oldValue: plan.sortOrder, newValue: data.sortOrder });
        }

        if (data.isDefault !== undefined && data.isDefault !== plan.isDefault) {
            updateData.isDefault = data.isDefault;
            changes.push({ field: "isDefault", oldValue: plan.isDefault, newValue: data.isDefault });
        }

        if (data.isSystem !== undefined && data.isSystem !== plan.isSystem) {
            updateData.isSystem = data.isSystem;
            changes.push({ field: "isSystem", oldValue: plan.isSystem, newValue: data.isSystem });
        }

        if (data.isActive !== undefined && data.isActive !== plan.isActive) {
            updateData.isActive = data.isActive;
            changes.push({ field: "isActive", oldValue: plan.isActive, newValue: data.isActive });
        }

        if (!changes.length) {
            return this.toPlanResponse(plan);
        }

        const mergedPlan: IPlan = {
            ...plan,
            ...updateData,
        };

        this.validatePlanBusinessRules(mergedPlan);

        const previousState = this.planSnapshot(plan);
        const userObjectId =
            updatedBy && Types.ObjectId.isValid(updatedBy) ? new Types.ObjectId(updatedBy) : null;

        const updatedPlan = await this.planRepository.updateById(id, {
            ...updateData,
            updatedBy: userObjectId,
        });

        if (!updatedPlan) {
            throw new AppError(PlanMessages.NOT_FOUND, 404);
        }

        try {
            await this.auditLogService.logUpdate(
                context ?? {},
                {
                    module: AppModule.PLAN,
                    resourceId: updatedPlan._id.toString(),
                    resourceName: updatedPlan.name,
                },
                `Plan "${updatedPlan.name}" (${updatedPlan.code}) was updated successfully.`,
                changes,
            );
        } catch (error) {
            await this.planRepository.rollbackById(id, previousState);
            throw error;
        }

        return this.toPlanResponse(updatedPlan);
    }

    async updatePlanStatus(
        id: string,
        isActive: boolean,
        updatedBy?: string,
        context?: IAuditLogContext,
    ): Promise<IPlanResponse> {
        this.validateAuditAction(AuditLogAction.STATUS_CHANGE);

        const plan = await this.planRepository.findById(id);
        if (!plan) {
            throw new AppError(PlanMessages.NOT_FOUND, 404);
        }

        if (plan.isActive === isActive) {
            return this.toPlanResponse(plan);
        }

        if (plan.isSystem) {
            throw new AppError(PlanMessages.CANNOT_DEACTIVATE_SYSTEM, 403);
        }

        if (plan.isDefault && !isActive) {
            throw new AppError(PlanMessages.CANNOT_DEACTIVATE_DEFAULT, 403);
        }

        const oldStatus = plan.isActive;
        const previousState = this.planSnapshot(plan);
        const userObjectId =
            updatedBy && Types.ObjectId.isValid(updatedBy) ? new Types.ObjectId(updatedBy) : null;

        const updatedPlan = await this.planRepository.updateStatus(id, isActive, userObjectId);
        if (!updatedPlan) {
            throw new AppError(PlanMessages.NOT_FOUND, 404);
        }

        try {
            await this.auditLogService.logStatusChange(
                context ?? {},
                {
                    module: AppModule.PLAN,
                    resourceId: updatedPlan._id.toString(),
                    resourceName: updatedPlan.name,
                },
                "isActive",
                oldStatus,
                isActive,
                `Plan "${updatedPlan.name}" (${updatedPlan.code}) status changed from ${oldStatus ? "active" : "inactive"} to ${isActive ? "active" : "inactive"}.`,
            );
        } catch (error) {
            await this.planRepository.rollbackById(id, previousState);
            throw error;
        }

        return this.toPlanResponse(updatedPlan);
    }

    // Retained for backwards compatibility
    async changePlanStatus(
        id: string,
        isActive: boolean,
        context?: IAuditLogContext,
    ): Promise<IPlanResponse> {
        return this.updatePlanStatus(id, isActive, undefined, context);
    }

    async deletePlan(id: string, context?: IAuditLogContext): Promise<void> {
        this.validateAuditAction(AuditLogAction.DELETE);

        const plan = await this.planRepository.findById(id);
        if (!plan) {
            throw new AppError(PlanMessages.NOT_FOUND, 404);
        }

        if (plan.isSystem) {
            throw new AppError(PlanMessages.SYSTEM_PLAN_DELETE, 403);
        }

        if (plan.isDefault) {
            throw new AppError(PlanMessages.DEFAULT_PLAN_DELETE, 403);
        }

        const deletedPlan = await this.planRepository.deleteById(id);
        if (!deletedPlan) {
            throw new AppError(PlanMessages.NOT_FOUND, 404);
        }

        await this.auditLogService.logDelete(
            context ?? {},
            {
                module: AppModule.PLAN,
                resourceId: plan._id.toString(),
                resourceName: plan.name,
            },
            `Plan "${plan.name}" (${plan.code}) was deleted successfully.`,
        );
    }

    private formatFeatureDisplay(
        code: string,
        limit?: number | null,
        limitType?: string | null,
        isUnlimited?: boolean | null,
    ): string {
        if (isUnlimited) return "Unlimited";

        const numericLimit = limit ?? 0;

        if (limitType === "STORAGE" || code.includes("BYTES")) {
            if (numericLimit >= 1073741824) return `${Math.round(numericLimit / 1073741824)} GB`;
            if (numericLimit >= 1048576) return `${Math.round(numericLimit / 1048576)} MB`;
            return `${numericLimit} Bytes`;
        }

        if (code === "MAX_WORKSPACES") return `${numericLimit} Workspace${numericLimit > 1 ? "s" : ""}`;
        if (code === "MAX_FOLDERS_PER_WORKSPACE") return `${numericLimit} Folders/workspace`;
        if (code === "MAX_ACTIVE_STICKY_NOTES") return `${numericLimit.toLocaleString()} Sticky Notes`;
        if (code === "MAX_USERS") return `${numericLimit} Seat${numericLimit > 1 ? "s" : ""}`;

        if (numericLimit > 0) return `${numericLimit.toLocaleString()}`;
        return "Included";
    }

    private buildPlanHighlights(planCode: string, features: ISubscriptionPlanFeature[]): string[] {
        const highlights: string[] = [];

        const ws = features.find((f) => f.code === "MAX_WORKSPACES");
        if (ws) highlights.push(ws.formattedLimit);

        const notes = features.find((f) => f.code === "MAX_ACTIVE_STICKY_NOTES");
        if (notes) highlights.push(notes.formattedLimit);

        const storage = features.find((f) => f.code === "MAX_STORAGE_BYTES");
        if (storage) highlights.push(`${storage.formattedLimit} Cloud Storage`);

        const upload = features.find((f) => f.code === "MAX_UPLOAD_BYTES");
        if (upload) highlights.push(`${upload.formattedLimit} Max File Size`);

        if (planCode === "FREE") {
            highlights.push("Kanban Boards & Checklists");
        } else if (planCode === "PRO" || planCode === "TEAM") {
            highlights.push("Team Member Collaboration & Roles");
            highlights.push("Activity & Audit History");
        } else {
            highlights.push("Search & Productivity Filters");
        }

        return highlights;
    }

    private validatePlanBusinessRules(data: IPlan): void {
        if (data.type === PlanType.CUSTOM && data.pricingModel === PlanPricingModel.FIXED) {
            throw new AppError(PlanMessages.CUSTOM_PLAN_PRICE, 400);
        }

        if (data.trialDays < 0 || !Number.isInteger(data.trialDays)) {
            throw new AppError(PlanMessages.INVALID_TRIAL_DAYS, 400);
        }

        if (data.type === PlanType.FREE && data.trialDays !== 0) {
            throw new AppError(PlanMessages.FREE_PLAN_TRIAL_INVALID, 400);
        }
    }

    private validateAuditAction(action: AuditLogAction): void {
        const moduleConfig = AuditLogConfig[AppModule.PLAN];
        if (!moduleConfig || !moduleConfig.actions.includes(action)) {
            throw new AppError(`Action ${action} is not allowed for module ${AppModule.PLAN}.`, 400);
        }
    }

    private planSnapshot(plan: any): Record<string, unknown> {
        return {
            name: plan.name,
            code: plan.code,
            description: plan.description,
            type: plan.type,
            pricingModel: plan.pricingModel,
            trialDays: plan.trialDays,
            visibility: plan.visibility,
            isPopular: plan.isPopular,
            sortOrder: plan.sortOrder,
            isDefault: plan.isDefault,
            isSystem: plan.isSystem,
            isActive: plan.isActive,
            updatedBy: plan.updatedBy ?? null,
            updatedAt: plan.updatedAt,
        };
    }

    private toPlanResponse(plan: any): IPlanResponse {
        return {
            id: plan._id.toString(),
            name: plan.name,
            code: plan.code,
            description: plan.description,
            type: plan.type,
            pricingModel: plan.pricingModel,
            trialDays: plan.trialDays ?? 0,
            visibility: plan.visibility,
            isPopular: Boolean(plan.isPopular),
            sortOrder: plan.sortOrder ?? 0,
            isDefault: Boolean(plan.isDefault),
            isSystem: Boolean(plan.isSystem),
            isActive: Boolean(plan.isActive),
            createdBy: plan.createdBy ? plan.createdBy.toString() : null,
            updatedBy: plan.updatedBy ? plan.updatedBy.toString() : null,
            createdAt: plan.createdAt,
            updatedAt: plan.updatedAt,
        };
    }
}
