import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, Min, ValidateIf } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { CreateAiProviderDto, UpdateAiProviderDto } from '../ai-connectivity/ai-provider.dto';
import { AiProvidersService } from '../ai-connectivity/ai-providers.service';
import { PlatformSpeechModelsService } from '../ai-connectivity/platform-speech-models.service';
import { publicProvider } from '../ai-connectivity/provider-public';

class SpeechAnalyticsModelsDto {
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  sttProviderUid!: number | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  llmProviderUid!: number | null;
}

@ApiTags('Cloud Admin — Global models')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('cloud-admin')
export class GlobalProvidersController {
  constructor(
    private readonly providers: AiProvidersService,
    private readonly speech: PlatformSpeechModelsService,
  ) {}

  @Get('global-providers')
  @ApiOperation({ summary: 'List superadmin global model connections' })
  async list() {
    return (await this.providers.findGlobal()).map(publicProvider);
  }

  @Post('global-providers')
  @ApiOperation({ summary: 'Connect a global model' })
  async create(@Body() dto: CreateAiProviderDto) {
    return publicProvider(await this.providers.createGlobal(dto));
  }

  @Put('global-providers/:id')
  @ApiOperation({ summary: 'Update a global model connection' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAiProviderDto) {
    return publicProvider(await this.providers.updateGlobal(id, dto));
  }

  @Delete('global-providers/:id')
  @ApiOperation({ summary: 'Remove a global model connection' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.providers.removeGlobal(id);
  }

  @Get('speech-analytics-models')
  @ApiOperation({ summary: 'Speech analytics STT and LLM assigned from the global catalog' })
  speechModels() {
    return this.speech.get();
  }

  @Put('speech-analytics-models')
  @ApiOperation({ summary: 'Assign global STT and LLM models for speech analytics' })
  saveSpeechModels(@Body() dto: SpeechAnalyticsModelsDto) {
    return this.speech.set(dto.sttProviderUid ?? null, dto.llmProviderUid ?? null);
  }
}
