import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Peer } from './peer.model';

@Injectable()
export class PeersService {
  constructor(
    @InjectModel(Peer) private readonly peerModel: typeof Peer,
  ) {}

  async findAll(userUid?: number): Promise<Peer[]> {
    const where: any = {};
    if (userUid) {
      where.vpbx_user_uid = userUid;
    }
    return this.peerModel.findAll({
      where,
      order: [['exten', 'ASC']],
      attributes: { exclude: ['secret'] },
    });
  }

  async findById(uid: number): Promise<Peer | null> {
    return this.peerModel.findByPk(uid);
  }

  async findByExten(exten: string): Promise<Peer | null> {
    return this.peerModel.findOne({ where: { exten } });
  }

  async create(data: Partial<Peer>): Promise<Peer> {
    return this.peerModel.create(data as any);
  }

  async update(uid: number, data: Partial<Peer>): Promise<Peer | null> {
    await this.peerModel.update(data, { where: { uid } });
    return this.findById(uid);
  }

  async delete(uid: number): Promise<void> {
    await this.peerModel.destroy({ where: { uid } });
  }

  async bulkDelete(uids: number[]): Promise<void> {
    await this.peerModel.destroy({ where: { uid: uids } });
  }
}
