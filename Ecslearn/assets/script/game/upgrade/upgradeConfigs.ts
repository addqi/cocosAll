import type { UpgradeConfig } from './types';
import { validateAll } from './UpgradeValidator';

import upgradesRaw   from '../config/upgradeConfig/upgrades.json';
import evolutionsRaw from '../config/upgradeConfig/evolutions.json';

const _upgrades:   UpgradeConfig[] = validateAll(upgradesRaw,   'upgrades.json');
const _evolutions: UpgradeConfig[] = validateAll(evolutionsRaw, 'evolutions.json');

export const ALL_UPGRADES:   readonly UpgradeConfig[] = [..._upgrades, ..._evolutions];
export const ALL_EVOLUTIONS: readonly UpgradeConfig[] = _evolutions;
