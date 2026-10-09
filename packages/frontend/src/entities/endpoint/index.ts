export { EndpointStatus } from "./ui/EndpointStatus";
export type {
  IEndpointListItem,
  IEndpointDetail,
  IEndpointCredentials,
} from "@krasterisk/shared";
export function endpointCallerName(raw: string): string {
  return (raw || "").match(/^"(.+?)"/)?.[1] || raw || "-";
}
