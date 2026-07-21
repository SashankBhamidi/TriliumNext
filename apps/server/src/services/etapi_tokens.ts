import { BEtapiToken } from "@triliumnext/core";
import crypto from "crypto";

import { becca } from "@triliumnext/core";
import { fromBase64, randomSecureToken, constantTimeCompare } from "./utils.js";

function getTokens() {
    return becca.getEtapiTokens();
}

function getTokenHash(token: crypto.BinaryLike) {
    return crypto.createHash("sha256").update(token).digest("base64");
}

function createToken(tokenName: string, userId: string) {
    const token = randomSecureToken(32);
    const tokenHash = getTokenHash(token);

    const etapiToken = new BEtapiToken({
        name: tokenName,
        tokenHash,
        userId
    }).save();

    return {
        authToken: `${etapiToken.etapiTokenId}_${token}`
    };
}

function parseAuthToken(auth: string | undefined) {
    if (!auth) {
        return null;
    }

    if (auth.startsWith("Basic ")) {
        // allow also basic auth format for systems which allow this type of authentication
        // expect ETAPI token in the password field, require "etapi" username
        // https://github.com/zadam/trilium/issues/3181
        const basicAuthStr = fromBase64(auth.substring(6)).toString("utf-8");
        const basicAuthChunks = basicAuthStr.split(":");

        if (basicAuthChunks.length !== 2) {
            return null;
        }

        if (basicAuthChunks[0] !== "etapi") {
            return null;
        }

        auth = basicAuthChunks[1];
    }

    if (auth.startsWith("Bearer ")) {
        // allow also bearer auth format
        auth = auth.substring(7);
    }

    const chunks = auth.split("_");

    if (chunks.length === 1) {
        return { token: auth }; // legacy format without etapiTokenId
    } else if (chunks.length === 2) {
        return {
            etapiTokenId: chunks[0],
            token: chunks[1]
        };
    } else {
        return null; // wrong format
    }
}

function getTokenFromAuthHeader(auth: string | undefined): BEtapiToken | null {
    const parsed = parseAuthToken(auth);

    if (!parsed) {
        return null;
    }

    const authTokenHash = getTokenHash(parsed.token);

    if (parsed.etapiTokenId) {
        const etapiToken = becca.getEtapiToken(parsed.etapiTokenId);

        if (!etapiToken) {
            return null;
        }

        return constantTimeCompare(etapiToken.tokenHash, authTokenHash) ? etapiToken : null;
    } else {
        // Check ALL tokens to prevent timing attacks - do not short-circuit
        let matched: BEtapiToken | null = null;
        for (const etapiToken of becca.getEtapiTokens()) {
            if (constantTimeCompare(etapiToken.tokenHash, authTokenHash)) {
                matched = etapiToken;
            }
        }
        return matched;
    }
}

function getUserIdForToken(auth: string | undefined): string | null {
    return getTokenFromAuthHeader(auth)?.userId ?? null;
}

function renameToken(etapiTokenId: string, newName: string) {
    const etapiToken = becca.getEtapiToken(etapiTokenId);

    if (!etapiToken) {
        throw new Error(`Token '${etapiTokenId}' does not exist`);
    }

    etapiToken.name = newName;
    etapiToken.save();
}

function deleteToken(etapiTokenId: string) {
    const etapiToken = becca.getEtapiToken(etapiTokenId);

    if (!etapiToken) {
        return; // ok, already deleted
    }

    etapiToken.markAsDeletedSimple();
}

export default {
    getTokens,
    createToken,
    renameToken,
    deleteToken,
    parseAuthToken,
    getTokenFromAuthHeader,
    getUserIdForToken
};
