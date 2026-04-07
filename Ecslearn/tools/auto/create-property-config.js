#!/usr/bin/env node
/**
 * 属性配置文件生成工具
 *
 * 用法:
 *   npm run create:property-config                    # 同步：根据 player config 生成 attributeConfigs、propConfigMap、enum
 *   npm run create:property-config -- --name=Attack   # 新建：创建 attack.json 并同步
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const PLAYER_CONFIG_DIR = path.join(PROJECT_ROOT, 'assets/script/game/player/config');
const ATTRIBUTE_CONFIGS_TS = path.join(PLAYER_CONFIG_DIR, 'attributeConfigs.ts');
const PROP_CONFIG_MAP_TS = path.join(PLAYER_CONFIG_DIR, 'propConfigMap.ts');
const ENUM_TS = path.join(PROJECT_ROOT, 'assets/script/baseSystem/properties/enum.ts');

/** tag -> EPropertyConfigId */
const TAG_TO_CONFIG_ID = {
    'base': 'BaseValueConfig',
    'add-buff': 'BaseValueBuff',
    'add-other': 'BaseValueOther',
    'mul-buff': 'MulBuff',
    'mul-other': 'MulOther',
};

/** 从 --name=xxx 解析参数 */
function parseArgs() {
    const args = process.argv.slice(2);
    const result = { name: null };
    for (const arg of args) {
        if (arg.startsWith('--name=')) {
            result.name = arg.slice(7).trim();
        }
    }
    return result;
}

/** 属性名转文件名（PascalCase → snake_case） */
function toFileName(name) {
    return name.replace(/([A-Z])/g, (m) => '_' + m.toLowerCase()).replace(/^_/, '') || name.toLowerCase();
}

/** 新建属性配置 JSON 模板 */
function createConfigTemplate(attributeName) {
    const prefix = attributeName;
    return {
        attribute: attributeName,
        valueNodes: [
            { id: `${prefix}-Value-Config`, value: 100, tag: 'base' },
            { id: `${prefix}-Value-Buff`, value: 0, tag: 'add-buff' },
            { id: `${prefix}-Value-Other`, value: 0, tag: 'add-other' },
            { id: `${prefix}-Mul-Buff`, value: 0, tag: 'mul-buff' },
            { id: `${prefix}-Mul-Other`, value: 0, tag: 'mul-other' },
        ],
        computeNodes: [
            {
                id: `${prefix}-Value`,
                expression: `{{${prefix}-Value-Config}} + {{${prefix}-Value-Buff}} + {{${prefix}-Value-Other}}`,
            },
            {
                id: attributeName,
                expression: `{{${prefix}-Value}} * (1 + {{${prefix}-Mul-Buff}} + {{${prefix}-Mul-Other}})`,
            },
        ],
    };
}

/** 文件名转变量名，如 move_speed.json → moveSpeedConfig */
function fileToVarName(filename) {
    const base = filename.replace(/\.json$/, '');
    const camel = base.replace(/[-_](.)/g, (_, c) => c.toUpperCase());
    return (camel.charAt(0).toLowerCase() + camel.slice(1)) + 'Config';
}

/** 从 JSON 构建 attribute -> { configId -> nodeId } 映射 */
function buildPropConfigMap(configs) {
    const map = {};
    for (const cfg of configs) {
        const attr = cfg.attribute;
        if (!map[attr]) map[attr] = {};
        for (const node of cfg.valueNodes || []) {
            const configId = TAG_TO_CONFIG_ID[node.tag];
            if (configId) map[attr][configId] = node.id;
        }
    }
    return map;
}

/** 生成 attributeConfigs.ts 内容 */
function generateAttributeConfigsTs(jsonFiles) {
    const imports = jsonFiles.map((f) => {
        const varName = fileToVarName(f);
        const importPath = `./${f.replace(/\.json$/, '')}.json`;
        return `import ${varName} from '${importPath}';`;
    });
    const exports = jsonFiles.map((f) => {
        const varName = fileToVarName(f);
        return `    ${varName} as AttributeConfig`;
    });

    return `import type { AttributeConfig } from '../../../baseSystem/properties/AttributeConfig';

// 由 tools/auto/create-property-config.js 自动生成，请勿直接编辑
${imports.join('\n')}

/** 玩家属性配置列表（自定义，可与怪物等配置不同） */
export const PLAYER_ATTRIBUTE_CONFIGS: AttributeConfig[] = [
${exports.map((e) => e + ',').join('\n')}
];
`;
}

