import { ElementType, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { classNames } from '@/shared/lib/classNames/classNames';

const textVariants = cva('text-foreground', {
  variants: {
    variant: {
      default: 'text-base',
      h1: 'text-3xl font-bold tracking-tight',
      h2: 'text-2xl font-semibold tracking-tight',
      h3: 'text-xl font-semibold tracking-tight',
      h4: 'text-lg font-semibold tracking-tight',
      large: 'text-lg font-medium',
      small: 'text-sm font-medium leading-none',
      muted: 'text-sm text-muted-foreground',
      xs: 'text-xs text-muted-foreground',
      error: 'text-sm text-red-500',
      success: 'text-sm text-green-500',
    },
    align: {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
    },
  },
  defaultVariants: {
    variant: 'default',
    align: 'left',
  },
});

export interface TextProps extends VariantProps<typeof textVariants> {
  className?: string;
  children?: ReactNode;
  as?: ElementType;
}

export const Text = ({ className, variant, align, as: Component, children, ...props }: TextProps) => {
  const tag = variant?.startsWith('h') ? variant : 'p';
  const Comp: ElementType = Component || (tag as ElementType);
  return (
    <Comp className={classNames(textVariants({ variant, align }), {}, [className || ''])} {...props}>
      {children}
    </Comp>
  );
};
