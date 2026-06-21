"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.z = void 0;
exports.validate = validate;
const zod_1 = require("zod");
Object.defineProperty(exports, "z", { enumerable: true, get: function () { return zod_1.z; } });
function validate(schema, input) {
    const result = schema.safeParse(input);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, fieldErrors: flattenZodError(result.error) };
}
function flattenZodError(error) {
    const fieldErrors = {};
    for (const issue of error.issues) {
        const key = issue.path.join(".") || "_root";
        fieldErrors[key] = issue.message;
    }
    return fieldErrors;
}
