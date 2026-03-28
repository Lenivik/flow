// Field definitions for each node type's settings.
// Used by NodeSettingsPanel to render the correct controls without per-node JSX in CanvasPage.

export type SelectField = { type: 'select'; key: string; label: string; shortLabel?: string; options: [string, string][] }
export type SliderField = { type: 'slider'; key: string; label: string; shortLabel?: string; min: number; max: number; step: number }
export type CheckField  = { type: 'check';  key: string; label: string; shortLabel?: string }
export type SeedField   = { type: 'seed';   key: string; randomKey: string; label: string; shortLabel?: string; min: number; max: number }

export type FieldDef = SelectField | SliderField | CheckField | SeedField

export interface NodeSettingsConfig {
  label: string
  defaults: Record<string, unknown>
  // Each inner array is one visual group. Groups are separated by a divider in the sub-nav.
  groups: FieldDef[][]
}

const IMAGE_SIZE_OPTIONS: [string, string][] = [
  ['square', 'Square'], ['square_hd', 'Square HD'],
  ['portrait_4_3', 'Portrait 4:3'], ['portrait_16_9', 'Portrait 16:9'],
  ['landscape_4_3', 'Landscape 4:3'], ['landscape_16_9', 'Landscape 16:9'],
]

const FORMAT_OPTIONS: [string, string][] = [['png', 'PNG'], ['jpeg', 'JPEG'], ['webp', 'WebP']]

