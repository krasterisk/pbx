import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PeersModule } from './modules/peers/peers.module';
import { RolesModule } from './modules/roles/roles.module';
import { NumbersModule } from './modules/numbers/numbers.module';
import { AmiModule } from './modules/ami/ami.module';
import { User } from './modules/users/user.model';
import { Peer } from './modules/peers/peer.model';
import { Role } from './modules/roles/role.model';
import { NumberList } from './modules/numbers/number-list.model';
import * as path from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(__dirname, '../../../.env'),
    }),
    SequelizeModule.forRoot({
      dialect: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      username: process.env.DB_USER || 'krasterisk',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'krasterisk',
      models: [User, Peer, Role, NumberList],
      autoLoadModels: false,
      synchronize: false, // IMPORTANT: never auto-sync with existing DB
      logging: false,
      define: {
        timestamps: false, // existing tables have no timestamps
        freezeTableName: true,
      },
    }),
    AuthModule,
    UsersModule,
    PeersModule,
    RolesModule,
    NumbersModule,
    AmiModule,
  ],
})
export class AppModule {}
