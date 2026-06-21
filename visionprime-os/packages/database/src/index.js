"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeConnection = describeConnection;
function describeConnection(config) {
    return `database package placeholder — would connect using: ${maskUrl(config.url)}`;
}
function maskUrl(url) {
    return url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:****@");
}
