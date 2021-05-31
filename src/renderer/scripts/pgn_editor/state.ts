import { Chessground } from "chessground";
import { Chess } from "chessops/chess";
import { INITIAL_FEN, parseFen } from "chessops/fen";
import { Game, Move, PGN } from "../../../common/pgn";
import { defaultPreferences } from "../../../common/settings";

export const state = {
    windowId: '',
    pgn: <PGN>[],
    chess: Chess.fromSetup(parseFen(INITIAL_FEN).unwrap()).unwrap(),
    selected: {
        game: <Game>null,
        move: <Move>null,
        next: <Move>null,
        moveIndex: <number[]>[]
    },
    chessground: Chessground(document.getElementById('board')),
    prefs: defaultPreferences
}
