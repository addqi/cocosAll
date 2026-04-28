import type { PieceLite } from '../algo/merge-scan';

/**
 * 盘面 ASCII 可视化——给我截这一段，我能 1:1 还原现场。
 *
 * 输出形如：
 *   slots（✓=在正确槽 / ✗=错位 / pid(row,col)=该块对应源图区域）:
 *     [✓0(0,0)] [✗4(1,1)] [✗6(2,0)]
 *     [✗1(0,1)] [✗3(1,0)] [✗7(2,1)]
 *     [✗2(0,2)] [✗5(1,2)] [✗8(2,2)]
 *   错位块数 misplaced = 8
 *   groups: [0,1] [3,6]  (孤立: 2,4,5,7,8)
 */
export function dumpBoard(
    slots: readonly number[],
    pieces: readonly PieceLite[],
    pieceGrid: number,
): string {
    let misplaced = 0;
    const lines: string[] = [
        'slots（✓=在正确槽 / ✗=错位 / pid(row,col)=该块对应源图区域）:',
    ];
    for (let sr = 0; sr < pieceGrid; sr++) {
        const row: string[] = [];
        for (let sc = 0; sc < pieceGrid; sc++) {
            const idx = sr * pieceGrid + sc;
            const pid = slots[idx];
            const piece = pieces[pid];
            const ok = pid === idx ? '✓' : '✗';
            if (pid !== idx) misplaced++;
            row.push(`[${ok}${pid}(${piece.row},${piece.col})]`);
        }
        lines.push('  ' + row.join(' '));
    }
    lines.push(`错位块数 misplaced = ${misplaced}（=0 才是真正拼完）`);

    const groups: { [key: number]: number[] } = {};
    for (let pid = 0; pid < pieces.length; pid++) {
        const g = pieces[pid].groupId;
        if (!groups[g]) groups[g] = [];
        groups[g].push(pid);
    }
    const multi: string[] = [];
    const solos: number[] = [];
    for (const k in groups) {
        if (groups[k].length > 1) multi.push(`[${groups[k]}]`);
        else solos.push(groups[k][0]);
    }
    const groupLine = multi.length === 0 && solos.length === pieces.length
        ? 'groups: (全部孤立)'
        : `groups: ${multi.join(' ')}` + (solos.length ? `  (孤立: ${solos.join(',')})` : '');
    lines.push(groupLine);

    return lines.join('\n');
}
