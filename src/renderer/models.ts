/** Known Claude models available in the UI picker */
export const AVAILABLE_MODELS = [
  { id: 'claude-opus-4-6', label: 'Opus 4.6' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
] as const

export const DEFAULT_MODEL_ID = AVAILABLE_MODELS[0].id

export type ModelId = (typeof AVAILABLE_MODELS)[number]['id']

function normalizeModelId(modelId: string): string {
  return modelId.replace(/\[[^\]]+\]/g, '').trim()
}

export function isKnownModelId(modelId: string): boolean {
  const normalized = normalizeModelId(modelId)
  return AVAILABLE_MODELS.some((m) => m.id === normalized)
}

export function resolveModelId(modelId: string | null | undefined): string {
  if (modelId && isKnownModelId(modelId)) return normalizeModelId(modelId)
  return DEFAULT_MODEL_ID
}

export function getModelDisplayLabel(modelId: string): string {
  const normalizedId = normalizeModelId(modelId)
  const has1MContext = /\[\s*1m\s*\]/i.test(modelId)

  const known = AVAILABLE_MODELS.find((m) => m.id === normalizedId)
  if (known) {
    return has1MContext ? `${known.label} (1M)` : known.label
  }

  const compact = normalizedId
    .replace(/^claude-/, '')
    .replace(/-\d{8}$/, '')
  const familyMatch = compact.match(/^(opus|sonnet|haiku)-(\d+)-(\d+)$/i)
  if (familyMatch) {
    const family = familyMatch[1][0].toUpperCase() + familyMatch[1].slice(1).toLowerCase()
    const label = `${family} ${familyMatch[2]}.${familyMatch[3]}`
    return has1MContext ? `${label} (1M)` : label
  }

  return has1MContext ? `${normalizedId} (1M)` : normalizedId
}

export function getEffectiveModel(
  tab: { modelOverride: string | null },
  defaultModel: string,
): string {
  return tab.modelOverride ?? resolveModelId(defaultModel)
}
