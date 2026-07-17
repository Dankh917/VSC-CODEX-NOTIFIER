"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSoundPath = resolveSoundPath;
exports.volumeToUnitInterval = volumeToUnitInterval;
exports.volumeToMpg123Scale = volumeToMpg123Scale;
const path = __importStar(require("node:path"));
const node_url_1 = require("node:url");
function resolveSoundPath(configuredPath, bundledPath, workspacePath, homePath) {
    let candidate = configuredPath.trim();
    if (!candidate) {
        return bundledPath;
    }
    if (/^file:/i.test(candidate)) {
        return (0, node_url_1.fileURLToPath)(candidate);
    }
    if (/^~(?=$|[\\/])/.test(candidate)) {
        candidate = path.join(homePath, candidate.slice(1));
    }
    if (path.isAbsolute(candidate)) {
        return path.normalize(candidate);
    }
    return path.resolve(workspacePath ?? homePath, candidate);
}
function volumeToUnitInterval(volumePercent) {
    return (clampVolume(volumePercent) / 100).toFixed(2);
}
function volumeToMpg123Scale(volumePercent) {
    return Math.round(32768 * clampVolume(volumePercent) / 100).toString();
}
function clampVolume(volumePercent) {
    if (!Number.isFinite(volumePercent)) {
        return 0;
    }
    return Math.min(Math.max(volumePercent, 0), 100);
}
//# sourceMappingURL=sound.js.map