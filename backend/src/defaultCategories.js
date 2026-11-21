/**
 * Categories that must always exist, with their fixed ids. They are upserted on
 * startup and before every category listing, can't be deleted, and keep their names.
 * Listed in display order.
 */
export const DEFAULT_CATEGORIES = [
  { id: 'ae96a52b-2452-4c1d-913b-1c24ca162adf', name: 'WashingMachine' },
  { id: 'f451c173-3f02-46c9-ba01-f8e978fcfeb3', name: 'W/P - Water Purifier' },
  { id: 'bedfe577-fa22-4e33-839a-32f48678f6ee', name: 'C/F - Ceiling Fan' },
  { id: 'cd57d1a7-b86a-459f-a184-1138ca75c344', name: 'MWO - Microwave' },
  { id: '2db5f316-30e8-4fcb-9259-adcdba03cf65', name: 'AC - Air Conditioner' },
  { id: 'd8ac8fae-9afc-40e4-a33a-7674a2df0b61', name: 'REF - Refrigerator' },
  { id: 'cba67dd0-de40-468f-8261-cf6399cc3b5f', name: 'Others' },
]

export const DEFAULT_IDS = new Set(DEFAULT_CATEGORIES.map((c) => c.id))
