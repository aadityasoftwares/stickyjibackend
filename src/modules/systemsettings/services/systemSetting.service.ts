import type { ISystemSetting, ISystemSettingFilter } from "../interfaces/systemSetting.interface.js";
import { SystemSettingRepository } from "../repositories/systemSetting.repository.js";
import { SystemSettingMessages } from "../constants/systemSetting.messages.js";
import { AppError } from "../../../utils/errors/app.error.js";

export class SystemSettingService {
    private systemSettingRepository: SystemSettingRepository;

    constructor() {
        this.systemSettingRepository = new SystemSettingRepository();
    }

    async createSystemSetting(data: ISystemSetting) {
        const keyExists = await this.systemSettingRepository.existsByKey(data.key);

        if (keyExists) {
            throw new AppError(SystemSettingMessages.ALREADY_EXISTS, 409);
        }

        return this.systemSettingRepository.create(data);
    }

    async getSystemSettingById(id: string) {
        const setting = await this.systemSettingRepository.findById(id);

        if (!setting) {
            throw new AppError(SystemSettingMessages.NOT_FOUND, 404);
        }

        return setting;
    }

    async getSystemSettingByKey(key: string) {
        const setting = await this.systemSettingRepository.findByKey(key);

        if (!setting) {
            throw new AppError(SystemSettingMessages.NOT_FOUND, 404);
        }

        return setting;
    }

    async getSystemSettings(filters: ISystemSettingFilter = {}) {
        return this.systemSettingRepository.findAll(filters);
    }

    async getPublicSystemSettings() {
        return this.systemSettingRepository.findPublicSettings();
    }

    async updateSystemSetting(
        id: string,
        data: Partial<ISystemSetting>,
        updatedBy?: ISystemSetting["updatedBy"],
    ) {
        const setting = await this.systemSettingRepository.findById(id);

        if (!setting) {
            throw new AppError(SystemSettingMessages.NOT_FOUND, 404);
        }

        if (!setting.isEditable) {
            throw new AppError(SystemSettingMessages.NOT_EDITABLE, 403);
        }

        if (Object.keys(data).length === 0) {
            throw new AppError(SystemSettingMessages.UPDATE_REQUIRED, 400);
        }

        if (data.key !== undefined) {
            throw new AppError(SystemSettingMessages.KEY_NOT_EDITABLE, 400);
        }

        if (data.valueType !== undefined) {
            throw new AppError(SystemSettingMessages.VALUE_TYPE_NOT_EDITABLE, 400);
        }

        if (data.category !== undefined) {
            throw new AppError(SystemSettingMessages.CATEGORY_NOT_EDITABLE, 400);
        }

        const updateData: Partial<ISystemSetting> = {
            ...data,
            ...(updatedBy !== undefined ? { updatedBy } : {}),
        };

        return this.systemSettingRepository.updateById(id, updateData);
    }

    async resetSystemSetting(id: string, updatedBy?: ISystemSetting["updatedBy"]) {
        const setting = await this.systemSettingRepository.findById(id);

        if (!setting) {
            throw new AppError(SystemSettingMessages.NOT_FOUND, 404);
        }

        if (!setting.isEditable) {
            throw new AppError(SystemSettingMessages.NOT_EDITABLE, 403);
        }

        if (setting.defaultValue === null || setting.defaultValue === undefined) {
            throw new AppError(SystemSettingMessages.DEFAULT_VALUE_NOT_AVAILABLE, 400);
        }

        return this.systemSettingRepository.resetById(id, setting.defaultValue, updatedBy);
    }
}
