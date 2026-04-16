import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

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
        'z-50 overflow-hidden rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 max-w-[280px]',
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export interface TooltipProps extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root> {
  content?: React.ReactNode;
  children: React.ReactNode;
  side?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>['side'];
}

export function Tooltip({ children, content, side = 'top', ...props }: TooltipProps) {
  if (!content) return <>{children}</>;
  return (
    <TooltipProvider delayDuration={200}>
      <TooltipRoot {...props}>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent side={side}>
          {typeof content === 'string' ? (
            <p className="text-left leading-relaxed whitespace-pre-wrap">{content}</p>
          ) : (
            content
          )}
        </TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}

/**
 * Reusable InfoTooltip component with a generic HelpCircle icon.
 * Perfect for adding quick contextual help text next to labels.
 */
export function InfoTooltip({ text, children }: { text: string; children?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  // If no text is provided, don't render tooltip at all to avoid empty bubbles
  if (!text) return null;
  
  return (
    <TooltipProvider delayDuration={200}>
      <TooltipRoot open={open} onOpenChange={setOpen}>
        <TooltipTrigger 
          type="button" 
          onClick={(e) => {
            e.preventDefault();
            // On mobile devices, a tap triggers focus (which opens the tooltip) followed by a click.
            // If we toggle here, it immediately closes. Instead, we just ensure it stays open.
            // It will be closed when the user taps outside (onPointerDownOutside).
            setOpen(true);
          }}
          onPointerDown={(e) => {
             // For some mobile browsers, focus isn't reliably triggered on tap,
             // so we can also ensure it opens on pointer interaction.
             setOpen(true);
          }}
          className="inline-flex items-center text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-help focus:outline-none"
        >
          {children || <HelpCircle className="w-3.5 h-3.5 ml-1.5" />}
        </TooltipTrigger>
        <TooltipContent side="top" onPointerDownOutside={() => setOpen(false)}>
          <p className="text-left leading-relaxed whitespace-pre-wrap">{text}</p>
        </TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}
