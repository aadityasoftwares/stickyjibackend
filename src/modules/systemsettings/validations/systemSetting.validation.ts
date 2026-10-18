import {
    SystemSettingKey,
    SystemSettingCategory,
    SystemSettingValueType,
} from "../constants/systemSetting.enums.js";

export const SystemSettingValidation = {
    keys: Object.values(SystemSettingKey),
    categories: Object.values(SystemSettingCategory),
    valueTypes: Object.values(SystemSettingValueType),
};