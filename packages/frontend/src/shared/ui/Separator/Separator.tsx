import * as React from "react"
import { classNames } from "@/shared/lib/classNames/classNames"

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
  decorative?: boolean
}

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        role={decorative ? "none" : "separator"}
        aria-orientation={decorative ? undefined : orientation}
        className={classNames(
          "shrink-0 bg-border",
          {
            "h-[1px] w-full": orientation === "horizontal",
            "h-full w-[1px]": orientation === "vertical",
          },
          [className || ""]
        )}
        {...props}
      />
    )
  }
)
Separator.displayName = "Separator"
