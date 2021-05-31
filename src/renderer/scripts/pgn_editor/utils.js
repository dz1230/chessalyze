"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectedVariation = exports.variationOf = exports.moveAt = exports.indexOfVariation = exports.indexOf = exports.indexInVariation = exports.ravLevel = exports.fenOf = void 0;
const fen_1 = require("chessops/fen");
const state_1 = require("../../scripts/pgn_editor/state");
exports.fenOf = (game) => {
    if (game === null)
        return fen_1.INITIAL_FEN;
    return game.headers ? (game.headers.some(h => h.name === 'SetUp' && h.value === '1') ? game.headers.find(h => h.name === 'FEN').value : fen_1.INITIAL_FEN) : fen_1.INITIAL_FEN;
};
exports.ravLevel = (rav, parent) => {
    if (rav === parent)
        return 0;
    for (let i = 0; i < parent.moves.length; i++) {
        const move = parent.moves[i];
        if (move.ravs === undefined)
            continue;
        for (let j = 0; j < move.ravs.length; j++) {
            const rav1 = move.ravs[j];
            const level = exports.ravLevel(rav, rav1);
            if (level >= 0)
                return level + 1;
        }
    }
    return -1;
};
exports.indexInVariation = (variation, move) => {
    for (let i = 0; i < variation.moves.length; i++) {
        const varMove = variation.moves[i];
        if (varMove === move)
            return [i];
        if (varMove.ravs !== undefined) {
            for (let j = 0; j < varMove.ravs.length; j++) {
                const rav = varMove.ravs[j];
                const idx = exports.indexInVariation(rav, move);
                if (idx[0] > -1) {
                    return [i, j].concat(idx);
                }
            }
        }
    }
    return [-1];
};
exports.indexOf = (move) => {
    if (move === null || state_1.state.selected.game === null)
        return [-1];
    return exports.indexInVariation(state_1.state.selected.game, move);
};
exports.indexOfVariation = (variation) => {
    if (variation.moves.length === 0)
        return null;
    let idx = exports.indexOf(variation.moves[0]);
    idx.pop();
    return idx;
};
exports.moveAt = (index) => {
    if (state_1.state.selected.game === null)
        return null;
    let move = null;
    for (let i = -1; i < index.length; i += 2) {
        const variation = i < 0 ? state_1.state.selected.game : move.ravs[index[i]];
        move = variation.moves[index[i + 1]];
    }
    return move === undefined ? null : move;
};
exports.variationOf = (move) => {
    const index = exports.indexOf(move);
    let variation = state_1.state.selected.game;
    let m = variation.moves[index[0]];
    for (let i = 1; i < index.length; i += 2) {
        variation = m.ravs[index[i]];
        m = variation.moves[index[i + 1]];
    }
    return variation;
};
exports.selectedVariation = () => {
    const idx = state_1.state.selected.moveIndex;
    const out = { moves: [] };
    if (state_1.state.selected.game === null || state_1.state.selected.move === null)
        return out;
    let variation = null;
    let m = null;
    for (let i = -1; i < idx.length; i += 2) {
        variation = i < 0 ? state_1.state.selected.game : m.ravs[idx[i]];
        out.moves.push(...variation.moves.slice(0, idx[i + 1]));
        m = variation.moves[idx[i + 1]];
    }
    out.moves.push(state_1.state.selected.move);
    return out;
};
