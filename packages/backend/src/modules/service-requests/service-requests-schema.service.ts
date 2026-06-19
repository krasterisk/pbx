import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize';

/**
 * Ensures service_requests schema has columns required by v4 UI
 * (shared DB with v3 — migration may not have been run manually).
 */
@Injectable()
export class ServiceRequestsSchemaService implements OnModuleInit {
  private readonly logger = new Logger(ServiceRequestsSchemaService.name);

  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async onModuleInit(): Promise<void> {
    await this.ensureProductionCommentColumn();
  }

  private async ensureProductionCommentColumn(): Promise<void> {
    try {
      const [columns] = await this.sequelize.query(
        `SHOW COLUMNS FROM service_requests LIKE 'production_comment'`,
      );

      if ((columns as unknown[]).length > 0) {
        return;
      }

      this.logger.warn(
        'Column service_requests.production_comment is missing — applying schema patch',
      );

      await this.sequelize.query(
        `ALTER TABLE service_requests ADD COLUMN production_comment TEXT NULL AFTER comment`,
      );

      this.logger.log('Added service_requests.production_comment column');
    } catch (error) {
      this.logger.error(
        'Failed to ensure service_requests.production_comment column',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
