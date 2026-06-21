"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNoopJobQueue = createNoopJobQueue;
function createNoopJobQueue() {
    return {
        async enqueue(job) {
            void job;
        },
    };
}
