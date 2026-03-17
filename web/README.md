# Rsbuild project

## Setup

Install the dependencies:

```bash
pnpm install
```

## Get started

Start the dev server, and the app will be available at [http://localhost:3000](http://localhost:3000).

```bash
pnpm run dev
```

Build the app for production:

```bash
pnpm run build
```

Preview the production build locally:

```bash
pnpm run preview
```

## Learn more

To learn more about Rsbuild, check out the following resources:

- [Rsbuild documentation](https://rsbuild.rs) - explore Rsbuild features and APIs.
- [Rsbuild GitHub repository](https://github.com/web-infra-dev/rsbuild) - your feedback and contributions are welcome!



## 主题使用方式
默认：不配置时使用粉色 #eb2f96
自定义：在 .env 中设置 VITE_THEME_PRIMARY，例如：
VITE_THEME_PRIMARY=#1677ff（蓝色）
VITE_THEME_PRIMARY=#52c41a（绿色）
VITE_THEME_PRIMARY=#eb2f96（粉色）
修改 .env 后需要重启开发服务器才能生效。