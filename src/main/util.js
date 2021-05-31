"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getParsedPGN = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const process_1 = require("process");
const pgnParser = require('pgn-parser');
async function getParsedPGN(pgnPath) {
    if (pgnPath === null)
        return null;
    const fullPgnPath = path_1.isAbsolute(pgnPath) ? pgnPath : path_1.join(process_1.cwd(), pgnPath);
    if (!fs_1.existsSync(fullPgnPath)) {
        console.error('Error: ' + fullPgnPath + ' not found');
        return null;
    }
    let pgn = '', parsedPgn = null;
    try {
        pgn = await promises_1.readFile(fullPgnPath, { encoding: 'utf-8' });
        parsedPgn = pgnParser.parse(pgn);
    }
    catch (error) {
        console.error(error);
        return null;
    }
    return parsedPgn;
}
exports.getParsedPGN = getParsedPGN;
