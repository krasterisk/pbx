import * as React from "react"
import { classNames } from "@/shared/lib/classNames/classNames"

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "vertical" | "horizontal" | "both"
}

export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, orientation = "vertical", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={classNames(
          "relative overflow-hidden",
          {
            "overflow-y-auto": orientation === "vertical" || orientation === "both",
            "overflow-x-auto": orientation === "horizontal" || orientation === "both",
          },
          [className || ""]
        )}
        {...props}
      >
        <div className="h-full w-full rounded-[inherit]">
          {children}
        </div>
      </div>
    )
  }
)
ScrollArea.displayName = "ScrollArea"
