export interface HitEffectData {
    id: string;
    effectClass: string;
    /** 执行优先级，数值越小越先执行（默认 0） */
    priority?: number;
    [key: string]: any;
}
