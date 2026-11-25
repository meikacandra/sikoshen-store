import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { Spinner } from './Spinner'
import { Tooltip } from './Tooltip'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link' | 'inverse'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const base =
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-semibold transition-colors duration-150 focus-ring disabled:cursor-not-allowed aria-disabled:cursor-not-allowed'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-denim text-white hover:bg-denim-700 active:bg-denim-700 aria-disabled:bg-border-strong aria-disabled:text-white',
  secondary:
    'border border-border-strong bg-white text-charcoal hover:bg-surface active:bg-border/60 aria-disabled:text-muted aria-disabled:hover:bg-white',
  ghost: 'text-charcoal hover:bg-surface active:bg-border/60 aria-disabled:text-muted',
  danger: 'bg-danger-fg text-white hover:brightness-95 active:brightness-90 aria-disabled:opacity-60',
  link: 'px-0 text-denim underline-offset-4 hover:underline aria-disabled:text-muted',
  inverse: 'text-white/90 hover:bg-white/10 hover:text-white active:bg-white/15',
}

// Tinggi minimal 44 px di ponsel (target sentuh), lebih ringkas di layar lebar.
const sizes: Record<ButtonSize, string> = {
  sm: 'h-11 px-3 text-caption-lg sm:h-9',
  md: 'h-11 px-4 text-body',
  lg: 'h-12 px-5 text-body-lg',
  icon: 'h-11 w-11 p-0',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  loadingText?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  /**
   * Bila diisi, tombol dinonaktifkan dengan alasan yang terlihat (tooltip + teks
   * pembaca layar). Tombol tetap bisa difokus agar alasannya terbaca.
   */
  disabledReason?: string
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading,
    loadingText,
    leftIcon,
    rightIcon,
    disabledReason,
    fullWidth,
    className,
    children,
    onClick,
    type = 'button',
    ...rest
  },
  ref,
) {
  const blocked = Boolean(disabledReason) || loading
  const btn = (
    <button
      ref={ref}
      type={type}
      aria-disabled={blocked || undefined}
      aria-busy={loading || undefined}
      onClick={(e) => {
        if (blocked) {
          e.preventDefault()
          return
        }
        onClick?.(e)
      }}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...rest}
    >
      {loading ? <Spinner /> : leftIcon}
      {loading && loadingText ? loadingText : children}
      {!loading && rightIcon}
      {disabledReason && <span className="sr-only">(tidak tersedia: {disabledReason})</span>}
    </button>
  )
  if (disabledReason) return <Tooltip content={disabledReason}>{btn}</Tooltip>
  return btn
})

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant
  size?: ButtonSize
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}

/** Tautan yang tampil seperti tombol (untuk navigasi). */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  fullWidth,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)} {...rest}>
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  )
}

/** Tombol ikon saja: wajib aria-label. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, 'size' | 'children'> & { 'aria-label': string; icon: ReactNode; tooltip?: boolean }
>(function IconButton({ icon, tooltip = true, variant = 'ghost', ...rest }, ref) {
  const btn = (
    <Button ref={ref} size="icon" variant={variant} {...rest}>
      {icon}
    </Button>
  )
  return tooltip && !rest.disabledReason ? <Tooltip content={rest['aria-label']}>{btn}</Tooltip> : btn
})
