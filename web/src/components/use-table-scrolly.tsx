import { useEffect, useRef, useState } from 'react';

/**
 * 动态计算 Antd Table 的 scroll.y 值，使表体自适应容器高度并内部滚动。
 *
 * 用法：
 * ```tsx
 * const { ref, scrollY } = useTableScrolly();
 *
 * <div ref={ref} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
 *   <Table scroll={{ y: scrollY }} pagination={false} />
 * </div>
 * ```
 *
 * 注意：ref 容器内应该只放 Table，不要放 Pagination，分页需要独立放在容器外部。
 */
export function useTableScrolly(offset = 2) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(400);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const calc = () => {
      const thead = el.querySelector<HTMLElement>('.ant-table-thead');
      const headH = thead?.getBoundingClientRect().height ?? 0;
      const available = el.getBoundingClientRect().height;
      setScrollY(Math.floor(available - headH - offset));
    };
    const observer = new ResizeObserver(calc);
    observer.observe(el);
    return () => observer.disconnect();
  }, [offset]);

  return { ref, scrollY };
}
