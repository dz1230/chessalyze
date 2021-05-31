"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.movelist = void 0;
const d3 = require("d3");
const annotation_1 = require("../../scripts/pgn_editor/annotation");
const selection_1 = require("../../scripts/pgn_editor/selection");
const state_1 = require("../../scripts/pgn_editor/state");
const utils_1 = require("../../scripts/pgn_editor/utils");
exports.movelist = {
    list: document.getElementById('moves'),
    nagSymbol(nag) {
        const nagName = annotation_1.nagTable[nag];
        return nagName === undefined ? nag : nagName;
    },
    getMovetext(move) {
        return (move.move_number !== undefined ? (move.move_number + '.') : '') +
            ((move.move_number !== undefined) ? (move.isBlackMove ? '..' : ' ') : '') +
            move.move +
            (move.nags !== undefined ? move.nags.map(nag => exports.movelist.nagSymbol(nag)).join('') : '');
    },
    createMove(move) {
        const m = move;
        return d3.create('span').attr('class', 'move')
            .text(exports.movelist.getMovetext(move)).on('click', ev => {
            selection_1.selection.selectMove(m);
        })
            .node();
    },
    clear() {
        while (exports.movelist.list.children.length > 0) {
            exports.movelist.list.children[0].remove();
        }
    },
    show(game) {
        exports.movelist.clear();
        exports.movelist.newVariation(game, null, 0, 0);
        const r = document.createElement('span');
        r.className = 'result';
        r.innerText = game.result;
        let varDiv;
        if (exports.movelist.list.lastElementChild?.classList.contains('main')) {
            varDiv = exports.movelist.list.lastElementChild;
        }
        else {
            varDiv = document.createElement('div');
            varDiv.className = 'variation main';
            varDiv.setAttribute('data-variation', '[]');
            exports.movelist.list.appendChild(varDiv);
        }
        varDiv.appendChild(r);
    },
    newMove(move) {
        const variation = utils_1.variationOf(move);
        const varDiv = exports.movelist.findLastVariationDiv(variation);
        const prevLastMove = variation.moves[variation.moves.length - 2];
        if (variation !== state_1.state.selected.game && prevLastMove !== undefined && prevLastMove.ravs !== undefined && prevLastMove.ravs.length > 0) {
            if (varDiv.lastChild.textContent === ')')
                varDiv.lastChild.remove();
            const prevMoveRavDiv = exports.movelist.findLastVariationDiv(prevLastMove.ravs[prevLastMove.ravs.length - 1]);
            exports.movelist.newVariation(variation, prevMoveRavDiv, variation.moves.indexOf(move));
        }
        else {
            varDiv.insertBefore(exports.movelist.createMove(move), varDiv.lastChild);
        }
    },
    insertLastVariationOf(move) {
        if (move.ravs.length === 1) {
            const variation = utils_1.variationOf(move);
            const varDiv = exports.movelist.findVariationDiv(move);
            const lastVarEl = exports.movelist.findLastVariationDiv(variation);
            let el1 = varDiv.el;
            while (el1 !== lastVarEl) {
                if (el1 === null || el1 === undefined)
                    break;
                let rmEl = el1;
                el1 = el1.nextElementSibling;
                if (rmEl !== varDiv.el)
                    rmEl.remove();
            }
            const nVarDiv = exports.movelist.newVariation(move.ravs[move.ravs.length - 1], varDiv.el);
            const splitVarDiv = exports.movelist.newVariation(variation, nVarDiv, variation.moves.indexOf(move) + 1, -1, variation === state_1.state.selected.game);
            if (variation === state_1.state.selected.game)
                splitVarDiv.appendChild(lastVarEl.lastChild);
            while (varDiv.index < varDiv.el.children.length - 1) {
                varDiv.el.children[varDiv.index + 1].remove();
            }
            if (varDiv.el !== lastVarEl)
                lastVarEl.remove();
        }
        else {
            const varDiv = exports.movelist.findLastVariationDiv(move.ravs[move.ravs.length - 2]);
            exports.movelist.newVariation(move.ravs[move.ravs.length - 1], varDiv);
        }
    },
    newVariation(rav, after, offset = 0, level = -1, createEmpty = false) {
        if (!createEmpty && rav.moves.length - offset <= 0)
            return;
        if (level < 0)
            level = utils_1.ravLevel(rav, state_1.state.selected.game);
        const index = JSON.stringify(utils_1.indexOfVariation(rav));
        const variationDiv = document.createElement('div');
        variationDiv.setAttribute('data-variation', index);
        variationDiv.className = 'variation';
        variationDiv.classList.add(level === 0 ? 'main' : 'rav');
        variationDiv.style.marginLeft = (level * 15) + 'px';
        if (level > 0) {
            variationDiv.setAttribute('data-rav-level', level + '');
            variationDiv.append('(');
        }
        exports.movelist.list.insertBefore(variationDiv, after?.nextSibling);
        let i = offset;
        let last = variationDiv;
        for (; i < rav.moves.length; i++) {
            const move = rav.moves[i];
            variationDiv.appendChild(exports.movelist.createMove(move));
            if (move.ravs !== undefined && move.ravs.length > 0) {
                for (let j = 0; j < move.ravs.length; j++) {
                    const rav1 = move.ravs[j];
                    last = exports.movelist.newVariation(rav1, last, 0, level + 1);
                }
                break;
            }
        }
        if (i === rav.moves.length) {
            if (level > 0)
                variationDiv.append(')');
        }
        else {
            last = exports.movelist.newVariation(rav, last, i + 1, level);
        }
        return last;
    },
    findVariationDiv(move) {
        const el = exports.movelist.findMoveElement(move);
        return {
            el: el.parentElement,
            index: [...el.parentElement.children].indexOf(el)
        };
    },
    findLastVariationDiv(rav) {
        const index = JSON.stringify(utils_1.indexOfVariation(rav));
        let elem = null;
        for (let i = 0; i < exports.movelist.list.children.length; i++) {
            const child = exports.movelist.list.children[i];
            if (child.getAttribute('data-variation') === index) {
                elem = child;
            }
        }
        return elem;
    },
    findMoveElement(move) {
        if (move === null)
            return null;
        const variation = utils_1.variationOf(move);
        const index = JSON.stringify(utils_1.indexOfVariation(variation));
        const mIndex = variation.moves.indexOf(move);
        let vmIndex = 0;
        for (let i = 0; i < exports.movelist.list.children.length; i++) {
            const child = exports.movelist.list.children[i];
            if (child.getAttribute('data-variation') === index) {
                vmIndex += child.childElementCount;
                if (mIndex < vmIndex) {
                    return (child.children[mIndex - (vmIndex - child.childElementCount)]);
                }
            }
        }
        return null;
    }
};
