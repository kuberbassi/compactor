import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-zinc-50 hover:bg-zinc-200 text-zinc-950 dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold shadow-sm cursor-pointer transition-all active:scale-[0.98]",
        primary: "bg-zinc-50 hover:bg-zinc-200 text-zinc-950 dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold shadow-sm cursor-pointer transition-all active:scale-[0.98]",
        secondary: "bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-800 font-semibold shadow-sm cursor-pointer transition-all active:scale-[0.98]",
        outline:
          "border border-[var(--border-color)] bg-[var(--surface-color)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] font-semibold transition-all cursor-pointer",
        ghost:
          "hover:bg-zinc-800/60 text-zinc-300 hover:text-white font-medium transition-colors cursor-pointer",
        destructive:
          "bg-rose-950/40 text-rose-300 border border-rose-900/50 hover:bg-rose-900/40 font-semibold transition-all cursor-pointer",
        pill: "bg-gradient-to-r from-zinc-100 to-zinc-300 hover:from-white hover:to-zinc-200 text-zinc-950 font-black tracking-wide rounded-full shadow-md transition-all active:scale-[0.98] cursor-pointer",
        hero: "h-11 px-6 rounded-full bg-white text-zinc-950 hover:bg-zinc-100 font-black text-xs shadow-[0_0_20px_rgba(255,255,255,0.25)] hover:shadow-[0_0_28px_rgba(255,255,255,0.4)] hover:scale-105 active:scale-95 transition-all cursor-pointer",
        link: "text-primary underline-offset-4 hover:underline cursor-pointer",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants }
