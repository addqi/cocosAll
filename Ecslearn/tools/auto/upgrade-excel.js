#!/usr/bin/env node
/**
 * 升级配置 Excel ↔ JSON 互转工具
 *
 * 用法:
 *   npm run upgrade:export   # JSON → Excel（把当前 JSON 导出为 Excel）
 *   npm run upgrade:import   # Excel → JSON（把 Excel 导入为 JSON）
 *
 * Excel 结构:
 *   Sheet "upgrades"  — 一行一个升级，基础字段
 *   Sheet "effects"   — 一行一个效果，通过 upgradeId 关联
 *
 * 工作流:
 *   1. 新功能先写 JSON，验证无误
 *   2. 运行 export 把 JSON 同步到 Excel
 *   3. 策划后续直接改 Excel
 *   4. 运行 import 把 Excel 生成 JSON
 */

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '../..');
const CONFIG_DIR = path.join(ROOT, 'assets/script/game/config/upgradeConfig');
const EXCEL_DIR  = path.join(ROOT, 'config/excel');
const EXCEL_FILE = path.join(EXCEL_DIR, 'upgrades.xlsx');

const UPGRADES_JSON   = path.join(CONFIG_DIR, 'upgrades.json');
const EVOLUTIONS_JSON = path.join(CONFIG_DIR, 'evolutions.json');

const BUFF_FIELDS = ['buffId', 'buffName', 'duration', 'maxStack', 'effectClass', 'targetAttr', 'valuePerStack'];
const POLICY_FIELDS = ['policyClass', 'policyLevel'];

// ────────────────────────────── helpers ──────────────────────────────

