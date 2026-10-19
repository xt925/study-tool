import type { PetType } from '@study/core'

/** 宠物页的 Rive 配置：没有配置的宠物继续用内置 SVG 形象 */
export interface RivePetConfig {
  /** .riv 文件地址，例如 riveAsset('cat.riv') */
  src: string
  /** .riv 里的 Artboard 名称；不填则用文件默认 Artboard */
  artboard?: string
  /** 状态机名称；不填则用文件默认状态机 */
  stateMachine?: string
  /** Happy 状态持续多久后切回 Idle（毫秒） */
  happyDurationMs?: number
  /** 互动时触发的 trigger 输入名（可选） */
  happyTrigger?: string
  /** 状态机里的 boolean 属性名：true 播放 Happy，false 回到 Idle */
  happyInput?: string
  /** 心情值输入名（可选，写入 0~100） */
  moodInput?: string
  /** 服装 id -> Rive View Model number 属性名（0 = 隐藏，100 = 显示） */
  outfitInputs?: Record<string, string>
  /** 表情状态 -> Rive View Model number 属性名（0 隐藏 / 100 显示） */
  faceInputs?: {
    normal: string
    eyesOpen: string
    sad: string
    hungry: string
    joy: string
  }
  /**
   * 换装：按装扮 id 指定不同的 Artboard。
   * 如果美术更习惯用状态机输入换装，也可以不填，改用 setInput。
   */
  outfits?: Partial<Record<'scarf' | 'crown', string>>
  /** 可选：覆盖默认的 rive.wasm 地址（默认已打包在本地） */
  wasmUrl?: string
  /** 素材署名：CC BY 等需要保留作者与许可信息 */
  credit?: {
    title: string
    author: string
    authorUrl: string
    license: string
    licenseUrl: string
  }
}

/** 拼出 public/rive 下的资源地址，自动带上部署 base */
export function riveAsset(file: string): string {
  return `${import.meta.env.BASE_URL}rive/${file}`
}

/**
 * 把导出的 .riv 放进 apps/h5/public/rive/，在这里按宠物类型登记即可。
 * 示例：
 * cat: {
 *   src: riveAsset('cat.riv'),
 *   artboard: 'Artboard 1',
 *   stateMachine: 'Pet',
 *   happyTrigger: 'happy',
 *   moodInput: 'mood',
 *   outfits: { scarf: 'Cat_Scarf', crown: 'Cat_Crown' },
 * },
 */
const PET_OUTFIT_INPUTS: Record<string, string> = {
  'party-hat': 'hat',
  'gold-crown': 'crown',
  'red-scarf': 'scarf',
  'blue-bow': 'bow',
  'round-glasses': 'glasses',
}

const PET_FACE_INPUTS = {
  normal: 'faceNormal',
  eyesOpen: 'eyesOpen',
  sad: 'faceSad',
  hungry: 'faceHungry',
  joy: 'faceJoy',
}

export const RIVE_PETS: Partial<Record<PetType, RivePetConfig>> = {
  cat: {
    src: riveAsset('cat.riv'),
    artboard: 'Artboard 1',
    stateMachine: 'Pet',
    happyInput: 'happy',
    happyDurationMs: 700,
    outfitInputs: PET_OUTFIT_INPUTS,
    faceInputs: PET_FACE_INPUTS,
  },
  dragon: {
    src: riveAsset('dragon.riv'),
    artboard: 'Dragon',
    stateMachine: 'Pet',
    happyInput: 'happy',
    happyDurationMs: 700,
    outfitInputs: PET_OUTFIT_INPUTS,
    faceInputs: PET_FACE_INPUTS,
  },
  penguin: {
    src: riveAsset('penguin.riv'),
    artboard: 'Penguin',
    stateMachine: 'Pet',
    happyInput: 'happy',
    happyDurationMs: 700,
    outfitInputs: PET_OUTFIT_INPUTS,
    faceInputs: PET_FACE_INPUTS,
  },
}
