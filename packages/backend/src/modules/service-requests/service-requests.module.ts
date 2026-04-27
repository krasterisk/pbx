import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';
import { ServiceRequest } from './service-request.model';
import { CcSubject } from './cc-subject.model';
import { CcDistrict } from './cc-district.model';
import { ServiceRequestsService } from './service-requests.service';
import { ServiceRequestsController } from './service-requests.controller';
import { ServiceRequestsPublicController } from './service-requests-public.controller';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [
    ConfigModule,
    SequelizeModule.forFeature([ServiceRequest, CcSubject, CcDistrict]),
    SmsModule,
  ],
  controllers: [ServiceRequestsController, ServiceRequestsPublicController],
  providers: [ServiceRequestsService],
  exports: [ServiceRequestsService],
})
export class ServiceRequestsModule {}
