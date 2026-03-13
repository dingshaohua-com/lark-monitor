/// <reference types="@rsbuild/core/types" />

/**
 * Imports the SVG file as a React component.
 * @requires [@rsbuild/plugin-svgr](https://npmjs.com/package/@rsbuild/plugin-svgr)
 */
declare module '*.svg?react' {
  import type React from 'react';
  const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  export default ReactComponent;
}

declare module 'react-syntax-highlighter' {
  import type { ComponentType } from 'react';
  export const Prism: ComponentType<{
    language?: string;
    style?: Record<string, unknown>;
    customStyle?: React.CSSProperties;
    showLineNumbers?: boolean;
    wrapLongLines?: boolean;
    children?: string;
  }>;
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
  export const oneDark: Record<string, React.CSSProperties>;
}
