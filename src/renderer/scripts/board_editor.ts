import { Chessground } from "chessground"
import { Key, Piece, PiecesDiff } from "chessground/types"
import { parseFen, INITIAL_FEN, EMPTY_FEN } from "chessops/fen"
import d3 = require("d3")
import { clipboard, ipcRenderer } from "electron"

function getPositionFEN() {
    const board = chessground.getFen()
    const color = d3.select('#turnColor').property('value')
    const castling = 
    (d3.select('#wk').property('checked') ? 'K' : '') + 
    (d3.select('#wq').property('checked') ? 'Q' : '') + 
    (d3.select('#bk').property('checked') ? 'k' : '') + 
    (d3.select('#bq').property('checked') ? 'q' : '')
    const ep = d3.select('#epSquare').property('value')
    return `${board} ${color} ${castling.length === 0 ? '-' : castling} ${ep}`
}
function updateFEN() {
    const fen = `${getPositionFEN()} 0 1`
    d3.select('#fen').property('value', fen)
}
function setFEN(fen:string) {
    const setup = parseFen(fen)
    if (setup.isErr) {
        console.error(setup.error)
        fen = EMPTY_FEN
    }
    d3.select('#turnColor').property('value', fen.split(' ')[1])
    d3.select('#wk').property('checked', fen.split(' ')[2].includes('K'))
    d3.select('#wq').property('checked', fen.split(' ')[2].includes('Q'))
    d3.select('#bk').property('checked', fen.split(' ')[2].includes('k'))
    d3.select('#bq').property('checked', fen.split(' ')[2].includes('q'))
    d3.select('#epSquare').property('value', fen.split(' ')[3])
    chessground.set({fen: fen})
    d3.select('#fen').property('value', fen)
}

d3.select('#fen').property('value', INITIAL_FEN)

const chessground = Chessground(document.getElementById('board'), {
    animation: {enabled: false},
    fen: INITIAL_FEN,
    autoCastle: false,
    drawable: {enabled: false},
    highlight: {lastMove: false, check: false},
    movable: {free: true, color: 'both', rookCastle: false, showDests: false},
    viewOnly: false,
    predroppable: {enabled: false},
    premovable: {enabled: false},
    selectable: {enabled: false},
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
            updateFEN()
        },
        select(key) {
            if (selected !== 'cursor') chessground.selectSquare(null, true)
        }
    }
})

d3.select('#empty_board').on('click', ev => {
    chessground.set({fen: EMPTY_FEN})
    updateFEN()
})
d3.select('#toggle_orientation').on('click', ev => {
    chessground.toggleOrientation()
})

d3.select('#turnColor').on('change', updateFEN)
d3.select('#wk').on('change', updateFEN)
d3.select('#wq').on('change', updateFEN)
d3.select('#bk').on('change', updateFEN)
d3.select('#bq').on('change', updateFEN)
d3.select('#epSquare').on('change', updateFEN)

d3.select('#fen').on('change', ev => {
    let fen = d3.select('#fen').property('value')
    setFEN(fen)
})

let selected: Piece | 'cursor' | 'trash' = 'cursor'
function select(tool: Piece | 'cursor' | 'trash') {
    d3.selectAll('.list-pieces piece.active').classed('active', false)
    if (typeof tool === 'string') {
        d3.selectAll('.list-pieces piece.' + tool).classed('active', true)
    } else {
        d3.selectAll('.list-pieces piece.' + tool.role + '.' + tool.color).classed('active', true)
    }
    if (selected === 'cursor') chessground.set({draggable: {enabled: false}})
    else chessground.set({draggable: {enabled: true}})

    if (tool === 'cursor') d3.select('board').style('cursor', 'default')
    else d3.select('#board').style('cursor', d3.select('.list-pieces .active').style('background-image') + ', auto')
    
    selected = tool
}

d3.selectAll('.list-pieces piece').on('click', ev => {
    const p = <HTMLElement>ev.target
    if (p.hasAttribute('data-tool')) select(<'cursor' | 'trash'>p.getAttribute('data-tool'))
    else select({role: <any>p.getAttribute('data-role'), color: <any>p.getAttribute('data-color')})
})

let mouseIsDown = false
let lastSquare: Key = null

