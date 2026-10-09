import * as React from "react";
import { useTranslation } from "react-i18next";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { HelpCircle } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipRoot = TooltipPrimitive.Root;
/** Clear native title hints inside a custom tooltip, preserving accessible names. */
function withoutNativeTitles(children: React.ReactNode): React.ReactNode {
  if (Array.isArray(children)) return children.map(withoutNativeTitles);
  if (!React.isValidElement<{ title?: string; children?: React.ReactNode; 'aria-label'?: string }>(children)) return children;
  const props: { title?: string; children?: React.ReactNode; 'aria-label'?: string } = {};
  if (children.props.title !== undefined) {
    props.title = '';
    if (!children.props['aria-label'] && children.props.title) props['aria-label'] = children.props.title;
  }
  if (children.props.children !== undefined) props.children = withoutNativeTitles(children.props.children);
  return React.cloneElement(children, props);
}

export const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
>(({ children, title, ...props }, ref) => (
  <TooltipPrimitive.Trigger
    {...props}
    ref={ref}
    // An empty title also blocks native hints inherited from an ancestor.
    title=""
    aria-label={props['aria-label'] ?? title}
  >
    {withoutNativeTitles(children)}
  </TooltipPrimitive.Trigger>
));
TooltipTrigger.displayName = TooltipPrimitive.Trigger.displayName;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={8}
      className={cn(
        "layer-popover overflow-hidden rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 max-w-[320px]",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

/** Renders tooltip copy with newlines and **bold** segments (no HTML in locales). */
export function formatRichTooltipText(text: string): React.ReactNode {
  const lines = text.split("\n");
  return (
    <div className="flex flex-col gap-1.5 text-left leading-relaxed">
      {lines.map((line, lineIdx) => {
        if (!line.trim())
          return <div key={lineIdx} className="h-1" aria-hidden />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
        return (
          <p key={lineIdx} className="m-0">
            {parts.map((part, partIdx) => {
              if (
                part.startsWith("**") &&
                part.endsWith("**") &&
                part.length > 4
              ) {
                return (
                  <strong
                    key={partIdx}
                    className="font-semibold text-popover-foreground"
                  >
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return <React.Fragment key={partIdx}>{part}</React.Fragment>;
            })}
          </p>
        );
      })}
    </div>
  );
}

export interface TooltipProps extends React.ComponentPropsWithoutRef<
  typeof TooltipPrimitive.Root
> {
  content?: React.ReactNode;
  children: React.ReactNode;
  side?: React.ComponentPropsWithoutRef<
    typeof TooltipPrimitive.Content
  >["side"];
  contentClassName?: string;
}

export function Tooltip({
  children,
  content,
  side = "top",
  contentClassName,
  ...props
}: TooltipProps) {
  if (!content) return <>{children}</>;
  return (
    <TooltipProvider delayDuration={200}>
      <TooltipRoot {...props}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className={contentClassName}>
          {typeof content === "string"
            ? formatRichTooltipText(content)
            : content}
        </TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}

/**
 * Reusable InfoTooltip component with a generic HelpCircle icon.
 * Perfect for adding quick contextual help text next to labels.
 * Supports multiline (`\n`) and **bold** markers in `text`.
 */
export function InfoTooltip({
  text,
  children,
  contentClassName,
}: {
  text: React.ReactNode;
  children?: React.ReactNode;
  contentClassName?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);

  // If no text is provided, don't render tooltip at all to avoid empty bubbles
  if (!text) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <TooltipRoot open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          type="button"
          aria-label={t("common.fieldHelp")}
          // Keep out of tab/dialog autofocus order - otherwise opening a modal
          // focuses the first help icon and the tooltip pops open immediately.
          tabIndex={-1}
          onClick={(e) => {
            e.preventDefault();
            // On mobile devices, a tap triggers focus (which opens the tooltip) followed by a click.
            // If we toggle here, it immediately closes. Instead, we just ensure it stays open.
            // It will be closed when the user taps outside (onPointerDownOutside).
            setOpen(true);
          }}
          onPointerDown={() => {
            // For some mobile browsers, focus isn't reliably triggered on tap,
            // so we can also ensure it opens on pointer interaction.
            setOpen(true);
          }}
          className="inline-flex items-center text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-help focus:outline-none"
        >
          {children || <HelpCircle className="w-3.5 h-3.5 ml-1.5" />}
        </TooltipTrigger>
        <TooltipContent side="top" className={contentClassName} onPointerDownOutside={() => setOpen(false)}>
          {typeof text === "string" ? formatRichTooltipText(text) : text}
        </TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}
