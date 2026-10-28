import asyncio
import importlib.util
import struct
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('sip_fixture', Path(__file__).with_name('sip-autoanswer.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


class Transport:
    def __init__(self):
        self.packets = []

    def sendto(self, data, address):
        self.packets.append((data, address))


class SipFixtureTests(unittest.IsolatedAsyncioTestCase):
    def test_pcmu_rtp_sequence_and_timestamp_wrap(self):
        media = fixture.Media()
        media.transport = Transport()
        media.target = ('127.0.0.1', 10000)
        media.sequence, media.timestamp = 65535, 2**32 - 160
        media.tick()
        packet, target = media.transport.packets[0]
        self.assertEqual(len(packet), 172)
        self.assertEqual(struct.unpack('!BBHII', packet[:12])[:4], (128, 0, 65535, 2**32 - 160))
        self.assertEqual(packet[12:], b'\xff' * 160)
        self.assertEqual((media.sequence, media.timestamp, media.tx), (0, 0, 1))
        self.assertEqual(target, media.target)

    async def test_real_udp_dialog_answer_retransmit_and_bye(self):
        peer = fixture.Peer('127.0.0.1', Path('unused'))
        peer.transport = Transport()
        message = ('INVITE sip:e8700_5@127.0.0.1:5070 SIP/2.0\r\nVia: SIP/2.0/UDP 127.0.0.1:5060;branch=z9hG4bKtest\r\n'
                   'From: <sip:caller@127.0.0.1>;tag=remote\r\nTo: <sip:e8700_5@127.0.0.1>\r\n'
                   'Call-ID: owned-test-dialog\r\nCSeq: 1 INVITE\r\nContact: <sip:asterisk@127.0.0.1:5060>\r\n\r\n' +
                   fixture.sdp('127.0.0.1', 10000)).encode()
        try:
            await peer.receive(message, ('127.0.0.1', 5060))
            await peer.receive(message, ('127.0.0.1', 5060))
            self.assertEqual(len(peer.dialogs), 1)
            dialog = peer.dialogs['owned-test-dialog']
            self.assertEqual(dialog['media'].target, ('127.0.0.1', 10000))
            self.assertIn(b'SIP/2.0 200 OK', peer.transport.packets[0][0])
            peer.send_request(dialog, 'owned-test-dialog', 'INVITE', 1000, True)
            request = peer.transport.packets[-1][0]
            self.assertIn(b'a=sendonly', request)
            self.assertIn(b'To: <sip:caller@127.0.0.1>;tag=remote', request)
            await peer.receive(message.replace(b'INVITE ', b'BYE ', 1), ('127.0.0.1', 5060))
            self.assertEqual(len(peer.dialogs), 0)
            self.assertEqual(peer.errors, 0)
        finally:
            for dialog in peer.dialogs.values():
                dialog['media'].transport.close()
            await asyncio.sleep(0)


if __name__ == '__main__':
    unittest.main()