function placeSelectedOnSquare(square:Key) {
    if (selected === 'cursor') return
    const pieceDiff: PiecesDiff = new Map()
    pieceDiff.set(square, null)
    chessground.setPieces(pieceDiff)
    if (selected !== 'trash') {
        chessground.newPiece(selected, square)
    }
}

window.addEventListener('mouseup', ev => {
    mouseIsDown = false
    lastSquare = null
})
d3.select('#board').on('mousedown', ev => {
    if (selected === 'cursor') return
    mouseIsDown = true
    lastSquare = chessground.getKeyAtDomPos([ev.clientX, ev.clientY])
    placeSelectedOnSquare(lastSquare)
})
d3.select('#board').on('mousemove', ev => {
    if (selected === 'cursor') return
    if (!mouseIsDown || ev.offsetX > 480 || ev.offsetY > 480 || ev.offsetY < 0 || ev.offsetX < 0) return
    let square = chessground.getKeyAtDomPos([ev.clientX, ev.clientY])
    if (square !== lastSquare) {
        placeSelectedOnSquare(square)
        lastSquare = square
    }
})

ipcRenderer.on('fen', (ev, fen: string) => {
    setFEN(fen)
})
ipcRenderer.on('copy', (ev, descriptor: string) => {
    if (descriptor === 'fen') clipboard.writeText(getPositionFEN() + ' 0 1')
    else if (descriptor === 'board-fen') clipboard.writeText(chessground.getFen())
    else if (descriptor === 'epd') clipboard.writeText(getPositionFEN())
})
ipcRenderer.on('fetch-fen', (ev, info) => {
    const fen = getPositionFEN() + ' 0 1'
    if (info?.back === 'save-fen') {
        ev.sender.send('save-fen', fen, ...info.args)
    }
})

document.body.firstChild.dispatchEvent(new Event('chessground.resize'))
window.addEventListener('resize', ev => {
    document.body.dispatchEvent(new Event('chessground.resize'))
})
document.body.firstChild.addEventListener('scroll', ev => {
    document.body.dispatchEvent(new Event('chessground.resize'))
})

const setUserPreference = (name: string, value: string | boolean) => {
    console.log(`Setting ${name} to "${value}"`)
    switch (name) {
        case 'btrapTheme':
            (<HTMLLinkElement>document.getElementById('theme_sheet')).href = <string>value
            setTimeout(() => {
                chessground.redrawAll()
            }, 50)
            break
        case 'board':
            (<HTMLLinkElement>document.getElementById('board_sheet')).href = <string>value
            break
        case 'pieceset':
            (<HTMLLinkElement>document.getElementById('piece_sheet')).href = <string>value
            break
        case 'rookCastle':
            chessground.set({movable: {rookCastle: <boolean>value}})
            chessground.redrawAll()
            break
        case 'snapArrowsToValidMove':
            chessground.set({drawable: {defaultSnapToValidMove: <boolean>value}})
            chessground.redrawAll()
            break
        case 'eraseArrowsOnClick':
            chessground.set({drawable: {eraseOnClick: <boolean>value}})
            chessground.redrawAll()
            break
        case 'showDests':
            chessground.set({movable: {showDests: <boolean>value}})
            chessground.redrawAll()
            break
        case 'coordinates':
            chessground.set({coordinates: <boolean>value})
            chessground.redrawAll()
            break
        case 'orientation':
            chessground.set({orientation: <any>value})
            chessground.redrawAll()
            break
        case 'ghost':
            chessground.set({draggable: {showGhost: <boolean>value}})
            chessground.redrawAll()
            break
        case 'animation':
            chessground.set({animation: {enabled: <boolean>value}})
            chessground.redrawAll()
            break
        case 'highlightLastMove':
            chessground.set({highlight: {lastMove: <boolean>value}})
            chessground.redrawAll()
            break
        case 'highlightCheck':
            chessground.set({highlight: {check: <boolean>value}})
            chessground.redrawAll()
            break
        default:
            break
    }
}

ipcRenderer.on('set-pref', (ev, key, value) => {
    setUserPreference(key, value)
})
ipcRenderer.on('load-prefs', (ev, prefs) => {
    for (const key in prefs) {
        if (Object.prototype.hasOwnProperty.call(prefs, key)) {
            const prefValue = prefs[key]
            setUserPreference(key, prefValue)
        }
    }
})
