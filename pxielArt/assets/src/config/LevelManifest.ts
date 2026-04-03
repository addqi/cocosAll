export interface LevelEntry {
    id: string;
    name: string;
    /** resources 相对路径（不含 .json 后缀） */
    jsonPath: string;
}

export const LevelManifest: readonly LevelEntry[] = [
    { id: 'apple',    name: '苹果', jsonPath: 'puzzles/apple' },
    { id: 'mountain', name: '山水', jsonPath: 'puzzles/mountain' },
];
