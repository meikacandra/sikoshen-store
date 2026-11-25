import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { ChevronDown, Eye, EyeOff, Search, X } from 'lucide-react'
import { cn } from '../../lib/cn'

const control =
  'block w-full rounded-control border border-border-strong bg-white text-body text-charcoal placeholder:text-muted/80 transition-colors hover:border-muted focus:border-denim focus:outline-none focus:ring-2 focus:ring-denim/25 disabled:bg-surface disabled:text-muted'

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  id: string
  hideLabel?: boolean
  children: ReactNode
  className?: string
}

/** Pembungkus label + hint + pesan error yang terhubung ke kontrol. */
export function Field({ label, hint, error, id, hideLabel, children, className }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className={cn('mb-1.5 block text-caption-lg font-semibold text-charcoal', hideLabel && 'sr-only')}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-caption text-danger-fg">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-caption text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  hideLabel?: boolean
  trailing?: ReactNode
  wrapperClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, hideLabel, trailing, id, className, wrapperClassName, ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
  return (
    <Field label={label} hint={hint} error={error} id={inputId} hideLabel={hideLabel} className={wrapperClassName}>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            control,
            'h-11 px-3',
            trailing && 'pr-28',
            error && 'border-danger-fg focus:border-danger-fg focus:ring-danger-fg/20',
            className,
          )}
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
    </Field>
  )
})

export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'trailing'>>(
  function PasswordInput(props, ref) {
    const [visible, setVisible] = useState(false)
    return (
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-caption-lg font-semibold text-denim hover:bg-denim-50 focus-ring"
          >
            {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            {visible ? 'Sembunyikan' : 'Tampilkan'}
          </button>
        }
        {...props}
      />
    )
  },
)

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  hideLabel?: boolean
  options: Array<{ value: string; label: string } | { group: string; options: Array<{ value: string; label: string }> }>
  wrapperClassName?: string
}

/** Select native bergaya (aksesibel & ramah ponsel). */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, hideLabel, options, id, className, wrapperClassName, ...rest },
  ref,
) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <Field label={label} hint={hint} error={error} id={selectId} hideLabel={hideLabel} className={wrapperClassName}>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
          className={cn(control, 'h-11 cursor-pointer appearance-none pl-3 pr-10', error && 'border-danger-fg', className)}
          {...rest}
        >
          {options.map((o) =>
            'group' in o ? (
              <optgroup key={o.group} label={o.group}>
                {o.options.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </optgroup>
            ) : (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ),
          )}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      </div>
    </Field>
  )
})

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'size'> {
  value: string
  onChange: (value: string) => void
  label?: string
  className?: string
}

export function SearchInput({ value, onChange, label = 'Cari', className, placeholder, ...rest }: SearchInputProps) {
  const id = useId()
  return (
    <div className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? label}
        className={cn(control, 'h-11 pl-9 pr-10 [&::-webkit-search-cancel-button]:hidden')}
        {...rest}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Hapus pencarian"
          className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-charcoal focus-ring"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export function Checkbox({
  label,
  checked,
  onChange,
  description,
  id,
  hideLabel,
}: {
  label: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  description?: ReactNode
  id?: string
  hideLabel?: boolean
}) {
  const autoId = useId()
  const cid = id ?? autoId
  return (
    <div className="flex items-start gap-3">
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
        <input
          id={cid}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer h-5 w-5 cursor-pointer rounded-[6px] border-border-strong accent-[rgb(var(--denim))] focus-ring"
        />
      </span>
      <label htmlFor={cid} className={cn('cursor-pointer pt-0.5 text-body', hideLabel && 'sr-only')}>
        <span className="font-medium text-charcoal">{label}</span>
        {description && <span className="mt-0.5 block text-caption-lg text-muted">{description}</span>}
      </label>
    </div>
  )
}
