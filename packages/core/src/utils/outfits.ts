/** 换装槽位与服装定义，核心逻辑和页面共用 */

export type OutfitSlot = 'hat' | 'scarf' | 'glasses'

export interface OutfitDef {
  id: string
  name: string
  slot: OutfitSlot
  /** 购买价格（星星）；0 表示初始赠送 */
  cost: number
  emoji: string
  desc: string
  /** 初始就拥有的服装 */
  free?: boolean
}

export const OUTFIT_SLOTS: { id: OutfitSlot; name: string; emoji: string }[] = [
  { id: 'hat', name: '帽子', emoji: '🎩' },
  { id: 'scarf', name: '围巾', emoji: '🧣' },
  { id: 'glasses', name: '眼镜', emoji: '👓' },
]

export const OUTFITS: OutfitDef[] = [
  {
    id: 'red-scarf',
    name: '红围巾',
    slot: 'scarf',
    cost: 0,
    emoji: '🧣',
    desc: '暖暖的红围巾，学习时也不怕冷',
    free: true,
  },
  {
    id: 'party-hat',
    name: '派对帽',
    slot: 'hat',
    cost: 40,
    emoji: '🎉',
    desc: '尖尖的派对帽，戴上就像在过生日',
  },
  {
    id: 'gold-crown',
    name: '金色皇冠',
    slot: 'hat',
    cost: 60,
    emoji: '👑',
    desc: '闪闪发光的皇冠，戴上就是小国王',
  },
  {
    id: 'round-glasses',
    name: '圆框眼镜',
    slot: 'glasses',
    cost: 30,
    emoji: '👓',
    desc: '看起来很聪明的小圆眼镜',
  },
  {
    id: 'blue-bow',
    name: '蓝色蝴蝶结',
    slot: 'scarf',
    cost: 35,
    emoji: '🎀',
    desc: '系在脖子上的蓝色蝴蝶结，精神又可爱',
  },
]

export function findOutfit(id: string): OutfitDef | undefined {
  return OUTFITS.find((item) => item.id === id)
}

export function outfitsForSlot(slot: OutfitSlot): OutfitDef[] {
  return OUTFITS.filter((item) => item.slot === slot)
}

export const DEFAULT_OWNED_OUTFITS = OUTFITS.filter((item) => item.free).map(
  (item) => item.id,
)
