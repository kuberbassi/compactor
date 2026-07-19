import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'quiet' };
export function ActionButton({ className, tone = 'primary', ...props }: Props) {
  return <button {...props} className={cn('button', tone === 'quiet' && 'button--quiet', className)} />;
}
