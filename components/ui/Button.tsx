import clsx from 'clsx';
import { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

// DESIGN.md components: button-primary / button-secondary / button-danger
const VARIANTS: Record<Variant, string> = {
  primary: 'btn-shine bg-primary text-on-primary shadow-e1 hover:bg-primary-hover',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-sunken',
  ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
  danger: 'bg-danger text-on-danger hover:brightness-110',
};

export default function Button({
  variant = 'secondary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={clsx(
        'relative inline-flex h-touch shrink-0 items-center justify-center gap-2 overflow-hidden rounded-md px-4 text-label-md transition-[background-color,color,transform,filter] duration-150 active:scale-[.97] disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}
