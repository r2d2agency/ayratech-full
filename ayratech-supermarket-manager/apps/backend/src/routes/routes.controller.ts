import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UnauthorizedException, BadRequestException, UseGuards, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RoutesService } from './routes.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { UploadPhotoDto } from './dto/upload-photo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('routes')
@UseGuards(JwtAuthGuard)
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post('items/:itemId/photos')
  @UseInterceptors(FileInterceptor('file'))
  uploadPhoto(
    @Param('itemId') itemId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadPhotoDto
  ) {
    console.log(`RoutesController.uploadPhoto: itemId=${itemId}, type=${body.type}, category=${body.category}, file=${file?.originalname}`);
    return this.routesService.uploadPhoto(itemId, file, body.type, body.category);
  }

  @Post()
  create(@Body() createRouteDto: CreateRouteDto) {
    return this.routesService.create(createRouteDto);
  }

  @Post('batch')
  createBatch(
    @Body()
    body: {
      dates: string[];
      promoterIds?: string[];
      items: CreateRouteDto['items'];
      status?: string;
      type?: string;
      brandId?: string;
      checklistTemplateId?: string;
      recurrenceGroup?: string;
      replaceFrom?: string;
    },
  ) {
    return this.routesService.createBatch(body);
  }
  @Get()
  findAll(@Req() req, @Query('date') date?: string) {
    return this.routesService.findAll(req.user?.userId, date);
  }

  @Get('summary')
  findAllSummary(
    @Req() req,
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.routesService.findAllSummary(req.user?.userId, { date, startDate, endDate });
  }

  @Get('client/all')
  findAllByClient(@Req() req: any) {
    if (req.user.role !== 'client') throw new UnauthorizedException();
    const id = req.user.clientId || req.user.userId || req.user.sub;
    if (!id) throw new UnauthorizedException('Client ID not found in token');
    return this.routesService.findByClient(id);
  }

  @Get('client/supermarkets')
  findClientSupermarkets(@Req() req: any) {
    if (req.user.role !== 'client') throw new UnauthorizedException();
    const id = req.user.clientId || req.user.userId || req.user.sub;
    console.log('RoutesController.findClientSupermarkets user:', JSON.stringify(req.user), 'extracted id:', id);
    if (!id) throw new BadRequestException('Client ID not found in token');
    return this.routesService.findClientSupermarkets(id);
  }

  @Get('templates/all')
  findTemplates() {
    return this.routesService.findTemplates();
  }

  @Get('inventory-due')
  getInventoryDue(
    @Query('brandId') brandId?: string,
    @Query('supermarketId') supermarketId?: string,
    @Query('dates') dates?: string,
  ) {
    const parsedDates = (dates || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    return this.routesService.getInventoryDueDates({ brandId, supermarketId, dates: parsedDates });
  }

  @Get(':id/report')
  getRouteReport(@Param('id') id: string) {
    return this.routesService.getRouteReport(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.routesService.findOne(id);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @Body() body: { date: string; promoterId?: string }) {
    return this.routesService.duplicate(id, body.date, body.promoterId);
  }

  @Post(':id/promoters')
  addPromoter(@Param('id') id: string, @Body() body: { promoterId: string }) {
    return this.routesService.addPromoter(id, body.promoterId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRouteDto: UpdateRouteDto, @Req() req: any) {
    return this.routesService.update(id, updateRouteDto, req.user);
  }

  @Delete('batch')
  removeBatch(@Query() query: { startDate: string; endDate: string; promoterId?: string }, @Req() req: any) {
    return this.routesService.removeBatch(query, req.user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('recurrence') recurrence: string, @Req() req: any) {
    return this.routesService.remove(id, req.user, recurrence === 'true');
  }

  // Rules Endpoints
  @Post('rules')
  createRule(@Body() rule: any) {
    return this.routesService.createRule(rule);
  }

  @Get('report/evidence')
  getEvidenceReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('clientId') clientId: string,
  ) {
    return this.routesService.getEvidenceReport(startDate, endDate, clientId);
  }

  @Get('photos/recent')
  findRecentPhotos(
    @Query('minutes') minutes?: string,
    @Query('clientId') clientId?: string,
  ) {
    const mins = minutes ? parseInt(minutes, 10) : 30;
    return this.routesService.findRecentPhotos(mins, clientId);
  }


  @Get('rules/all')
  findAllRules() {
    return this.routesService.findAllRules();
  }

  @Get('approvals/pending')
  findPendingApprovals() {
    return this.routesService.findPendingApprovals();
  }

  @Post('approvals/:id')
  processStockApproval(
    @Param('id') id: string,
    @Body() body: { action: 'APPROVE' | 'REJECT'; observation?: string },
  ) {
    return this.routesService.processStockApproval(id, body.action, body.observation);
  }

  @Patch('items/:itemId/products/:productId/check')
  checkProduct(
    @Param('itemId') itemId: string,
    @Param('productId') productId: string,
    @Body() body: { 
      checked?: boolean; 
      observation?: string; 
      isStockout?: boolean; 
      stockoutType?: string; 
      photos?: string[]; 
      checkInTime?: string; 
      checkOutTime?: string; 
      validityDate?: string; 
      validityQuantity?: number;
      validityStoreDate?: string;
      validityStoreQuantity?: number;
      validityStockDate?: string;
      validityStockQuantity?: number;
      stockCount?: number; 
      gondolaCount?: number;
      inventoryCount?: number;
      ruptureReason?: string;
      checklists?: any[] 
    },
    @Req() req: any
  ) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.routesService.checkProduct(itemId, productId, body, userId);
  }

  @Patch('items/:itemId')
  updateItem(
    @Param('itemId') itemId: string,
    @Body() body: { categoryPhotos?: any },
    @Req() req: any
  ) {
    return this.routesService.updateItem(itemId, body);
  }

  @Post('items/:itemId/manual-execution')
  manualExecution(
    @Param('itemId') itemId: string,
    @Body() body: { 
      checkInTime: string; 
      checkOutTime: string; 
      promoterId?: string;
      observation?: string;
      products: { 
        productId: string; 
        checked: boolean; 
        isStockout: boolean; 
        observation?: string; 
        photos?: string[];
        validityDate?: string;
        validityQuantity?: number;
      validityStoreDate?: string;
      validityStoreQuantity?: number;
      validityStockDate?: string;
      validityStockQuantity?: number;
        stockCount?: number;
      }[] 
    },
    @Req() req: any
  ) {
    return this.routesService.manualExecution(itemId, body, req.user);
  }

  @Post('items/:itemId/check-in')
  checkIn(@Param('itemId') itemId: string, @Body() body: { lat: number; lng: number; timestamp: string; entryPhoto?: string }, @Req() req: any) {
    // For check-in, we need the Employee ID (promoterId), not the User ID
    console.log('Check-in Request:', { itemId, user: req.user });
    const promoterId = req.user?.employee?.id;
    
    if (!promoterId) {
        console.error('CRITICAL: Check-in attempted without employee ID in token/request. User:', req.user);
        // We could throw here, but let's allow it to proceed (it might fail in service if logic strict)
        // Actually, service checkIn logic relies on userId being present to create RouteItemCheckin.
        // If missing, it will set status=CHECKIN but NO checkin record.
    }
    
    return this.routesService.checkIn(itemId, body, promoterId);
  }

  @Post('items/:itemId/check-out')
  checkOut(@Param('itemId') itemId: string, @Body() body: { lat: number; lng: number; timestamp: string; exitPhoto?: string }, @Req() req: any) {
    // For check-out, we need the Employee ID (promoterId), not the User ID
    const promoterId = req.user?.employee?.id;
    return this.routesService.checkOut(itemId, body, promoterId);
  }
}
