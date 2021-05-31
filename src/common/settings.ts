
export interface UserPreferences {
    language: string
    rookCastle: boolean
    snapArrowsToValidMove: boolean
    eraseArrowsOnClick: boolean
    showDests: boolean
    btrapTheme: string
    board: string
    pieceset: string
    coordinates: boolean
    orientation: 'white' | 'black'
    ghost: boolean
    animation: boolean
    highlightLastMove: boolean
    highlightCheck: boolean
    sound: 'silent' | 'default' | 'custom'
    dbSource: 'master' | 'lichess'
    infoConsoleLines: string
}

export const defaultPreferences: UserPreferences = {
    rookCastle: true, snapArrowsToValidMove: false, eraseArrowsOnClick: true,
    showDests: true,
    btrapTheme: '../../../../assets/themes/bootstrap-lumen-4.6.0.min.css',
    board: '../../../../assets/boards/brown.css',
    pieceset: '../../../../assets/piecesets/cburnett.css',
    coordinates: true,
    orientation: 'white',
    ghost: true,
    animation: true,
    highlightLastMove: true,
    highlightCheck: true,
    language: 'english',
    sound: 'silent',
    dbSource: 'master',
    infoConsoleLines: "50",
}
