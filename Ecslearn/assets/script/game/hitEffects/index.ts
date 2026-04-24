// ── 新原语（Step 2.4）──
import './ApplyBuffOnHitEffect';

// ── 保留独立脚本（行为差异大）──
import './DamageHitEffect';
import './LifestealHitEffect';
import './CritBonusDamageEffect';
import './LifeOnHitEffect';
import './ChainLightningEffect';
import './KnockbackEffect';

// ── onShoot 钩子系列（Step 2.11 基础设施样板）──
import './TriggerHappyEffect';

// ── 旧脚本（保留兼容，可逐步迁到 ApplyBuffOnHitEffect）──
import './BurnOnHitEffect';
import './FrostOnHitEffect';
