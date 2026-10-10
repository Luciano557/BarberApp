import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { MutableRefObject, Ref } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Combina varios refs (forwardRef externo + ref interno) sobre el mismo nodo. */
export function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(node);
      else (ref as MutableRefObject<T | null>).current = node;
    }
  };
}
