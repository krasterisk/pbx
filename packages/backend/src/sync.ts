import { Sequelize, DataTypes } from 'sequelize';

const sequelize = new Sequelize('krasterisk', 'krasterisk', 'gfhjkm', {
  host: 'ipbx.krasterisk.ru',
  port: 3306,
  dialect: 'mysql',
});

const TtsEngine = sequelize.define('tts_engines', {
  uid: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(128),
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'custom',
  },
  token: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  settings: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  custom_url: {
    type: DataTypes.STRING(512),
    allowNull: true,
  },
  auth_mode: {
    type: DataTypes.STRING(32),
    allowNull: true,
    defaultValue: 'none',
  },
  custom_headers: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  user_uid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  timestamps: false,
});

const SttEngine = sequelize.define('stt_engines', {
  uid: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(128),
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'custom',
  },
  token: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  settings: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  custom_url: {
    type: DataTypes.STRING(512),
    allowNull: true,
  },
  auth_mode: {
    type: DataTypes.STRING(32),
    allowNull: true,
    defaultValue: 'none',
  },
  custom_headers: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  user_uid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  timestamps: false,
});

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
    await TtsEngine.sync({ alter: true });
    console.log('TtsEngine table synced');
    await SttEngine.sync({ alter: true });
    console.log('SttEngine table synced');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  } finally {
    await sequelize.close();
  }
}

run();
