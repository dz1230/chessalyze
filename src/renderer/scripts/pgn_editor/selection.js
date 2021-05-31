"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selection = void 0;
const chess_1 = require("chessops/chess");
const fen_1 = require("chessops/fen");
const san_1 = require("chessops/san");
const compat_1 = require("chessops/compat");
const d3 = require("d3");
const state_1 = require("../../scripts/pgn_editor/state");
const tags_1 = require("../../scripts/pgn_editor/tags");
const utils_1 = require("../../scripts/pgn_editor/utils");
const engines_1 = require("../../scripts/pgn_editor/engines");
const gamelist_1 = require("../../scripts/pgn_editor/gamelist");
const annotation_1 = require("../../scripts/pgn_editor/annotation");
const movelist_1 = require("../../scripts/pgn_editor/movelist");
exports.selection = {
    selectGame(game) {
        if (game === state_1.state.selected.game)
            return;
        state_1.state.selected.game = game;
        d3.select('#elo_bottom').text('-');
        d3.select('#elo_top').text('-');
        tags_1.tags.show(game);
        const fen = utils_1.fenOf(game);
        const setupErr = fen_1.parseFen(fen);
        if (setupErr.isErr)
            throw new Error(setupErr.error.name + ': ' + setupErr.error.message);
        state_1.state.chess = chess_1.Chess.fromSetup(setupErr.unwrap()).unwrap();
        if (state_1.state.chessground.getFen() !== fen) {
            engines_1.uciengine.onPositionChange();
        }
        state_1.state.chessground.set({
            fen: fen,
            movable: {
                dests: compat_1.chessgroundDests(state_1.state.chess),
            },
            lastMove: null,
            check: state_1.state.chess.isCheck(),
            turnColor: state_1.state.chess.turn
        });
        gamelist_1.gamelist.menu.selectChildren('.game.current').node()?.classList?.remove('current');
        movelist_1.movelist.clear();
        if (game === null) {
            exports.selection.selectMove(null);
        }
        else {
            movelist_1.movelist.show(game);
            const gameBtn = (gamelist_1.gamelist.menu.selectChild((ch) => {
                return ch.getAttribute('data-game-index') === (state_1.state.pgn.indexOf(game) + '');
            }).node());
            if (gameBtn !== null)
                gameBtn.classList.add('current');
            if (game.moves.length > 0)
                exports.selection.selectMove(game.moves[0]);
            else
                exports.selection.selectMove(null);
        }
        gamelist_1.gamelist.clear();
        gamelist_1.gamelist.list(state_1.state.pgn);
    },
    selectMove(move, force = false) {
        if (move === state_1.state.selected.move && !force)
            return;
        exports.selection.selectIndex(utils_1.indexOf(move), force || (move !== state_1.state.selected.move));
    },
    selectIndex(index, force = false) {
        if (index === state_1.state.selected.moveIndex && !force)
            return;
        state_1.state.selected.moveIndex = index;
        const fen = utils_1.fenOf(state_1.state.selected.game);
        const setupErr = fen_1.parseFen(fen);
        if (setupErr.isErr)
            throw new Error(setupErr.error.name + ': ' + setupErr.error.message);
        state_1.state.chess = chess_1.Chess.fromSetup(setupErr.unwrap()).unwrap();
        let lastMove = null;
        if (state_1.state.selected.game === null) {
            state_1.state.selected.move = null;
            state_1.state.selected.next = null;
        }
        else {
            for (let i = -1; i < index.length; i += 2) {
                const variation = i < 0 ? state_1.state.selected.game : state_1.state.selected.move.ravs[index[i]];
                const j = index[i + 1];
                for (let m = 0; m < j; m++) {
                    lastMove = san_1.parseSan(state_1.state.chess, variation.moves[m].move);
                    state_1.state.chess.play(lastMove);
                }
                state_1.state.selected.move = variation.moves[j];
                state_1.state.selected.next = variation.moves[j + 1];
            }
            if (state_1.state.selected.next === undefined)
                state_1.state.selected.next = null;
            if (state_1.state.selected.move === undefined)
                state_1.state.selected.move = null;
            if (state_1.state.selected.move !== null) {
                lastMove = san_1.parseSan(state_1.state.chess, state_1.state.selected.move.move);
                state_1.state.chess.play(lastMove);
            }
        }
        const fen1 = fen_1.makeFen(state_1.state.chess.toSetup());
        if (state_1.state.chessground.getFen() !== fen1) {
            engines_1.uciengine.onPositionChange();
            engines_1.liEngine.onPositionChange();
        }
        state_1.state.chessground.set({
            fen: fen1,
            movable: {
                dests: compat_1.chessgroundDests(state_1.state.chess, { chess960: false }),
            },
            check: state_1.state.chess.isCheck(),
            lastMove: lastMove === null ? lastMove : compat_1.chessgroundMove(lastMove),
            turnColor: state_1.state.chess.turn
        });
        d3.select('#promotion_popup').style('display', 'none');
        annotation_1.comments.show(state_1.state.selected.move);
        annotation_1.nags.show(state_1.state.selected.move);
        movelist_1.movelist.list.querySelector('.move.active')?.classList.remove('active');
        const moveEl = movelist_1.movelist.findMoveElement(state_1.state.selected.move);
        if (moveEl !== null)
            moveEl.classList.add('active');
    },
    select(game, move) {
        exports.selection.selectGame(game);
        if (Array.isArray(move))
            exports.selection.selectIndex(move);
        else
            exports.selection.selectMove(move);
    }
};
