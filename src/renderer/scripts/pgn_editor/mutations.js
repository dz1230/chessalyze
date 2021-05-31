"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPgn = exports.deleteVariation = exports.moveVariation = exports.deleteGame = exports.appendGame = exports.deleteMove = exports.appendMove = void 0;
const util_1 = require("chessops/util");
const san_1 = require("chessops/san");
const pgn_1 = require("../../../common/pgn");
const state_1 = require("../../scripts/pgn_editor/state");
const utils_1 = require("../../scripts/pgn_editor/utils");
const tags_1 = require("../../scripts/pgn_editor/tags");
const gamelist_1 = require("../../scripts/pgn_editor/gamelist");
const selection_1 = require("../../scripts/pgn_editor/selection");
const movelist_1 = require("../../scripts/pgn_editor/movelist");
const checkForGameEnd = () => {
    if (state_1.state.chess.isEnd()) {
        tags_1.tags.set('Result', state_1.state.chess.isCheckmate() ? (state_1.state.chess.turn === "white" ? '1-0' : '0-1') : '1/2-1/2');
        tags_1.tags.set('Termination', 'normal');
        return true;
    }
    tags_1.tags.set('Result', '*');
    if (tags_1.tags.has('Termination'))
        tags_1.tags.set('Termination', 'unterminated');
    return false;
};
exports.appendMove = (move) => {
    if (state_1.state.selected.next !== null) {
        if (util_1.makeUci(san_1.parseSan(state_1.state.chess, state_1.state.selected.next.move)) === util_1.makeUci(san_1.parseSan(state_1.state.chess, move.move))) {
            //move is the next one in the current variation
            selection_1.selection.selectMove(state_1.state.selected.next);
            return;
        }
        if (state_1.state.selected.next.ravs !== undefined && state_1.state.selected.next.ravs !== null) {
            for (const rav of state_1.state.selected.next.ravs) {
                if (rav.moves.length > 0 && rav.moves[0] && util_1.makeUci(san_1.parseSan(state_1.state.chess, move.move)) === util_1.makeUci(san_1.parseSan(state_1.state.chess, rav.moves[0].move))) {
                    //move is the next one in a different variation
                    selection_1.selection.selectMove(rav.moves[0]);
                    return;
                }
            }
        }
        //move is a new variation
        move.move_number = state_1.state.selected.next.move_number;
        if (move.move_number === undefined)
            move.move_number = state_1.state.selected.move.move_number;
        move.isFirstInVariation = true;
        move.isBlackMove = state_1.state.selected.next.isBlackMove;
        if (state_1.state.selected.next.ravs === undefined || state_1.state.selected.next.ravs === null)
            state_1.state.selected.next.ravs = [];
        state_1.state.selected.next.ravs.push({ moves: [move] });
        const selectedVariation = utils_1.variationOf(state_1.state.selected.next);
        const next2 = selectedVariation.moves[selectedVariation.moves.indexOf(state_1.state.selected.next) + 1];
        if (next2 !== undefined && next2.isBlackMove)
            next2.move_number = state_1.state.selected.next.move_number;
        movelist_1.movelist.insertLastVariationOf(state_1.state.selected.next);
        selection_1.selection.selectMove(move);
        return;
    }
    if (state_1.state.selected.move !== null) {
        //move becomes the next one in the current variation
        const variation = utils_1.variationOf(state_1.state.selected.move);
        if (!state_1.state.selected.move.isBlackMove) {
            move.isBlackMove = true;
            if (state_1.state.selected.move.ravs !== undefined && state_1.state.selected.move.ravs.length > 0) {
                move.move_number = state_1.state.selected.move.move_number;
            }
        }
        else if (state_1.state.selected.move.isFirstInVariation) {
            move.move_number = state_1.state.selected.move.move_number + 1;
        }
        else {
            move.move_number = variation.moves[variation.moves.indexOf(state_1.state.selected.move) - 1].move_number + 1;
        }
        variation.moves.push(move);
        movelist_1.movelist.newMove(move);
        selection_1.selection.selectMove(move);
        if (variation === state_1.state.selected.game) {
            if (tags_1.tags.has('PlyCount'))
                tags_1.tags.set('PlyCount', state_1.state.selected.game.moves.length + '');
            checkForGameEnd();
        }
        return;
    }
    //move is the first one in the game
    move.move_number = 1;
    move.isFirstInVariation = true;
    if (state_1.state.selected.game !== null && state_1.state.selected.game.moves.length > 0)
        throw new Error("Error: null|null selection in a non-empty game");
    if (state_1.state.selected.game === null && state_1.state.pgn.length > 0)
        throw new Error("Error: no game selected in a non-empty pgn");
    if (state_1.state.selected.game === null) {
        exports.appendGame('new', move);
    }
    else {
        state_1.state.selected.game.moves.push(move);
        movelist_1.movelist.newMove(move);
        selection_1.selection.selectMove(move);
    }
    if (tags_1.tags.has('PlyCount'))
        tags_1.tags.set('PlyCount', '1');
    checkForGameEnd();
};
exports.deleteMove = (move) => {
    if (!Array.isArray(move))
        move = utils_1.indexOf(move);
    const index = move;
    if (index[0] < 0)
        return;
    let variation = state_1.state.selected.game;
    let pVariation = null;
    let p = null;
    let m = variation.moves[index[0]];
    for (let i = 1; i < index.length; i += 2) {
        p = m;
        pVariation = variation;
        variation = m.ravs[index[i]];
        m = variation.moves[index[i + 1]];
    }
    const j = index[index.length - 1];
    variation.moves.splice(j);
    if (j === 0) {
        if (p !== null) {
            p.ravs.splice(p.ravs.indexOf(variation, 1));
            //remove move number from black move with that does not come after ravs anymore
            if (p.ravs.length === 0) {
                const nextAfterP = pVariation.moves[pVariation.moves.indexOf(p) + 1];
                if (nextAfterP !== undefined && nextAfterP.isBlackMove)
                    nextAfterP.move_number = undefined;
            }
        }
        movelist_1.movelist.show(state_1.state.selected.game);
        selection_1.selection.selectMove(p);
    }
    else {
        movelist_1.movelist.show(state_1.state.selected.game);
        selection_1.selection.selectMove(variation[j - 1]);
    }
    if (variation === state_1.state.selected.game) {
        if (tags_1.tags.has('PlyCount'))
            tags_1.tags.set('PlyCount', state_1.state.selected.game.moves.length + '');
        if (tags_1.tags.has('Termination'))
            tags_1.tags.set('Termination', 'unterminated');
        tags_1.tags.set('Result', '*');
    }
};
exports.appendGame = (game, firstMove = null) => {
    if (typeof game === 'string') {
        if (game !== 'new')
            throw new Error("Invalid game creation string");
        const date = new Date(Date.now());
        game = { headers: [
                { name: 'Date', value: `${(date.getFullYear() + '').padStart(4, '0')}.${((date.getMonth() + 1) + '').padStart(2, '0')}.${(date.getDate() + '').padStart(2, '0')}` },
                { name: 'UTCDate', value: `${(date.getUTCFullYear() + '').padStart(4, '0')}.${((date.getUTCMonth() + 1) + '').padStart(2, '0')}.${(date.getUTCDate() + '').padStart(2, '0')}` },
                { name: 'UTCTime', value: `${(date.getUTCHours() + '').padStart(2, '0')}:${(date.getUTCMinutes() + '').padStart(2, '0')}:${(date.getUTCSeconds() + '').padStart(2, '0')}` },
                { name: 'PlyCount', value: '0' }
            ], moves: firstMove === null ? [] : [firstMove], result: '*' };
    }
    if (state_1.state.pgn.includes(game))
        return;
    game.result = pgn_1.sanitizeResult(game.result);
    game.headers = pgn_1.sanitizeHeaders(game);
    game.moves = pgn_1.sanitizeMoves(game.moves);
    state_1.state.pgn.push(game);
    selection_1.selection.selectGame(game);
};
exports.deleteGame = (game) => {
    const i = state_1.state.pgn.indexOf(game);
    if (i < 0)
        return;
    state_1.state.pgn.splice(i, 1);
    if (state_1.state.selected.game === game) {
        if (i < state_1.state.pgn.length)
            selection_1.selection.selectGame(state_1.state.pgn[i]);
        else if (state_1.state.pgn.length > 0)
            selection_1.selection.selectGame(state_1.state.pgn[state_1.state.pgn.length - 1]);
        else
            selection_1.selection.selectGame(null);
    }
    gamelist_1.gamelist.clear();
    gamelist_1.gamelist.list(state_1.state.pgn);
};
exports.moveVariation = (rav, step) => {
    if (rav === null)
        return;
    let pIndex = utils_1.indexOfVariation(rav);
    pIndex.pop();
    const parentMove = utils_1.moveAt(pIndex);
    if (parentMove === null && step <= 0)
        return;
    const currPos = parentMove === null ? -1 : parentMove.ravs.indexOf(rav);
    const nPos = Math.max(-1, parentMove === null ? 0 : Math.min(parentMove.ravs.length, currPos + step));
    if (nPos === currPos)
        return;
    if (parentMove === null || nPos === parentMove.ravs.length) {
        if (state_1.state.selected.move.ravs !== undefined && state_1.state.selected.move.ravs.length > 0) {
            const m = state_1.state.selected.move;
            exports.moveVariation(state_1.state.selected.move.ravs[0], -1);
            selection_1.selection.selectMove(m);
        }
    }
    else if (nPos < 0) {
        parentMove.ravs.splice(currPos, 1);
        const parentVariation = utils_1.variationOf(parentMove);
        const i = parentVariation.moves.indexOf(parentMove);
        const nRav = { moves: parentVariation.moves.splice(i) };
        parentVariation.moves.push(...rav.moves);
        parentVariation.moves[i].ravs = [nRav].concat(parentMove.ravs);
        parentMove.ravs = undefined;
        parentMove.isFirstInVariation = true;
        if (parentMove.isBlackMove && i > 0)
            parentMove.move_number = parentVariation.moves[i - 1].move_number;
        if (nRav.moves.length > 1 && nRav.moves[1].isBlackMove)
            nRav.moves[1].move_number = undefined;
        parentVariation.moves[i].isFirstInVariation = (i === 0);
        if (parentVariation.moves[i].isBlackMove && (i > 0))
            parentVariation.moves[i].move_number = undefined;
        if (parentVariation.moves.length > i + 1 && parentVariation.moves[i + 1].isBlackMove)
            parentVariation.moves[i + 1].move_number = parentVariation.moves[i].move_number;
        movelist_1.movelist.show(state_1.state.selected.game);
        selection_1.selection.selectMove(parentVariation.moves[i], true);
    }
    else {
        let step = nPos > currPos ? 1 : -1;
        for (let i = currPos; ((nPos > currPos) && (i < nPos)) || ((nPos < currPos) && (i > nPos)); i += step) {
            parentMove.ravs[i] = parentMove.ravs[i + step];
        }
        parentMove.ravs[nPos] = rav;
        movelist_1.movelist.show(state_1.state.selected.game);
        selection_1.selection.selectMove(state_1.state.selected.move, true);
    }
};
exports.deleteVariation = (rav) => {
    if (rav === null)
        return;
    if (rav === state_1.state.selected.game) {
        state_1.state.selected.game.moves.splice(0);
        movelist_1.movelist.show(state_1.state.selected.game);
        selection_1.selection.selectMove(null);
        return;
    }
    let pIndex = utils_1.indexOfVariation(rav);
    pIndex.pop();
    const parentMove = utils_1.moveAt(pIndex);
    parentMove.ravs.splice(parentMove.ravs.indexOf(rav), 1);
    movelist_1.movelist.show(state_1.state.selected.game);
    selection_1.selection.selectMove(parentMove);
};
exports.loadPgn = (nPgn) => {
    state_1.state.pgn = pgn_1.sanitizePgn(nPgn);
    gamelist_1.gamelist.clear();
    gamelist_1.gamelist.list(state_1.state.pgn);
    if (state_1.state.pgn.length === 0)
        selection_1.selection.selectGame(null);
    else
        selection_1.selection.selectGame(state_1.state.pgn[0]);
    selection_1.selection.selectMove(null);
};
