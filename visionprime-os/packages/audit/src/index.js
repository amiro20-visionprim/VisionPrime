"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNoopAuditLogger = createNoopAuditLogger;
function createNoopAuditLogger() {
    return {
        async record(event) {
            // Phase 01 placeholder: no persistence yet.
            void event;
        },
    };
}
