/** 空气等级。后端只给代码，给用户看的措辞由扩展决定。 */
export type AtmosphereLevel = 'PEACEFUL' | 'REASONABLE' | 'DEBATING' | 'HOSTILE' | 'FIERCE';

/** 后端空气分析接口的返回体。 */
export type AtmosphereAnalysis = {
  flameIntensity: number;
  level: AtmosphereLevel;
  summary: string;
  evidence: string[];
  confidence: number;
};

/**
 * 失败原因在扩展内部分得清（日志、将来可能分别处理），
 * 但展示给用户时"服务不可用"与"网络不通"会合并成同一句。
 */
export type AnalysisFailureReason = 'insufficientContent' | 'unavailable' | 'network';

/** 一次分析的结局。 */
export type AnalysisOutcome =
  | { status: 'ok'; analysis: AtmosphereAnalysis }
  | { status: 'failed'; reason: AnalysisFailureReason };

const LEVELS: ReadonlySet<string> = new Set<AtmosphereLevel>([
  'PEACEFUL',
  'REASONABLE',
  'DEBATING',
  'HOSTILE',
  'FIERCE',
]);

/**
 * 校验后端返回体。
 *
 * 后端是外部系统，返回值不受我们编译期类型约束：缺字段或等级代码陌生时，
 * 面板会渲染出 undefined 或空白，不如在这里判为一次失败。
 */
export function isAtmosphereAnalysis(value: unknown): value is AtmosphereAnalysis {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<AtmosphereAnalysis>;
  return (
    typeof candidate.flameIntensity === 'number' &&
    typeof candidate.level === 'string' &&
    LEVELS.has(candidate.level) &&
    typeof candidate.summary === 'string' &&
    Array.isArray(candidate.evidence) &&
    candidate.evidence.every((item) => typeof item === 'string') &&
    typeof candidate.confidence === 'number'
  );
}
