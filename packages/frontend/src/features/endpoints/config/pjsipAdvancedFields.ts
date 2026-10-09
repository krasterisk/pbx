import { ADVANCED_PJSIP_FIELDS as ENGINE_FIELDS } from "@/shared/config/pjsipAdvancedFields";
import { buildNatProfilePatch } from "./natProfiles";

// These columns are owned by the NAT/WebRTC controls and overwritten on save.
// Do not offer a second editor whose values would silently be discarded.
const profileFields = new Set(Object.keys(buildNatProfilePatch("nat")));
export const ADVANCED_PJSIP_FIELDS = ENGINE_FIELDS.filter(
  (field) => !profileFields.has(field),
);
