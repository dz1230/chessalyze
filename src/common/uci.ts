export type UCIRegistration = {
    name: string
    code: string
}

export type UCIEngineStatus = 'uninitialized' | 'waiting' | 'searching' | 'unresponsive'
export type UCIEngineOptionType = 'check' | 'spin' | 'combo' | 'button' | 'string'
export interface UCIEngineOption {
    type: UCIEngineOptionType,
    name: string,
    default: string,
    value: string,
    min: string,
    max: string
    predefined: string[]
}
export interface UCIEngineInfo {
    name: string
    authors: string
}
export interface UCISearchOptions {
    depth?: string
    nodes?: string
    movetime?: string
    infinite: boolean
}

export interface UCIEngine {
    id: string
    templateId: string
    displayName: string
    exePath: string
    status: UCIEngineStatus
    info?: UCIEngineInfo,
    options?: UCIEngineOption[]
    searchOptions?: UCISearchOptions
    registration?: UCIRegistration
}

export interface UCIEngineTemplate {
    id: string
    displayName: string
    exePath: string
    info?: UCIEngineInfo
    options?: UCIEngineOption[]
    searchOptions?: UCISearchOptions
    registration?: UCIRegistration,
}
