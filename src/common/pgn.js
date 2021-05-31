"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stringifyPGN = exports.stringifyGame = exports.stringifyMove = exports.stringifyComment = exports.stringifyHeader = exports.sanitizePgn = exports.sanitizeMoves = exports.sanitizeHeaders = exports.sanitizeResult = void 0;
const chess_1 = require("chessops/chess");
const fen_1 = require("chessops/fen");
function sanitizeResult(result) {
    if (result !== '*' && result !== '0-1' && result !== '1-0' && result !== '1/2-1/2')
        return '*';
    return result;
}
exports.sanitizeResult = sanitizeResult;
function sanitizeHeaders(game) {
    if (!game.headers.some(h => h.name === 'Event'))
        game.headers.push({ name: 'Event', value: '?' });
    if (!game.headers.some(h => h.name === 'Site'))
        game.headers.push({ name: 'Site', value: '?' });
    if (!game.headers.some(h => h.name === 'Date'))
        game.headers.push({ name: 'Date', value: '????.??.??' });
    if (!game.headers.some(h => h.name === 'Round'))
        game.headers.push({ name: 'Round', value: '?' });
    if (!game.headers.some(h => h.name === 'White'))
        game.headers.push({ name: 'White', value: '?' });
    if (!game.headers.some(h => h.name === 'Black'))
        game.headers.push({ name: 'Black', value: '?' });
    if (!game.headers.some(h => h.name === 'Result'))
        game.headers.push({ name: 'Result', value: game.result });
    return game.headers;
}
exports.sanitizeHeaders = sanitizeHeaders;
function sanitizeMoves(moves, ply = 1) {
    for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        if (i === 0)
            move.isFirstInVariation = true;
        if (ply % 2 === 0)
            move.isBlackMove = true;
        if (move.comments !== undefined) {
            for (const comment of move.comments) {
                if (comment.commands !== undefined) {
                    if (comment.text === undefined)
                        comment.text = '';
                    comment.text += comment.commands.map(cmd => {
                        return '[%' + cmd.key + ' ' + cmd.values.join(' ') + ']';
                    }).join(' ');
                    comment.commands = undefined;
                }
            }
        }
        if (move.ravs !== undefined) {
            for (let i = 0; i < move.ravs.length; i++) {
                if (move.ravs[i].moves.length === 0) {
                    move.ravs.splice(i, 1);
                    i--;
                }
                else {
                    move.ravs[i].moves = sanitizeMoves(move.ravs[i].moves, ply);
                }
            }
        }
        if (ply % 2 === 1 || i === 0 || moves[i - 1].ravs?.length > 0)
            move.move_number = Math.ceil(ply / 2);
        else
            move.move_number = undefined;
        move.move = move.move.trim();
        move.move = move.move.replaceAll('.', '');
        if (move.move.includes('?!')) {
            move.move = move.move.replaceAll('?!', '');
            if (move.nags === undefined)
                move.nags = [];
            move.nags.push('$6');
        }
        if (move.move.includes('!?')) {
            move.move = move.move.replaceAll('!?', '');
            if (move.nags === undefined)
                move.nags = [];
            move.nags.push('$5');
        }
        if (move.move.includes('!!')) {
            move.move = move.move.replaceAll('!!', '');
            if (move.nags === undefined)
                move.nags = [];
            move.nags.push('$3');
        }
        if (move.move.includes('??')) {
            move.move = move.move.replaceAll('??', '');
            if (move.nags === undefined)
                move.nags = [];
            move.nags.push('$4');
        }
        if (move.move.includes('!')) {
            move.move = move.move.replaceAll('!', '');
            if (move.nags === undefined)
                move.nags = [];
            move.nags.push('$1');
        }
        if (move.move.includes('?')) {
            move.move = move.move.replaceAll('?', '');
            if (move.nags === undefined)
                move.nags = [];
            move.nags.push('$2');
        }
        moves[i] = move;
        ply++;
    }
    return moves;
}
exports.sanitizeMoves = sanitizeMoves;
function sanitizePgn(pgn) {
    for (const game of pgn) {
        if (game.comments === null || game.comments?.length === 0)
            game.comments = undefined;
        game.result = sanitizeResult(game.result);
        game.headers = sanitizeHeaders(game);
        let startFen = fen_1.INITIAL_FEN;
        if (game.headers.some(h => h.name === 'FEN') && game.headers.some(h => (h.name === 'SetUp') && (h.value === '1'))) {
            const fen = game.headers.find(h => h.name === 'FEN').value;
            if (!fen_1.parseFen(fen).isErr)
                startFen = fen;
        }
        const chess = chess_1.Chess.fromSetup(fen_1.parseFen(startFen).unwrap()).unwrap();
        game.moves = sanitizeMoves(game.moves, (chess.fullmoves * 2) - (chess.turn === 'black' ? 0 : 1));
    }
    return pgn;
}
exports.sanitizePgn = sanitizePgn;
function stringifyHeader(header) {
    return `[${header.name} "${header.value}"]`;
}
exports.stringifyHeader = stringifyHeader;
function stringifyComment(comment) {
    if (comment.text === undefined)
        return '';
    return `{ ${comment.text.trim()} }`;
}
exports.stringifyComment = stringifyComment;
function stringifyMove(move) {
    let m = '';
    if (move.move_number !== undefined)
        m += move.move_number + '.';
    if (move.move_number !== undefined && move.isBlackMove)
        m += '..';
    if (m.length > 0)
        m += ' ';
    m += move.move;
    if (move.nags !== undefined && move.nags.length > 0)
        m += ' ' + move.nags.join(' ');
    if (move.comments !== undefined && move.comments.length > 0)
        m += ' ' + move.comments.map(c => stringifyComment(c)).join(' ');
    if (move.ravs !== undefined && move.ravs.length > 0 && move.ravs.some(rav => rav.moves.length > 0))
        m += ' ' + move.ravs.map(rav => rav.moves.length > 0 ? ('(' + rav.moves.map(m => stringifyMove(m)).join(' ') + ')') : '').join(' ');
    return m;
}
exports.stringifyMove = stringifyMove;
function stringifyGame(game, tags, movetext) {
    let s = '';
    if (tags) {
        //tag pair section
        const roster = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result'];
        s += game.headers.slice(0).sort((a, b) => {
            const aI = roster.indexOf(a.name), bI = roster.indexOf(b.name);
            if (aI < 0 && bI < 0)
                return a.name < b.name ? -1 : 1;
            if (aI < 0 && bI >= 0)
                return 1;
            if (bI < 0 && aI >= 0)
                return -1;
            return aI - bI;
        }).map(h => stringifyHeader(h)).join('\r\n');
        //empty line for separation
        s += '\r\n\r\n';
    }
    //game comments
    if (game.comments !== undefined && game.comments?.length > 0)
        s += game.comments.map(c => stringifyComment(c)).join('\r\n') + '\r\n';
    //movetext section
    let mt = '';
    if (movetext) {
        mt = game.moves.map(m => stringifyMove(m)).join(' ');
    }
    s += mt;
    s += (mt.length > 0 ? ' ' : '') + game.result;
    return s;
}
exports.stringifyGame = stringifyGame;
function stringifyPGN(pgn, tags = true, movetext = true) {
    let s = '';
    for (let i = 0; i < pgn.length; i++) {
        const game = pgn[i];
        //empty line for separation
        if (i > 0)
            s += '\r\n\r\n';
        //game
        s += stringifyGame(game, tags, movetext);
    }
    return s;
}
exports.stringifyPGN = stringifyPGN;
