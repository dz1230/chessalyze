"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.state = void 0;
const chessground_1 = require("chessground");
const chess_1 = require("chessops/chess");
const fen_1 = require("chessops/fen");
const settings_1 = require("../../../common/settings");
exports.state = {
    windowId: '',
    pgn: [],
    chess: chess_1.Chess.fromSetup(fen_1.parseFen(fen_1.INITIAL_FEN).unwrap()).unwrap(),
    selected: {
        game: null,
        move: null,
        next: null,
        moveIndex: []
    },
    chessground: chessground_1.Chessground(document.getElementById('board')),
    prefs: settings_1.defaultPreferences
};
