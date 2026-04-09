export interface LevelEntry {
    id: string;
    name: string;
    /** resources 相对路径（不含 .json 后缀） */
    jsonPath: string;
}

export const LevelManifest: readonly LevelEntry[] = [
    { id: 'test_1px',    name: '1px测试', jsonPath: 'puzzles/test_1px' },
    { id: 'test_simple', name: '测试',    jsonPath: 'puzzles/test_simple' },
    { id: 'apple',       name: '苹果',    jsonPath: 'puzzles/apple' },
    { id: 'mountain',    name: '山水',    jsonPath: 'puzzles/mountain' },
];
