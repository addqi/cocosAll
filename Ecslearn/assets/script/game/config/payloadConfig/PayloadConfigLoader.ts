import type { AttackPayloadDef } from '../../combat/attack/AttackPayload';
import payloadDefs from './payloads.json';

const _payloads = payloadDefs as Record<string, AttackPayloadDef>;

export function getPayloadDef(ref: string): AttackPayloadDef | null {
    return _payloads[ref] ?? null;
}

export function allPayloadIds(): string[] {
    return Object.keys(_payloads);
}
