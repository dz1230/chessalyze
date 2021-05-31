import { existsSync } from "fs"
import { readFile } from "fs/promises"
import { isAbsolute, join } from "path"
import { cwd } from "process"

const pgnParser = require('pgn-parser')

export async function getParsedPGN(pgnPath:string) {
    if (pgnPath === null) return null
    const fullPgnPath = isAbsolute(pgnPath) ? pgnPath : join(cwd(), pgnPath)
    if (!existsSync(fullPgnPath)) {
        console.error('Error: ' + fullPgnPath + ' not found')
        return null
    }
    let pgn = '', parsedPgn = null
    try {
        pgn = await readFile(fullPgnPath, {encoding: 'utf-8'})
        parsedPgn = pgnParser.parse(pgn)
    } catch (error) {
        console.error(error)
        return null
    }
    return parsedPgn
}
