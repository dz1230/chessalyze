import d3 = require("d3")
import { Game, Move, RAV } from "../../../common/pgn"
import { nagTable } from "../../scripts/pgn_editor/annotation"
import { selection } from "../../scripts/pgn_editor/selection"
import { indexOf, indexOfVariation, variationAt, variationOf } from "../../scripts/pgn_editor/utils"

export class Movelist {

    static getNagSymbol(nag: string) {
        return nagTable[nag] === undefined ? nag : nagTable[nag]
    }
    //TODO add options for different piece names
    /**
     * @param {Move} move
     * @returns {string} The text to display in the movelist for a given move
     */
    static getMovetext(move: Move): string {
        return (move.move_number !== undefined ? (move.move_number + '.') : '') + //put dot after move numbers
        (move.move_number !== undefined ? (move.isBlackMove ? '..' : ' ') : '') + //adds two extra dots after black move numbers; a space after white move numbers
        (move.move) + //the san movetext
        (move.nags !== undefined ? move.nags.map(nag => Movelist.getNagSymbol(nag)).join('') : '') //add nags
    }
    /**
     * Creates a new node that displays a move in a move list.
     * @param {Move} move Which move to display
     * @returns {HTMLElement} The generated node
     */
    private static createMoveElement(move: Move): HTMLElement {
        const m = move //get const reference for event callback
        return d3.create('span')
        .attr('class', 'move')
        .text(Movelist.getMovetext(move))
        .on('click', ev => selection.selectMove(m))
        .node()
    }
    /**
     * Creates a new node to hold move nodes of a variation.
     * @param isFirst Whether the element is the first for it's rav
     * @param level The level of the rav
     */
    private static createVariationElement(isFirst: boolean, level: number): HTMLElement {
        const div = d3.create('div')
        .attr('class', 'variation')
        .classed('main', level === 0)
        .classed('rav', level > 0)
        .style('margin-left', (level * 15) + 'px')
        .attr('data-rav-level', level === 0 ? null : level+'')
        if (isFirst && level > 0) div.text('(')
        return div.node()
    }

    private wrapper: HTMLElement
    private resultNode: HTMLSpanElement
    private ravs: Map<string, {start: number, element: HTMLElement}[]>

    constructor(element?: HTMLElement, options?: null) {
        if (element === undefined || element === null) element = d3.create('div').node()
        this.wrapper = element
        this.ravs = new Map()
    }

    clear() {
        while (this.wrapper.children.length > 0) {
            this.wrapper.children[0].remove()
        }
        this.ravs.clear()
    }
    /**
     * Removes all elements of the rav and it's children ravs
     * @param ravIndex The index of the rav, each number separated with an underscore
     */
    private clearVariation(ravIndex: string) {
        const keys = this.ravs.keys()
        for (const index of keys) {
            if (index.startsWith(ravIndex)) {
                this.ravs.get(index).forEach(el => el.element.remove())
                this.ravs.delete(index)
            }
        }
    }
    /**
     * Finds the element before which to insert elements of a rav
     * @param index Index of the variation after which to search the element
     * @returns The first variation element after the given variation
     */
    private findVariationElementAfter(index: number[]) {
        if (index.length < 2) return null
        //check for rav after the given one
        index[index.length-1] += 1
        let ravIndex = index.join('_')
        if (this.ravs.has(ravIndex)) return this.ravs.get(ravIndex)[0].element
        //check for the parent rav
        index.pop()
        const moveIndex = index.pop()
        ravIndex = index.join('_')
        const element = this.ravs.get(ravIndex)?.filter(ravSegment => ravSegment.start > moveIndex)[0]
        if (element !== undefined) return element.element
        return this.findVariationElementAfter(index)
    }
    /**
     * Changes which game is displayed in the move list.
     * @param game The game to show
     */
    show(game: Game) {
        //remove all elements
        this.clear()
        //set result
        this.resultNode = d3.create('span')
        .attr('class', 'result')
        .text(game.result).node()
        //show moves
        this.updateVariation(game, null, true, null)
    }
    /**
     * Updates the displayed state of the move (and it's parent variation) in the movelist. 
     * @param move The move to update
     */
    updateMove(move: Move) {
        const variation = variationOf(move)
        this.updateVariation(variation)
    }
    /**
     * Updates the displayed state of the rav (and it's children) in the movelist. 
     * @param {RAV} rav Which rav to update. Either this or *index* has to be specified (non-null).
     * @param {number[]} index Index of the rav. Either this or *rav* has to be specified (non-null). 
     * The reference you pass in will be modified, but will have it's original state back when the function finishes.
     * @param {boolean} isCleared  Whether the movelist already has no elements of the given RAV. Keep it false to avoid headaches.
     * @param {HTMLElement} insertionPoint The variation element before which the elements of this variation should be inserted.
     */
    updateVariation(rav: RAV, index: number[] = null, isCleared: boolean = false, insertionPoint: HTMLElement = null) {
        //process arguments
        if (rav === undefined) rav = null
        if (index === undefined) index = null
        if (rav === null && index === null) throw new Error("Invalid Argument: Either rav or index have to be specified")
        if (rav === null) rav = variationAt(index)
        else if (index === null) index = indexOfVariation(rav)
        const ravIndex = index.join('_')
        //clear old rav elements
        if (!isCleared) this.clearVariation(ravIndex)
        //find insertion point
        if (insertionPoint === null) insertionPoint = this.findVariationElementAfter(index.slice(0))
        //create rav elements
        const level = Math.floor(index.length / 2)
        let currentElement = Movelist.createVariationElement(true, level)
        const elRef = currentElement
        this.ravs.set(ravIndex, [{start: 0, element: elRef}])
        let elementPending = true
        for (let i = 0; i < rav.moves.length; i++) {
            const move = rav.moves[i]
            currentElement.appendChild(Movelist.createMoveElement(move))
            if (move.ravs !== undefined && move.ravs.length > 0) {
                if (insertionPoint !== null) console.log(insertionPoint)
                this.wrapper.insertBefore(currentElement, insertionPoint)
                elementPending = false
                index.push(i)
                //create all rav elements of children
                for (let j = 0; j < move.ravs.length; j++) {
                    index.push(j)
                    this.updateVariation(move.ravs[j], index, true, insertionPoint)
                    index.pop()
                }
                index.pop()
                //create next rav element (if there are moves for it)
                if (i < rav.moves.length-1) {
                    currentElement = Movelist.createVariationElement(false, level)
                    const el = currentElement
                    this.ravs.get(ravIndex).push({start: i+1, element: el})
                    elementPending = true
                }
            }
        }
        if (insertionPoint !== null) console.log(insertionPoint)
        if (elementPending) this.wrapper.insertBefore(currentElement, insertionPoint)
        //add closing bracket at the end of non-main variations
        if (level > 0) currentElement.append(')')
        //add result display at the end of main variation
        else currentElement.appendChild(this.resultNode)
    }
    /**
     * Retrieve the element that displays the given move
     * @param move The move corresponding to the wanted element
     */
    getMoveElement(move: Move): HTMLElement {
        let idx = indexOf(move)
        const offset = idx.pop()
        if (offset < 0) return null
        const segments = this.ravs.get(idx.join('_'))
        if (!segments) return null
        let nextSegmentIndex = segments.findIndex(seg => seg.start > offset)
        let segmentIndex = nextSegmentIndex-1
        const segment = segments[segmentIndex >= 0 ? segmentIndex : segments.length-1]
        if (!segment) return null
        return <HTMLElement>segment.element.children[offset-segment.start]
    }
}

export const movelist = new Movelist(document.getElementById('moves'))
