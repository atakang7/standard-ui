import type { HTMLAttributes } from "react";

export function Kbd({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={`kbd ${className}`.trim()} {...props} />;
}
