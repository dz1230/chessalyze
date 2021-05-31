"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chessground_1 = require("chessground");
const fen_1 = require("chessops/fen");
const d3 = require("d3");
const electron_1 = require("electron");
function getPositionFEN() {
    const board = chessground.getFen();
    const color = d3.select('#turnColor').property('value');
    const castling = (d3.select('#wk').property('checked') ? 'K' : '') +
        (d3.select('#wq').property('checked') ? 'Q' : '') +
        (d3.select('#bk').property('checked') ? 'k' : '') +
        (d3.select('#bq').property('checked') ? 'q' : '');
    const ep = d3.select('#epSquare').property('value');
    return `${board} ${color} ${castling.length === 0 ? '-' : castling} ${ep}`;
}
function updateFEN() {
    const fen = `${getPositionFEN()} 0 1`;
    d3.select('#fen').property('value', fen);
}
function setFEN(fen) {
    const setup = fen_1.parseFen(fen);
    if (setup.isErr) {
        console.error(setup.error);
        fen = fen_1.EMPTY_FEN;
    }
    d3.select('#turnColor').property('value', fen.split(' ')[1]);
    d3.select('#wk').property('checked', fen.split(' ')[2].includes('K'));
    d3.select('#wq').property('checked', fen.split(' ')[2].includes('Q'));
    d3.select('#bk').property('checked', fen.split(' ')[2].includes('k'));
    d3.select('#bq').property('checked', fen.split(' ')[2].includes('q'));
    d3.select('#epSquare').property('value', fen.split(' ')[3]);
    chessground.set({ fen: fen });
    d3.select('#fen').property('value', fen);
}
d3.select('#fen').property('value', fen_1.INITIAL_FEN);
const chessground = chessground_1.Chessground(document.getElementById('board'), {
    animation: { enabled: false },
    fen: fen_1.INITIAL_FEN,
    autoCastle: false,
    drawable: { enabled: false },
    highlight: { lastMove: false, check: false },
    movable: { free: true, color: 'both', rookCastle: false, showDests: false },
    viewOnly: false,
    predroppable: { enabled: false },
    premovable: { enabled: false },
    selectable: { enabled: false },
    draggable: {
        enabled: true,
        autoDistance: true,
        deleteOnDropOff: true,
        showGhost: true,
    },
    resizable: true,
    orientation: 'white',
    turnColor: 'white',
    events: {
        change() {
            updateFEN();
        },
        select(key) {
            if (selected !== 'cursor')
                chessground.selectSquare(null, true);
        }
    }
});
d3.select('#empty_board').on('click', ev => {
    chessground.set({ fen: fen_1.EMPTY_FEN });
    updateFEN();
});
d3.select('#toggle_orientation').on('click', ev => {
    chessground.toggleOrientation();
});
d3.select('#turnColor').on('change', updateFEN);
d3.select('#wk').on('change', updateFEN);
d3.select('#wq').on('change', updateFEN);
d3.select('#bk').on('change', updateFEN);
d3.select('#bq').on('change', updateFEN);
d3.select('#epSquare').on('change', updateFEN);
d3.select('#fen').on('change', ev => {
    let fen = d3.select('#fen').property('value');
    setFEN(fen);
});
let selected = 'cursor';
function select(tool) {
    d3.selectAll('.list-pieces piece.active').classed('active', false);
    if (typeof tool === 'string') {
        d3.selectAll('.list-pieces piece.' + tool).classed('active', true);
    }
    else {
        d3.selectAll('.list-pieces piece.' + tool.role + '.' + tool.color).classed('active', true);
    }
    if (selected === 'cursor')
        chessground.set({ draggable: { enabled: false } });
    else
        chessground.set({ draggable: { enabled: true } });
    if (tool === 'cursor')
        d3.select('board').style('cursor', 'default');
    else
        d3.select('#board').style('cursor', d3.select('.list-pieces .active').style('background-image') + ', auto');
    selected = tool;
}
d3.selectAll('.list-pieces piece').on('click', ev => {
    const p = ev.target;
    if (p.hasAttribute('data-tool'))
        select(p.getAttribute('data-tool'));
    else
        select({ role: p.getAttribute('data-role'), color: p.getAttribute('data-color') });
});
let mouseIsDown = false;
let lastSquare = null;
function placeSelectedOnSquare(square) {
    if (selected === 'cursor')
        return;
    const pieceDiff = new Map();
    pieceDiff.set(square, null);
    chessground.setPieces(pieceDiff);
    if (selected !== 'trash') {
        chessground.newPiece(selected, square);
    }
}
window.addEventListener('mouseup', ev => {
    mouseIsDown = false;
    lastSquare = null;
});
d3.select('#board').on('mousedown', ev => {
    if (selected === 'cursor')
        return;
    mouseIsDown = true;
    lastSquare = chessground.getKeyAtDomPos([ev.clientX, ev.clientY]);
    placeSelectedOnSquare(lastSquare);
});
d3.select('#board').on('mousemove', ev => {
    if (selected === 'cursor')
        return;
    if (!mouseIsDown || ev.offsetX > 480 || ev.offsetY > 480 || ev.offsetY < 0 || ev.offsetX < 0)
        return;
    let square = chessground.getKeyAtDomPos([ev.clientX, ev.clientY]);
    if (square !== lastSquare) {
        placeSelectedOnSquare(square);
        lastSquare = square;
    }
});
electron_1.ipcRenderer.on('fen', (ev, fen) => {
    setFEN(fen);
});
electron_1.ipcRenderer.on('copy', (ev, descriptor) => {
    if (descriptor === 'fen')
        electron_1.clipboard.writeText(getPositionFEN() + ' 0 1');
    else if (descriptor === 'board-fen')
        electron_1.clipboard.writeText(chessground.getFen());
    else if (descriptor === 'epd')
        electron_1.clipboard.writeText(getPositionFEN());
});
electron_1.ipcRenderer.on('fetch-fen', (ev, info) => {
    const fen = getPositionFEN() + ' 0 1';
    if (info?.back === 'save-fen') {
        ev.sender.send('save-fen', fen, ...info.args);
    }
});
document.body.firstChild.dispatchEvent(new Event('chessground.resize'));
window.addEventListener('resize', ev => {
    document.body.dispatchEvent(new Event('chessground.resize'));
});
document.body.firstChild.addEventListener('scroll', ev => {
    document.body.dispatchEvent(new Event('chessground.resize'));
});
const setUserPreference = (name, value) => {
    console.log(`Setting ${name} to "${value}"`);
    switch (name) {
        case 'btrapTheme':
            document.getElementById('theme_sheet').href = value;
            setTimeout(() => {
                chessground.redrawAll();
            }, 50);
            break;
        case 'board':
            document.getElementById('board_sheet').href = value;
            break;
        case 'pieceset':
            document.getElementById('piece_sheet').href = value;
            break;
        case 'rookCastle':
            chessground.set({ movable: { rookCastle: value } });
            chessground.redrawAll();
            break;
        case 'snapArrowsToValidMove':
            chessground.set({ drawable: { defaultSnapToValidMove: value } });
            chessground.redrawAll();
            break;
        case 'eraseArrowsOnClick':
            chessground.set({ drawable: { eraseOnClick: value } });
            chessground.redrawAll();
            break;
        case 'showDests':
            chessground.set({ movable: { showDests: value } });
            chessground.redrawAll();
            break;
        case 'coordinates':
            chessground.set({ coordinates: value });
            chessground.redrawAll();
            break;
        case 'orientation':
            chessground.set({ orientation: value });
            chessground.redrawAll();
            break;
        case 'ghost':
            chessground.set({ draggable: { showGhost: value } });
            chessground.redrawAll();
            break;
        case 'animation':
            chessground.set({ animation: { enabled: value } });
            chessground.redrawAll();
            break;
        case 'highlightLastMove':
            chessground.set({ highlight: { lastMove: value } });
            chessground.redrawAll();
            break;
        case 'highlightCheck':
            chessground.set({ highlight: { check: value } });
            chessground.redrawAll();
            break;
        default:
            break;
    }
};
electron_1.ipcRenderer.on('set-pref', (ev, key, value) => {
    setUserPreference(key, value);
});
electron_1.ipcRenderer.on('load-prefs', (ev, prefs) => {
    for (const key in prefs) {
        if (Object.prototype.hasOwnProperty.call(prefs, key)) {
            const prefValue = prefs[key];
            setUserPreference(key, prefValue);
        }
    }
});
