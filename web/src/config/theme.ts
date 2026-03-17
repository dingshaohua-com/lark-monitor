/** 主题色配置，可通过环境变量 VITE_THEME_PRIMARY 覆盖，默认粉色 */
const DEFAULT_PRIMARY = '#eb2f96';

export const themeConfig = {
  token: {
    colorPrimary: import.meta.env.VITE_THEME_PRIMARY ?? DEFAULT_PRIMARY,
  },
} as const;
