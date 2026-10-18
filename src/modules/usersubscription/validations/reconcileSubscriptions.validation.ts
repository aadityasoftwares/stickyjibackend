import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";
import { reconcileSubscriptionsSchema } from "./usersubscription.schema.js";

export const reconcileSubscriptionsValidation = validateUsingZOD(reconcileSubscriptionsSchema);
