"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.movelist = exports.Movelist = void 0;
const d3 = require("d3");
const annotation_1 = require("../../scripts/pgn_editor/annotation");
const selection_1 = require("../../scripts/pgn_editor/selection");
const utils_1 = require("../../scripts/pgn_editor/utils");
class Movelist {
    constructor(element, options) {
        if (element === undefined || element === null)
            element = d3.create('div').node();
        this.wrapper = element;
        this.ravs = new Map();
    }
    static getNagSymbol(nag) {
        return annotation_1.nagTable[nag] === undefined ? nag : annotation_1.nagTable[nag];
    }
    //TODO add options for different piece names
    /**
     * @param {Move} move
     * @returns {string} The text to display in the movelist for a given move
     */
    static getMovetext(move) {
        return (move.move_number !== undefined ? (move.move_number + '.') : '') + //put dot after move numbers
            (move.move_number !== undefined ? (move.isBlackMove ? '..' : ' ') : '') + //adds two extra dots after black move numbers; a space after white move numbers
            (move.move) + //the san movetext
            (move.nags !== undefined ? move.nags.map(nag => Movelist.getNagSymbol(nag)).join('') : ''); //add nags
    }
    /**
     * Creates a new node that displays a move in a move list.
     * @param {Move} move Which move to display
     * @returns {HTMLElement} The generated node
     */
    static createMoveElement(move) {
        const m = move; //get const reference for event callback
        return d3.create('span')
            .attr('class', 'move')
            .text(Movelist.getMovetext(move))
            .on('click', ev => selection_1.selection.selectMove(m))
            .node();
    }
    /**
     * Creates a new node to hold move nodes of a variation.
     * @param isFirst Whether the element is the first for it's rav
     * @param level The level of the rav
     */
    static createVariationElement(isFirst, level) {
        const div = d3.create('div')
            .attr('class', 'variation')
            .classed('main', level === 0)
            .classed('rav', level > 0)
            .style('margin-left', (level * 15) + 'px')
            .attr('data-rav-level', level === 0 ? null : level + '');
        if (isFirst && level > 0)
            div.text('(');
        return div.node();
    }
    clear() {
        while (this.wrapper.children.length > 0) {
            this.wrapper.children[0].remove();
        }
        this.ravs.clear();
    }
    /**
     * Removes all elements of the rav and it's children ravs
     * @param ravIndex The index of the rav, each number separated with an underscore
     */
    clearVariation(ravIndex) {
        const keys = this.ravs.keys();
        for (const index of keys) {
            if (index.startsWith(ravIndex)) {
                this.ravs.get(index).forEach(el => el.element.remove());
                this.ravs.delete(index);
            }
        }
    }
    /**
     * Finds the element before which to insert elements of a rav
     * @param index Index of the variation after which to search the element
     * @returns The first variation element after the given variation
     */
    findVariationElementAfter(index) {
        if (index.length < 2)
            return null;
        //check for rav after the given one
        index[index.length - 1] += 1;
        let ravIndex = index.join('_');
        if (this.ravs.has(ravIndex))
            return this.ravs.get(ravIndex)[0].element;
        //check for the parent rav
        index.pop();
        const moveIndex = index.pop();
        ravIndex = index.join('_');
        const element = this.ravs.get(ravIndex)?.filter(ravSegment => ravSegment.start > moveIndex)[0];
        if (element !== undefined)
            return element.element;
        return this.findVariationElementAfter(index);
    }
    /**
     * Changes which game is displayed in the move list.
     * @param game The game to show
     */
    show(game) {
        //remove all elements
        this.clear();
        //set result
        this.resultNode = d3.create('span')
            .attr('class', 'result')
            .text(game.result).node();
        //show moves
        this.updateVariation(game, null, true, null);
    }
    /**
     * Updates the displayed state of the move (and it's parent variation) in the movelist.
     * @param move The move to update
     */
    updateMove(move) {
        const variation = utils_1.variationOf(move);
        this.updateVariation(variation);
    }
    /**
     * Updates the displayed state of the rav (and it's children) in the movelist.
     * @param {RAV} rav Which rav to update. Either this or *index* has to be specified (non-null).
     * @param {number[]} index Index of the rav. Either this or *rav* has to be specified (non-null).
     * The reference you pass in will be modified, but will have it's original state back when the function finishes.
     * @param {boolean} isCleared  Whether the movelist already has no elements of the given RAV. Keep it false to avoid headaches.
     * @param {HTMLElement} insertionPoint The variation element before which the elements of this variation should be inserted.
     */
    updateVariation(rav, index = null, isCleared = false, insertionPoint = null) {
        //process arguments
        if (rav === undefined)
            rav = null;
        if (index === undefined)
            index = null;
        if (rav === null && index === null)
            throw new Error("Invalid Argument: Either rav or index have to be specified");
        if (rav === null)
            rav = utils_1.variationAt(index);
        else if (index === null)
            index = utils_1.indexOfVariation(rav);
        const ravIndex = index.join('_');
        //clear old rav elements
        if (!isCleared)
            this.clearVariation(ravIndex);
        //find insertion point
        if (insertionPoint === null)
            insertionPoint = this.findVariationElementAfter(index.slice(0));
        //create rav elements
        const level = Math.floor(index.length / 2);
        let currentElement = Movelist.createVariationElement(true, level);
        const elRef = currentElement;
        this.ravs.set(ravIndex, [{ start: 0, element: elRef }]);
        let elementPending = true;
        for (let i = 0; i < rav.moves.length; i++) {
            const move = rav.moves[i];
            currentElement.appendChild(Movelist.createMoveElement(move));
            if (move.ravs !== undefined && move.ravs.length > 0) {
                if (insertionPoint !== null)
                    console.log(insertionPoint);
                this.wrapper.insertBefore(currentElement, insertionPoint);
                elementPending = false;
                index.push(i);
                //create all rav elements of children
                for (let j = 0; j < move.ravs.length; j++) {
                    index.push(j);
                    this.updateVariation(move.ravs[j], index, true, insertionPoint);
                    index.pop();
                }
                index.pop();
                //create next rav element (if there are moves for it)
                if (i < rav.moves.length - 1) {
                    currentElement = Movelist.createVariationElement(false, level);
                    const el = currentElement;
                    this.ravs.get(ravIndex).push({ start: i + 1, element: el });
                    elementPending = true;
                }
            }
        }
        if (insertionPoint !== null)
            console.log(insertionPoint);
        if (elementPending)
            this.wrapper.insertBefore(currentElement, insertionPoint);
        //add closing bracket at the end of non-main variations
        if (level > 0)
            currentElement.append(')');
        //add result display at the end of main variation
        else
            currentElement.appendChild(this.resultNode);
    }
    /**
     * Retrieve the element that displays the given move
     * @param move The move corresponding to the wanted element
     */
    getMoveElement(move) {
        let idx = utils_1.indexOf(move);
        const offset = idx.pop();
        if (offset < 0)
            return null;
        const segments = this.ravs.get(idx.join('_'));
        if (!segments)
            return null;
        let nextSegmentIndex = segments.findIndex(seg => seg.start > offset);
        let segmentIndex = nextSegmentIndex - 1;
        const segment = segments[segmentIndex >= 0 ? segmentIndex : segments.length - 1];
        if (!segment)
            return null;
        return segment.element.children[offset - segment.start];
    }
}
exports.Movelist = Movelist;
exports.movelist = new Movelist(document.getElementById('moves'));
