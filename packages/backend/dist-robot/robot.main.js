"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const helmet_1 = __importDefault(require("helmet"));
const robot_app_module_1 = require("./compositions/robot-app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(robot_app_module_1.RobotAppModule);
    app.enableShutdownHooks();
    app.use((0, helmet_1.default)());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true, forbidNonWhitelisted: true, transform: true,
    }));
    const port = Number(process.env.BACKEND_PORT) || 5012;
    await app.listen(port);
}
void bootstrap();
//# sourceMappingURL=robot.main.js.map