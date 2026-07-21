"use strict";

import dataEncryptionService from "./encryption/data_encryption";
import { getUserId } from "./context.js";

const dataKeys = new Map<string, Uint8Array>();

// Resolves the key for the currently-running request.
// Falls back to "__admin__" when no userId in CLS (startup, scheduler timeout).
function getCurrentUserId(): string {
    return getUserId() ?? "__admin__";
}

function setDataKey(decryptedDataKey: Uint8Array) {
    dataKeys.set(getCurrentUserId(), Uint8Array.from(decryptedDataKey));
}

function getDataKey() {
    return dataKeys.get(getCurrentUserId()) ?? null;
}

export function resetDataKey() {
    dataKeys.delete(getCurrentUserId());
}

export function isProtectedSessionAvailable() {
    return dataKeys.has(getCurrentUserId());
}

function encrypt(plainText: string | Uint8Array) {
    const dataKey = getDataKey();
    if (plainText === null || dataKey === null) {
        return null;
    }

    return dataEncryptionService.encrypt(dataKey, plainText);
}

function decrypt(cipherText: string | Uint8Array): Uint8Array | null {
    const dataKey = getDataKey();
    if (cipherText === null || dataKey === null) {
        return null;
    }

    return dataEncryptionService.decrypt(dataKey, cipherText) || null;
}

function decryptString(cipherText: string): string | null {
    const dataKey = getDataKey();
    if (dataKey === null) {
        return null;
    }
    return dataEncryptionService.decryptString(dataKey, cipherText);
}

let lastProtectedSessionOperationDate: number | null = null;

function touchProtectedSession() {
    if (isProtectedSessionAvailable()) {
        lastProtectedSessionOperationDate = Date.now();
    }
}

export function getLastProtectedSessionOperationDate() {
    return lastProtectedSessionOperationDate;
}

export default {
    setDataKey,
    resetDataKey,
    isProtectedSessionAvailable,
    encrypt,
    decrypt,
    decryptString,
    touchProtectedSession,
    getLastProtectedSessionOperationDate
};
