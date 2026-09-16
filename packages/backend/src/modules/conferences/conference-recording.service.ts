import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { Request, Response } from 'express';
import { AmiService } from '../ami/ami.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { normalizeTarget } from '../../shared/utils/dialplan-target.util';
import { ConferenceMeetingsService } from './conference-meetings.service';
import {
  conferenceRecordingRel,
  safeConferenceRecordingPath,
} from './conference-recording-path.util';
import { ConferenceRoomsService } from './conference-rooms.service';
import { ConferenceStateService } from './conference-state.service';
import { ConferenceMeeting } from './models/conference-meeting.model';

@Injectable()
export class ConferenceRecordingService {
  constructor(
    private readonly amiService: AmiService,
    private readonly systemSettings: SystemSettingsService,
    private readonly stateService: ConferenceStateService,
    private readonly roomsService: ConferenceRoomsService,
    private readonly meetingsService: ConferenceMeetingsService,
  ) {}

  async startForMeeting(
    room: { uid: number; number: string | number },
    meeting: Pick<ConferenceMeeting, 'uid' | 'update'> & Partial<ConferenceMeeting>,
    userLike: { vpbx_user_uid: number },
  ): Promise<void> {
    if (this.stateService.getSnapshot(room.uid).recording) return;

    const cfg = await this.systemSettings.getServerConfigRaw();
    const base = cfg.records_base_path || '/usr/records';
    const rel = conferenceRecordingRel(userLike.vpbx_user_uid, room.uid, meeting.uid);
    const dir = path.join(
      base,
      String(userLike.vpbx_user_uid),
      'conferences',
      String(room.uid),
    );
    await fs.promises.mkdir(dir, { recursive: true });
    await meeting.update({
      recording_file_rel: rel,
      has_recording: true,
    });

    const conference = normalizeTarget(
      'conference',
      { source: 'fixed', value: String(room.number) },
      userLike.vpbx_user_uid,
    );
    try {
      await this.amiService.action({
        action: 'ConfbridgeStartRecord',
        conference,
        recordFile: path.join(base, rel),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? '');
      if (!/already recording/i.test(msg)) throw err;
    }
    this.stateService.setRecording(room.uid, true);
  }

  async streamMeeting(
    roomUid: number,
    meetingUid: number,
    vpbx: number,
    req: Request,
    res: Response,
  ): Promise<void> {
    await this.roomsService.findOne(roomUid, vpbx);
    const meeting = await this.meetingsService.getByRoom(roomUid, meetingUid);
    const cfg = await this.systemSettings.getServerConfigRaw();
    const base = cfg.records_base_path || '/usr/records';
    const filePath = safeConferenceRecordingPath(base, meeting.recording_file_rel ?? '');
    if (!filePath) {
      throw new NotFoundException('Conference recording not found');
    }
    await this.streamWavFile(filePath, String(meeting.uid), req, res);
  }

  private async streamWavFile(
    filePath: string,
    uniqueid: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    let fileSize: number;
    try {
      fileSize = (await fs.promises.stat(filePath)).size;
    } catch {
      throw new NotFoundException('Conference recording not found');
    }

    const download = req?.query?.download === '1' || req?.query?.download === 'true';
    const safeName = String(uniqueid).replace(/[^\w.-]+/g, '_');
    const disposition = download ? `attachment; filename="${safeName}.wav"` : 'inline';

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Disposition', disposition);
    res.setHeader('Accept-Ranges', 'bytes');

    const rangeHeader = req?.headers?.range;
    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/i.exec(String(rangeHeader).trim());
      if (!match) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
        res.end();
        return;
      }

      let start: number;
      let end: number;

      if (match[1] === '' && match[2]) {
        const suffix = parseInt(match[2], 10);
        start = Math.max(fileSize - suffix, 0);
        end = fileSize - 1;
      } else {
        start = match[1] ? parseInt(match[1], 10) : 0;
        end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
      }

      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= fileSize) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
        res.end();
        return;
      }

      end = Math.min(end, fileSize - 1);
      const chunkSize = end - start + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunkSize);

      const stream = fs.createReadStream(filePath, { start, end });
      stream.on('error', () => {
        if (!res.headersSent) res.status(404).end();
      });
      stream.pipe(res);
      return;
    }

    res.setHeader('Content-Length', fileSize);
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) res.status(404).end();
    });
    stream.pipe(res);
  }
}