export const nodeSettings: Record<string, NodeSettingsConfig> = {
  imageGen: {
    label: 'Nano Banana 2',
    defaults: { resolution: '1K', aspectRatio: 'auto', outputFormat: 'png', safetyTolerance: '4' },
    groups: [[
      { type: 'select', key: 'resolution', label: 'Resolution', options: [['0.5K', '0.5K'], ['1K', '1K'], ['2K', '2K'], ['4K', '4K']] },
      { type: 'select', key: 'aspectRatio', label: 'Aspect Ratio', shortLabel: 'Aspect', options: [['auto', 'Auto'], ['1:1', '1:1'], ['4:3', '4:3'], ['3:4', '3:4'], ['16:9', '16:9'], ['9:16', '9:16'], ['3:2', '3:2'], ['2:3', '2:3'], ['21:9', '21:9'], ['5:4', '5:4'], ['4:5', '4:5']] },
      { type: 'select', key: 'outputFormat', label: 'Output Format', shortLabel: 'Format', options: FORMAT_OPTIONS },
      { type: 'select', key: 'safetyTolerance', label: 'Safety', options: [['1', '1 (Strict)'], ['2', '2'], ['3', '3'], ['4', '4 (Default)'], ['5', '5'], ['6', '6 (Relaxed)']] },
    ]],
  },

  flux2Flash: {
    label: 'Flux 2 Flash',
    defaults: { imageSize: 'landscape_4_3', guidanceScale: 2.5, outputFormat: 'png', enablePromptExpansion: false, enableSafetyChecker: true },
    groups: [[
      { type: 'select', key: 'imageSize', label: 'Image Size', shortLabel: 'Size', options: IMAGE_SIZE_OPTIONS },
      { type: 'slider', key: 'guidanceScale', label: 'Guidance Scale', shortLabel: 'Guidance', min: 0, max: 20, step: 0.5 },
      { type: 'select', key: 'outputFormat', label: 'Output Format', shortLabel: 'Format', options: FORMAT_OPTIONS },
      { type: 'check', key: 'enablePromptExpansion', label: 'Prompt Expansion', shortLabel: 'Expand' },
      { type: 'check', key: 'enableSafetyChecker', label: 'Safety Checker', shortLabel: 'Safety' },
    ]],
  },

  flux2Edit: {
    label: 'Flux 2 Edit',
    defaults: { guidanceScale: 2.5, numInferenceSteps: 28, outputFormat: 'png', enableSafetyChecker: true },
    groups: [[
      { type: 'slider', key: 'guidanceScale', label: 'Guidance Scale', shortLabel: 'Guidance', min: 0, max: 20, step: 0.5 },
      { type: 'slider', key: 'numInferenceSteps', label: 'Inference Steps', shortLabel: 'Steps', min: 1, max: 50, step: 1 },
      { type: 'select', key: 'outputFormat', label: 'Output Format', shortLabel: 'Format', options: FORMAT_OPTIONS },
      { type: 'check', key: 'enableSafetyChecker', label: 'Safety Checker', shortLabel: 'Safety' },
    ]],
  },

  relight: {
    label: 'Relight 2.0',
    defaults: {
      imageSize: 'square_hd', inferenceSteps: 28, randomSeed: true, seed: 42,
      initialLatent: 'none', guidanceScale: 5, cfg: 1,
      lowResDenoise: 0.98, highResDenoise: 0.95, hrDownscale: 0.5,
      enableHRFix: true, enableSafetyChecker: true, outputFormat: 'png',
    },
    groups: [
      [
        { type: 'select', key: 'imageSize', label: 'Image Size', shortLabel: 'Size', options: IMAGE_SIZE_OPTIONS },
      ],
      [
        { type: 'slider', key: 'inferenceSteps', label: 'Inference Steps', shortLabel: 'Steps', min: 1, max: 100, step: 1 },
        { type: 'slider', key: 'guidanceScale', label: 'Guidance Scale', shortLabel: 'Guidance', min: 1, max: 20, step: 0.5 },
        { type: 'slider', key: 'cfg', label: 'CFG', min: 0, max: 30, step: 0.5 },
      ],
      [
        { type: 'slider', key: 'lowResDenoise', label: 'Low-res Denoise', shortLabel: 'Lo Denoise', min: 0, max: 1, step: 0.01 },
        { type: 'slider', key: 'highResDenoise', label: 'High-res Denoise', shortLabel: 'Hi Denoise', min: 0, max: 1, step: 0.01 },
        { type: 'slider', key: 'hrDownscale', label: 'HR Downscale', shortLabel: 'HR Down', min: 0.1, max: 1, step: 0.05 },
      ],
      [
        { type: 'seed', key: 'seed', randomKey: 'randomSeed', label: 'Seed', min: 0, max: 999999 },
        { type: 'select', key: 'initialLatent', label: 'Initial Latent', shortLabel: 'Latent', options: [['none', 'None'], ['image', 'Image']] },
        { type: 'select', key: 'outputFormat', label: 'Output Format', shortLabel: 'Format', options: FORMAT_OPTIONS },
        { type: 'check', key: 'enableHRFix', label: 'Enable HR Fix', shortLabel: 'HR Fix' },
        { type: 'check', key: 'enableSafetyChecker', label: 'Safety Checker', shortLabel: 'Safety' },
      ],
    ],
  },

  trellis: {
    label: 'Trellis',
    defaults: { ssGuidanceStrength: 7.5, ssSamplingSteps: 12, slatGuidanceStrength: 3, slatSamplingSteps: 12, meshSimplify: 0.95, textureSize: '1024' },
    groups: [
      [
        { type: 'slider', key: 'ssGuidanceStrength', label: 'Struct Guidance', min: 0, max: 15, step: 0.5 },
        { type: 'slider', key: 'ssSamplingSteps', label: 'Struct Steps', min: 1, max: 50, step: 1 },
        { type: 'slider', key: 'slatGuidanceStrength', label: 'SLAT Guidance', min: 0, max: 15, step: 0.5 },
      ],
      [
        { type: 'slider', key: 'slatSamplingSteps', label: 'SLAT Steps', min: 1, max: 50, step: 1 },
        { type: 'slider', key: 'meshSimplify', label: 'Simplify', min: 0, max: 1, step: 0.05 },
        { type: 'select', key: 'textureSize', label: 'Tex Size', options: [['512', '512'], ['1024', '1024'], ['2048', '2048']] },
      ],
    ],
  },
}

// Returns a single flat defaults object for use in sidebar value fallback logic.
export function getNodeDefaults(nodeType: string): Record<string, unknown> {
  return nodeSettings[nodeType]?.defaults ?? {}
}
