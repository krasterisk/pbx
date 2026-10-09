import {
  PjsipSettingsBuilder,
  type PjsipSettingsBuilderProps,
} from "@/shared/ui/PjsipSettingsBuilder";
import { VStack } from "@/shared/ui";
import cls from "./AdvancedSettingsBuilder.module.scss";
import { ADVANCED_PJSIP_FIELDS } from "../../config/pjsipAdvancedFields";
export type AdvancedSettingsBuilderProps = PjsipSettingsBuilderProps;
export const AdvancedSettingsBuilder = (
  props: AdvancedSettingsBuilderProps,
) => (
  <VStack max className={cls.root}>
    <PjsipSettingsBuilder fields={ADVANCED_PJSIP_FIELDS} {...props} />
  </VStack>
);