function readJSON(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJSON(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function parseExtra(str) {
    if (!str) return {};
    const result = {};
    for (const pair of String(str).split(';')) {
        const eq = pair.indexOf('=');
        if (eq < 0) continue;
        const k = pair.slice(0, eq).trim();
        const v = pair.slice(eq + 1).trim();
        result[k] = isNaN(Number(v)) ? v : Number(v);
    }
    return result;
}

function buildExtra(data, skipKeys) {
    const pairs = [];
    for (const [k, v] of Object.entries(data)) {
        if (skipKeys.has(k)) continue;
        pairs.push(`${k}=${v}`);
    }
    return pairs.join(';');
}

// ────────────────────────────── EXPORT: JSON → Excel ──────────────────

function jsonToExcel() {
    const upgrades   = readJSON(UPGRADES_JSON);
    const evolutions = readJSON(EVOLUTIONS_JSON);
    const all = [...upgrades, ...evolutions];

    const upgradeRows = [];
    const effectRows  = [];

    for (const cfg of all) {
        upgradeRows.push({
            id:          cfg.id,
            name:        cfg.name,
            desc:        cfg.desc,
            tier:        cfg.tier,
            rarity:      cfg.rarity,
            category:    cfg.category,
            evolvesFrom: cfg.evolvesFrom ? cfg.evolvesFrom.join(',') : '',
        });

        for (const eff of cfg.effects) {
            const row = { upgradeId: cfg.id, effectType: eff.type };
            const d = eff.data;

            if (eff.type === 'buff') {
                row.effectId    = d.id;
                row.effectClass = d.effectClass || '';
                row.buffName    = d.name || '';
                row.duration    = d.duration ?? 0;
                row.maxStack    = d.maxStack ?? 1;
                row.targetAttr  = d.targetAttr || '';
                row.valuePerStack = d.valuePerStack ?? 0;
                row.priority    = '';
                row.policyLevel = '';
                const skip = new Set(['id', 'name', 'duration', 'maxStack', 'effectClass', 'targetAttr', 'valuePerStack']);
                row.extra = buildExtra(d, skip);
            } else if (eff.type === 'hit_effect') {
                row.effectId    = d.id || '';
                row.effectClass = d.effectClass || '';
                row.buffName    = '';
                row.duration    = '';
                row.maxStack    = '';
                row.targetAttr  = '';
                row.valuePerStack = '';
                row.priority    = d.priority ?? 50;
                row.policyLevel = '';
                const skip = new Set(['id', 'effectClass', 'priority']);
                row.extra = buildExtra(d, skip);
            } else if (eff.type === 'shoot_policy') {
                row.effectId    = '';
                row.effectClass = d.policyClass || '';
                row.buffName    = '';
                row.duration    = '';
                row.maxStack    = '';
                row.targetAttr  = '';
                row.valuePerStack = '';
                row.priority    = '';
                row.policyLevel = d.level ?? 1;
                row.extra       = '';
            }

            effectRows.push(row);
        }
    }

    const wb = XLSX.utils.book_new();

    const wsUpgrades = XLSX.utils.json_to_sheet(upgradeRows, {
        header: ['id', 'name', 'desc', 'tier', 'rarity', 'category', 'evolvesFrom'],
    });
    XLSX.utils.book_append_sheet(wb, wsUpgrades, 'upgrades');

    const wsEffects = XLSX.utils.json_to_sheet(effectRows, {
        header: ['upgradeId', 'effectType', 'effectId', 'effectClass', 'buffName',
                 'duration', 'maxStack', 'targetAttr', 'valuePerStack',
                 'priority', 'policyLevel', 'extra'],
    });
    XLSX.utils.book_append_sheet(wb, wsEffects, 'effects');

    // 列宽
    wsUpgrades['!cols'] = [
        { wch: 20 }, { wch: 14 }, { wch: 26 }, { wch: 5 }, { wch: 8 }, { wch: 8 }, { wch: 28 },
    ];
    wsEffects['!cols'] = [
        { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 24 }, { wch: 16 },
        { wch: 9 }, { wch: 9 }, { wch: 26 }, { wch: 14 },
        { wch: 9 }, { wch: 12 }, { wch: 50 },
    ];

    fs.mkdirSync(EXCEL_DIR, { recursive: true });
    XLSX.writeFile(wb, EXCEL_FILE);
    console.log(`[upgrade-excel] EXPORT 完成: ${path.relative(ROOT, EXCEL_FILE)}`);
    console.log(`  upgrades: ${upgradeRows.length} 条, effects: ${effectRows.length} 条`);
}

// ────────────────────────────── IMPORT: Excel → JSON ─────────────────

function excelToJson() {
    if (!fs.existsSync(EXCEL_FILE)) {
        console.error(`[upgrade-excel] Excel 文件不存在: ${EXCEL_FILE}`);
        console.error('  请先运行 npm run upgrade:export 生成初始 Excel');
        process.exit(1);
    }

    const wb = XLSX.readFile(EXCEL_FILE);
    const upgradeRows = XLSX.utils.sheet_to_json(wb.Sheets['upgrades']);
    const effectRows  = XLSX.utils.sheet_to_json(wb.Sheets['effects']);

    // 按 upgradeId 分组 effects
    const effectMap = new Map();
    for (const row of effectRows) {
        const uid = row.upgradeId;
        if (!effectMap.has(uid)) effectMap.set(uid, []);

        const eff = { type: row.effectType, data: {} };

        if (row.effectType === 'buff') {
            eff.data = {
                id: Number(row.effectId),
                name: row.buffName || '',
                duration: Number(row.duration) || 0,
                maxStack: Number(row.maxStack) || 1,
                effectClass: row.effectClass,
                targetAttr: row.targetAttr,
                valuePerStack: Number(row.valuePerStack) || 0,
            };
            Object.assign(eff.data, parseExtra(row.extra));
        } else if (row.effectType === 'hit_effect') {
            eff.data = {
                id: String(row.effectId),
                effectClass: row.effectClass,
                priority: Number(row.priority) || 50,
            };
            Object.assign(eff.data, parseExtra(row.extra));
        } else if (row.effectType === 'shoot_policy') {
            eff.data = {
                policyClass: row.effectClass,
                level: Number(row.policyLevel) || 1,
            };
        }

        effectMap.get(uid).push(eff);
    }

    const upgrades   = [];
    const evolutions = [];

    for (const row of upgradeRows) {
        const cfg = {
            id:       row.id,
            name:     row.name,
            desc:     row.desc,
            tier:     Number(row.tier),
            rarity:   row.rarity,
            category: row.category,
            effects:  effectMap.get(row.id) || [],
        };

        if (row.evolvesFrom && String(row.evolvesFrom).trim()) {
            cfg.evolvesFrom = String(row.evolvesFrom).split(',').map(s => s.trim());
            evolutions.push(cfg);
        } else {
            upgrades.push(cfg);
        }
    }

    writeJSON(UPGRADES_JSON, upgrades);
    writeJSON(EVOLUTIONS_JSON, evolutions);

    console.log(`[upgrade-excel] IMPORT 完成:`);
    console.log(`  upgrades.json:   ${upgrades.length} 条`);
    console.log(`  evolutions.json: ${evolutions.length} 条`);
}

// ────────────────────────────── main ─────────────────────────────────

const cmd = process.argv[2];
if (cmd === '--export' || cmd === 'export') {
    jsonToExcel();
} else if (cmd === '--import' || cmd === 'import') {
    excelToJson();
} else {
    console.log('用法:');
    console.log('  node tools/auto/upgrade-excel.js --export   # JSON → Excel');
    console.log('  node tools/auto/upgrade-excel.js --import   # Excel → JSON');
    console.log('');
    console.log('或通过 npm scripts:');
    console.log('  npm run upgrade:export');
    console.log('  npm run upgrade:import');
}
