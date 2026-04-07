#!/usr/bin/env node
/**
 * Buff 效果注册文件同步工具
 *
 * 用法:
 *   npm run sync:buff-effects          # 扫描所有 buffConfig JSON，生成 buff/index.ts
 *
 * 工作原理:
 *   1. 扫描 assets/script/game/shared/config/buffConfig/*.json
 *   2. 读取每个 JSON 的 effectClass 字段
 *   3. 生成 assets/script/game/shared/buff/index.ts
 *      —— 每个 effectClass 对应一行 import './{effectClass}'
 *   4. shared/index.ts 中 import './buff/index' 统一触发所有注册
 *
 * 新增 Buff 流程:
 *   1. 在 buffConfig/ 下新建 JSON，填写 effectClass 字段
 *   2. 在 buff/ 下新建对应 Effect 类文件，文件末尾调用 BuffFactory.register
 *   3. 运行 npm run sync:buff-effects 自动同步注册文件
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const BUFF_CONFIG_DIR = path.join(PROJECT_ROOT, 'assets/script/game/shared/config/buffConfig');
const BUFF_EFFECT_DIR = path.join(PROJECT_ROOT, 'assets/script/game/shared/buff');
const BUFF_INDEX_TS = path.join(BUFF_EFFECT_DIR, 'index.ts');

function main() {
    if (!fs.existsSync(BUFF_CONFIG_DIR)) {
        console.error('[sync:buff-effects] buffConfig 目录不存在:', BUFF_CONFIG_DIR);
        process.exit(1);
    }

    const jsonFiles = fs.readdirSync(BUFF_CONFIG_DIR).filter((f) => f.endsWith('.json'));

    if (jsonFiles.length === 0) {
        console.log('[sync:buff-effects] 未找到任何 buff JSON 配置文件');
        return;
    }

    // 收集所有 effectClass，去重，过滤空值
    const effectClasses = [];
    const missing = [];

    for (const file of jsonFiles) {
        const filePath = path.join(BUFF_CONFIG_DIR, file);
        let json;
        try {
            json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            console.warn(`[sync:buff-effects] 解析失败，跳过: ${file}`);
            continue;
        }

        const effectClass = json.effectClass;
        if (!effectClass) continue;
        if (effectClasses.includes(effectClass)) continue;

        // 检查对应的 Effect 文件是否存在
        const effectFile = path.join(BUFF_EFFECT_DIR, `${effectClass}.ts`);
        if (!fs.existsSync(effectFile)) {
            missing.push({ effectClass, from: file });
        }

        effectClasses.push(effectClass);
    }

    // 告警：有 JSON 声明了 effectClass 但对应 .ts 文件不存在
    if (missing.length > 0) {
        console.warn('[sync:buff-effects] ⚠️  以下 effectClass 缺少对应 Effect 文件，请手动创建:');
        for (const { effectClass, from } of missing) {
            console.warn(`   - ${effectClass}.ts  (来自 ${from})`);
        }
    }

    // 生成 buff/index.ts
    const importLines = effectClasses
        .sort()
        .map((cls) => `import './${cls}';`);

    const content = [
        '// 由 tools/auto/sync-buff-effects.js 自动生成，请勿直接编辑',
        '// 新增 Buff 后运行 npm run sync:buff-effects 刷新此文件',
        '',
        ...importLines,
        '',
    ].join('\n');

    fs.writeFileSync(BUFF_INDEX_TS, content, 'utf8');

    console.log(`[sync:buff-effects] 已生成 buff/index.ts，共注册 ${effectClasses.length} 个 Effect:`);
    effectClasses.sort().forEach((cls) => console.log(`   ✓ ${cls}`));
}

main();
