import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-[var(--border-color)] bg-[var(--surface-hover)] transition-colors outline-none cursor-pointer data-[size=default]:h-5 data-[size=default]:w-9 data-[size=sm]:h-4 data-[size=sm]:w-7 data-checked:bg-[var(--text-primary)] data-checked:border-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--border-color)] disabled:cursor-not-allowed disabled:opacity-50 shadow-inner",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-[var(--text-primary)] group-data-checked/switch:bg-[var(--surface-color)] shadow-md transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:translate-x-0.5 group-data-[size=default]/switch:data-checked:translate-x-[17px] group-data-[size=sm]/switch:translate-x-0.5 group-data-[size=sm]/switch:data-checked:translate-x-[13px]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
