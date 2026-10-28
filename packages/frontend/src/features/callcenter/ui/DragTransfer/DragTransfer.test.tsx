import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DragTransferProvider, useDragTransfer } from './DragTransfer';
import type { IAgent } from '../../model/types/callCenterSchema';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function Target({ status, online }: { status: string; online: boolean }) {
  const { requestTransfer } = useDragTransfer();
  return <button onClick={() => requestTransfer({ interface: 'PJSIP/e201_7', name: 'Colleague', status, phoneOnline: online } as IAgent)}>Transfer</button>;
}
describe('worklist colleague transfer confirmation', () => {
  it.each(['READY', 'OUTBOUND_WORK'])('transfers to an online %s colleague through the same confirmation', status => {
    const transfer = vi.fn();
    render(<DragTransferProvider activeCall={{ uniqueid: 'real.1', callerIdNum: '202' }} onTransfer={transfer}><Target status={status} online /></DragTransferProvider>);
    fireEvent.click(screen.getByText('Transfer'));
    fireEvent.click(screen.getByRole('button', { name: 'callcenter.dnd.blind' }));
    expect(transfer).toHaveBeenCalledExactlyOnceWith('PJSIP/e201_7', 'blind');
  });
  it.each([['PAUSED', true], ['IN_CALL', true], ['READY', false]] as const)('does not offer a transfer to %s / online=%s', (status, online) => {
    render(<DragTransferProvider activeCall={{ uniqueid: 'real.1', callerIdNum: '202' }} onTransfer={vi.fn()}><Target status={status} online={online} /></DragTransferProvider>);
    fireEvent.click(screen.getByText('Transfer'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
