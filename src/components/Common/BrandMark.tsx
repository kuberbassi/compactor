import type { SVGProps } from 'react';

export function BrandMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return <svg className={className} viewBox="0 0 36 36" fill="none" aria-hidden="true" {...props}>
    <path d="M7 7h8v4h-4v14h4v4H7V7Zm22 0v22h-8v-4h4V11h-4V7h8Z" fill="currentColor" />
    <path d="M14 13h8v10h-8z" fill="currentColor" opacity=".35" />
    <path d="M16 16h4v4h-4z" fill="currentColor" />
  </svg>;
}