/** 生成 propConfigMap.ts 内容 */
function generatePropConfigMapTs(propMap) {
    const attrKeys = Object.keys(propMap).sort();
    const lines = attrKeys.map((attr) => {
        const parts = Object.keys(propMap[attr]).sort().map((configId) => {
            const nodeId = propMap[attr][configId];
            return `        [EPropertyConfigId.${configId}]: "${nodeId}"`;
        });
        return `    [EPropertyId.${attr}]: {\n${parts.join(',\n')}\n    }`;
    });

    return `import { EPropertyConfigId, EPropertyId } from '../../../baseSystem/properties/enum';

// 由 tools/auto/create-property-config.js 自动生成，请勿直接编辑

/** 属性名 + 配置部分 -> 节点 ID，与 attribute JSON 中 valueNodes 对应 */
export const PROP_CONFIG_MAP: Record<EPropertyId, Record<EPropertyConfigId, string>> = {
${lines.join(',\n')}
};
`;
}

/** 同步 EPropertyId 枚举（追加不存在的属性） */
function syncEnumTs(attributeNames) {
    let content = fs.readFileSync(ENUM_TS, 'utf8');
    const enumBlock = content.match(/export enum EPropertyId \{([^}]+)\}/s);
    if (!enumBlock) return;
    const block = enumBlock[1];
    const existing = [];
    const re = /\b(\w+)\s*=\s*'[^']+'/g;
    let m;
    while ((m = re.exec(block)) !== null) {
        existing.push(m[1]);
    }

    const toAdd = attributeNames.filter((a) => !existing.includes(a));
    if (toAdd.length === 0) return;

    const newEntries = toAdd.map((a) => `    ${a} = '${a}'`).join(',\n');
    const insertBefore = enumBlock[0].replace(/\}\s*$/, '');
    const lastComma = insertBefore.lastIndexOf(',');
    const insertPos = lastComma >= 0 ? lastComma + 1 : insertBefore.indexOf('{') + 1;
    const newBlock = insertBefore.slice(0, insertPos) + '\n' + newEntries + ',' + insertBefore.slice(insertPos) + '\n}';
    content = content.replace(/export enum EPropertyId \{[^}]+\}/s, newBlock);
    fs.writeFileSync(ENUM_TS, content, 'utf8');
    console.log('[create:property-config] 已同步 EPropertyId 枚举:', toAdd.join(', '));
}

/** 同步模式：扫描 player config 目录，生成所有产物 */
function sync() {
    if (!fs.existsSync(PLAYER_CONFIG_DIR)) {
        fs.mkdirSync(PLAYER_CONFIG_DIR, { recursive: true });
    }

    const files = fs.readdirSync(PLAYER_CONFIG_DIR).filter((f) => f.endsWith('.json') && f !== 'property.json');
    if (files.length === 0) {
        console.log('[create:property-config] player config 目录下无属性 JSON 文件');
        return;
    }

    const configs = files.map((f) => {
        const p = path.join(PLAYER_CONFIG_DIR, f);
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    });
    const attributeNames = configs.map((c) => c.attribute);

    // 1. 生成 attributeConfigs.ts
    const attrContent = generateAttributeConfigsTs(files.sort());
    fs.writeFileSync(ATTRIBUTE_CONFIGS_TS, attrContent, 'utf8');
    console.log('[create:property-config] 已生成 attributeConfigs.ts');

    // 2. 生成 propConfigMap.ts
    const propMap = buildPropConfigMap(configs);
    const propContent = generatePropConfigMapTs(propMap);
    fs.writeFileSync(PROP_CONFIG_MAP_TS, propContent, 'utf8');
    console.log('[create:property-config] 已生成 propConfigMap.ts');

    // 3. 同步 enum.ts
    syncEnumTs(attributeNames);

    console.log('[create:property-config] 已同步', files.length, '个配置:', files.join(', '));
}

/** 新建模式：创建 JSON 并同步 */
function create(name) {
    if (!name) {
        console.error('[create:property-config] 请指定 --name=属性名，例如 --name=Attack');
        process.exit(1);
    }

    if (!fs.existsSync(PLAYER_CONFIG_DIR)) {
        fs.mkdirSync(PLAYER_CONFIG_DIR, { recursive: true });
    }

    const fileName = toFileName(name) + '.json';
    const jsonPath = path.join(PLAYER_CONFIG_DIR, fileName);

    if (fs.existsSync(jsonPath)) {
        console.log('[create:property-config] 配置已存在:', fileName);
    } else {
        const template = createConfigTemplate(name);
        fs.writeFileSync(jsonPath, JSON.stringify(template, null, 2), 'utf8');
        console.log('[create:property-config] 已创建:', jsonPath);
    }

    sync();
}

function main() {
    const { name } = parseArgs();
    if (name) {
        create(name);
    } else {
        sync();
    }
}

main();
