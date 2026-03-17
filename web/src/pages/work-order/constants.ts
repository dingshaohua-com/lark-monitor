export const PRIORITY_COLOR: Record<string, string> = {
  P0: 'red',
  P1: 'volcano',
  P2: 'orange',
  P3: 'blue',
  P4: 'default',
};

export const MSG_TYPE_MAP: Record<string, { label: string; color: string }> = {
  text: { label: '文本', color: 'blue' },
  post: { label: '富文本', color: 'purple' },
  interactive: { label: '卡片', color: 'orange' },
  image: { label: '图片', color: 'green' },
};

export const TAG_KEYS = ['tag_l1', 'tag_l2', 'tag_l3'];

export const priorityOptions = [
  { label: 'P0', value: 'P0' },
  { label: 'P1', value: 'P1' },
  { label: 'P2', value: 'P2' },
  { label: 'P3', value: 'P3' },
  { label: 'P4', value: 'P4' },
];
