import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  // 비활성: 흐리게 + 그림자 없음 + 금지 커서 (hover 는 enabled: 에서만 반응)
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/75 active:not-aria-[haspopup]:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:saturate-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm enabled:hover:bg-primary/85",
        outline:
          "border-input bg-card text-foreground enabled:hover:bg-muted aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:enabled:hover:bg-input/50",
        secondary:
          "border-[#c9d3e3] bg-secondary text-secondary-foreground enabled:hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "enabled:hover:bg-muted enabled:hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:enabled:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive enabled:hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:enabled:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        /** 삭제처럼 되돌리기 어려운 동작 — 흰 바탕 빨간 테두리 */
        danger: "border-red-200 bg-card text-red-700 enabled:hover:bg-red-50 enabled:hover:text-red-800",
        link: "text-primary underline-offset-4 hover:underline",
      },
      // 버튼 크기는 두 가지뿐: 기본(페이지·카드·모달 공통 동작 버튼)과 icon(표 행 휴지통·사이드바 접기 같은 작은 아이콘 버튼)
      size: {
        default: "h-11 gap-2 px-5 text-base font-semibold",
        icon: "size-9 [&_svg:not([class*='size-'])]:size-[18px]",
        /** 떠 있는 원형 버튼(도움말)처럼 기본 버튼과 높이를 맞춘 아이콘 버튼 */
        "icon-lg": "size-11 [&_svg:not([class*='size-'])]:size-5",
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
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
