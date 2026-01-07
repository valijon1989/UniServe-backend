import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApplyAgentDto } from './dto/apply-agent.dto';
import { ReviewApplicationDto } from './dto/review-application.dto';
import { UpdateAgentStatusDto } from './dto/update-agent-status.dto';
import { DeliveryService } from './delivery.service';

@Controller('delivery')
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @UseGuards(JwtAuthGuard)
  @Post('agents/apply')
  submitApplication(@CurrentUser() user: { userId: string }, @Body() dto: ApplyAgentDto) {
    return this.delivery.submitApplication(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('agents/me/application')
  getMyApplication(@CurrentUser() user: { userId: string }) {
    return this.delivery.getMyApplication(user.userId);
  }

  @Get('agents')
  listAgents(
    @Query('type') type?: string,
    @Query('region') region?: string,
    @Query('fromCountry') fromCountry?: string,
    @Query('toCountry') toCountry?: string,
    @Query('limit') limit?: string,
  ) {
    return this.delivery.listAgents({ type, region, fromCountry, toCountry, limit });
  }

  @Get('agents/:id')
  getAgent(@Param('id') id: string) {
    return this.delivery.getAgent(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/agents/applications')
  listApplications(
    @CurrentUser() user: { userId: string },
    @Query('status') status?: string,
  ) {
    return this.delivery.listApplications(user.userId, status);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('admin/agents/applications/:id')
  reviewApplication(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: ReviewApplicationDto,
  ) {
    return this.delivery.reviewApplication(user.userId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('admin/agents/:id/status')
  updateAgentStatus(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateAgentStatusDto,
  ) {
    return this.delivery.updateAgentStatus(user.userId, id, dto);
  }
}
