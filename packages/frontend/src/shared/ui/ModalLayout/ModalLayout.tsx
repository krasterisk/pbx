import { forwardRef, useId, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { DialogContent } from '../Dialog';
import { SheetContent } from '../Sheet/Sheet';
import { Button } from '../Button';
import { Label } from '../Label/Label';
import { Text } from '../Text/Text';
import { Switch } from '../Switch';
import { InfoTooltip } from '../Tooltip/Tooltip';
import styles from './ModalLayout.module.scss';

type FormDialogContentProps = ComponentPropsWithoutRef<typeof DialogContent>;

/** Stable form shell; content scroll and footer remain separate. */
export const FormDialogContent = forwardRef<HTMLDivElement, FormDialogContentProps>(
  ({ className, size = 'default', ...props }, ref) => (
    <DialogContent ref={ref} size={size} data-form-modal data-modal-size={size}
      className={cn(styles.formModal, className)} {...props} />
  ),
);
FormDialogContent.displayName = 'FormDialogContent';

/** Drawer equivalent of the form shell, with a separate scrolling body. */
export const FormSheetContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof SheetContent>>(
  ({ className, ...props }, ref) => (
    <SheetContent ref={ref} data-form-modal className={cn(styles.formSheet, className)} {...props} />
  ),
);
FormSheetContent.displayName = 'FormSheetContent';

export const ModalBody = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-modal-body className={cn(styles.body, className)} {...props} />
  ),
);
ModalBody.displayName = 'ModalBody';

export interface ModalSectionProps extends ComponentPropsWithoutRef<'section'> {
  title?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  tooltip?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export function ModalSection({
  title, icon: Icon, action, tooltip, collapsible = false, defaultExpanded = false,
  className, children, ...props
}: ModalSectionProps) {
  const id = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const heading = (
    <>
      {Icon && <Icon size={18} aria-hidden className={styles.sectionIcon} />}
      {title && <Text as="h3" id={id + '-title'} className={styles.sectionTitle}>{title}</Text>}
      {tooltip && <InfoTooltip text={tooltip} />}
    </>
  );
  return (
    <section className={cn(styles.section, className)} aria-labelledby={title ? id + '-title' : undefined} {...props}>
      {(title || action) && (
        <div className={styles.sectionHeader}>
          {collapsible ? (
            <Button type="button" variant="ghost" className={styles.collapseButton}
              aria-expanded={expanded} aria-controls={id + '-content'}
              onClick={() => setExpanded(value => !value)}>
              <span className={styles.heading}>{Icon && <Icon size={18} aria-hidden className={styles.sectionIcon} />}
                {title && <Text as="h3" id={id + '-title'} className={styles.sectionTitle}>{title}</Text>}
              </span>
              <ChevronDown size={18} aria-hidden className={expanded ? styles.expanded : undefined} />
            </Button>
          ) : <div className={styles.heading}>{heading}</div>}
          {collapsible && tooltip && <InfoTooltip text={tooltip} />}
          {action && <div className={styles.sectionAction}>{action}</div>}
        </div>
      )}
      {(!collapsible || expanded) && <div id={id + '-content'} className={styles.sectionBody}>{children}</div>}
    </section>
  );
}

export interface ModalTabsProps {
  items: Array<{ id: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  label: string;
}
export function ModalTabs({ items, value, onChange, label }: ModalTabsProps) {
  return (
    <nav className={styles.tabsWrap} aria-label={label}>
      <div className={styles.tabsRow}>
        {items.map(item => (
          <Button key={item.id} type="button" variant="ghost" aria-pressed={value === item.id}
            className={cn(styles.tab, value === item.id && styles.tabActive)}
            onClick={() => onChange(item.id)}>{item.label}</Button>
        ))}
      </div>
    </nav>
  );
}

export interface ModalToggleProps extends ComponentPropsWithoutRef<typeof Switch> {
  label: string;
  tooltip?: string;
  compact?: boolean;
}
export function ModalToggle({ label, tooltip, id, compact = false, ...props }: ModalToggleProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return (
    <div className={cn(styles.toggle, compact && styles.compactToggle)}>
      <div className={styles.toggleLabel}>
        <Label htmlFor={controlId}>{label}</Label>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <Switch id={controlId} {...props} />
    </div>
  );
}
