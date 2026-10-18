import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";
import { changeSubscriptionPlanSchema } from "./usersubscription.schema.js";

export const changeSubscriptionPlanValidation = validateUsingZOD(changeSubscriptionPlanSchema);
