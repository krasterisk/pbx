import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { PickupGroup } from './pickup-group.model';

@Injectable()
export class PickupGroupsService {
  constructor(
    @InjectModel(PickupGroup) private pickupGroupModel: typeof PickupGroup,
  ) {}

  async findAll(userUid: number) {
    return this.pickupGroupModel.findAll({
      where: { user_uid: userUid },
      order: [['uid', 'ASC']],
    });
  }

  generateSlug(name: string): string {
    // Basic transliteration/slugification for Asterisk compatibility
    const translit: Record<string, string> = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
      'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
      'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
      'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };
    return name.toLowerCase()
      .split('')
      .map(char => translit[char] || char)
      .join('')
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  async create(name: string, userUid: number) {
    const slug = this.generateSlug(name) || `group_${Date.now()}`;
    
    // Check if exists
    const exists = await this.pickupGroupModel.findOne({
      where: { slug, user_uid: userUid }
    });
    if (exists) {
      throw new ConflictException(`Group with computed slug ${slug} already exists`);
    }

    return this.pickupGroupModel.create({
      name,
      slug,
      user_uid: userUid,
    });
  }

  async remove(uid: number, userUid: number) {
    await this.pickupGroupModel.destroy({
      where: { uid, user_uid: userUid }
    });
  }
}
