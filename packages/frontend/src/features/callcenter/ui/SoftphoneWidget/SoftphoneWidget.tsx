import { SoftphoneWidget as CommonSoftphoneWidget, type SoftphoneWidgetProps as CommonProps } from '@/shared/ui/SoftphoneWidget';
import { TransferDirectory } from '@/features/callcenter/ui/TransferDirectory';
import { loadDialBuffer, saveDialBuffer } from '@/features/callcenter/lib/shiftSession';
import { SoftphoneJournal } from './SoftphoneJournal';
import { SoftphoneContacts } from './SoftphoneContacts';
export type { SoftphoneWidgetPhone, SoftphoneMode, SoftphoneVariant } from '@/shared/ui/SoftphoneWidget';
export type SoftphoneWidgetProps = Omit<CommonProps, 'journalContent' | 'contactsContent' | 'renderConference' | 'dialBufferStorage'>;
const dialBufferStorage = {load:loadDialBuffer, save:saveDialBuffer};
/** CC-only integration. Shift lifecycle and page-owned transport remain unchanged. */
export function SoftphoneWidget(props: SoftphoneWidgetProps) {
  const mode = props.mode ?? 'webrtc';
  return <CommonSoftphoneWidget {...props} dialBufferStorage={dialBufferStorage}
    journalContent={<SoftphoneJournal softphoneMode={mode}/>}
    contactsContent={<SoftphoneContacts softphoneMode={mode}/>}
    renderConference={onDone => <TransferDirectory mode="conference-add" activeCallUniqueid={props.activeCallUniqueid} onDone={onDone}/>}/>;
}
