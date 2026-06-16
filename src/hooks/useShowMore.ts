import { useState } from 'react';

interface UseShowMoreOptions {
  threshold?: number;
  isDefaultView: boolean;
}

export function useShowMore<T>(list: T[], { threshold = 2, isDefaultView }: UseShowMoreOptions) {
  const [expanded, setExpanded] = useState(false);

  const visible = isDefaultView && !expanded ? list.slice(0, threshold) : list;
  const hiddenCount = list.length - threshold;
  const showDivider = isDefaultView && list.length > threshold;

  return { visible, expanded, toggle: () => setExpanded(e => !e), showDivider, hiddenCount, threshold };
}
