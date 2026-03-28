import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException, UnauthorizedException, HttpException } from '@nestjs/common';
import * as sharp from 'sharp';
import { RouteItemCheckin } from './entities/route-item-checkin.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource, Brackets, IsNull, MoreThanOrEqual, Between } from 'typeorm';
import { Employee } from '../employees/entities/employee.entity';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { UPLOAD_ROOT } from '../config/upload.config';
import { Route } from './entities/route.entity';
import { RouteItem } from './entities/route-item.entity';
import { RouteItemProduct } from './entities/route-item-product.entity';
import { RouteItemProductChecklist } from './entities/route-item-product-checklist.entity';
import { RouteRule } from './entities/route-rule.entity';
import { ChecklistTemplate } from '../checklists/entities/checklist-template.entity';
import { ChecklistItemType } from '../checklists/entities/checklist-template-item.entity';
import { Client } from '../entities/client.entity';
import { Brand } from '../entities/brand.entity';
import { Product } from '../entities/product.entity';
import { Supermarket } from '../entities/supermarket.entity';
import { User } from '../users/entities/user.entity';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { WhatsappService } from '../notifications/whatsapp.service';

import { NotificationsService } from '../notifications/notifications.service';
import { RouteFactoryService } from './route-factory.service';
import { AbsencesService } from '../absences/absences.service';

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route)
    private routesRepository: Repository<Route>,
    @InjectRepository(RouteItem)
    private routeItemsRepository: Repository<RouteItem>,
    @InjectRepository(RouteItemProduct)
    private routeItemProductsRepository: Repository<RouteItemProduct>,
    @InjectRepository(RouteRule)
    private routeRulesRepository: Repository<RouteRule>,
    private dataSource: DataSource,
    private whatsappService: WhatsappService,
    private notificationsService: NotificationsService,
    private absencesService: AbsencesService,
    private configService: ConfigService,
    private routeFactoryService: RouteFactoryService,
  ) {}

  async findRecentPhotos(minutes: number = 30, clientId?: string) {
    const timeThreshold = new Date();
    timeThreshold.setMinutes(timeThreshold.getMinutes() - minutes);

    const qb = this.routeItemProductsRepository
      .createQueryBuilder('rip')
      .innerJoinAndSelect('rip.routeItem', 'ri')
      .innerJoinAndSelect('ri.supermarket', 'sm')
      .innerJoinAndSelect('rip.product', 'p')
      .leftJoinAndSelect('p.brand', 'b')
      .leftJoinAndSelect('rip.completedBy', 'u')
      .where("rip.photos IS NOT NULL")
      .andWhere('COALESCE(array_length(rip.photos, 1), 0) > 0')
      .andWhere('rip.checkOutTime >= :timeThreshold', { timeThreshold })
      .orderBy('rip.checkOutTime', 'DESC')
      .take(20);

    if (clientId) {
        qb.innerJoin('p.client', 'c')
          .andWhere('c.id = :clientId', { clientId });
    }

    const items = await qb.getMany();

    const result = [];
    for (const rip of items) {
        if (rip.photos && rip.photos.length > 0) {
            for (const photoUrl of rip.photos) {
                result.push({
                    id: rip.id,
                    photoUrl,
                    productName: rip.product.name,
                    brandName: rip.product.brand?.name || '',
                    supermarketName: rip.routeItem.supermarket.fantasyName,
                    promoterName: rip.completedBy ? rip.completedBy.fullName : 'Promotor',
                    timestamp: rip.checkOutTime
                });
            }
        }
    }

    // Fetch Category Photos
    const categoryQb = this.routeItemsRepository.createQueryBuilder('ri')
        .innerJoinAndSelect('ri.supermarket', 'sm')
        .innerJoinAndSelect('ri.route', 'r')
        .leftJoinAndSelect('r.promoter', 'p')
        .leftJoinAndSelect('r.promoters', 'ps')
        .where("ri.categoryPhotos IS NOT NULL")
        .andWhere("ri.checkInTime >= :timeThreshold", { timeThreshold }); // Use checkInTime for category photos

    // Note: Filtering category photos by client is harder because they are not directly linked to a product/client
    // We might skip client filter for category photos or try to infer it (complex)
    // For now, we return all category photos if no client filter, or skip if client filter is strict.
    // However, category photos are often generic. Let's include them if clientId is NOT provided, 
    // or if we can link them. But RouteItem doesn't link to Client directly.
    // If the user wants to see "Real Time Process", they likely want to see everything.
    
    const categoryItems = await categoryQb.getMany();

    for (const item of categoryItems) {
        if (item.categoryPhotos) {
            Object.entries(item.categoryPhotos).forEach(([catId, photos]: [string, any]) => {
                const allPhotos: string[] = [];
                // Handle various structures
                if (Array.isArray(photos)) allPhotos.push(...photos);
                else if (typeof photos === 'string') allPhotos.push(photos);
                else if (typeof photos === 'object') {
                    if (photos.before) allPhotos.push(...(Array.isArray(photos.before) ? photos.before : [photos.before]));
                    if (photos.after) allPhotos.push(...(Array.isArray(photos.after) ? photos.after : [photos.after]));
                    if (photos.storage) allPhotos.push(...(Array.isArray(photos.storage) ? photos.storage : [photos.storage]));
                }

                const validPhotos = allPhotos.filter(p => typeof p === 'string');
                
                validPhotos.forEach(url => {
                    let promoterName = 'Promotor';
                    if (item.route?.promoter?.fullName) promoterName = item.route.promoter.fullName;
                    else if (item.route?.promoters && item.route.promoters.length > 0) promoterName = item.route.promoters[0].fullName;

                    result.push({
                        id: item.id,
                        photoUrl: url,
                        productName: 'Foto de Categoria', 
                        brandName: 'Categoria', 
                        supermarketName: item.supermarket.fantasyName,
                        promoterName: promoterName,
                        timestamp: item.checkOutTime || item.checkInTime || new Date()
                    });
                });
            });
        }
    }

    // Sort combined result by timestamp descending
    return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 20);
  }

  async create(createRouteDto: CreateRouteDto) {
    console.log('RoutesService.create input:', JSON.stringify(createRouteDto));

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { items, ...routeData } = createRouteDto;

      let brand: Brand | null = null;
      if (routeData.brandId) {
        brand = await queryRunner.manager.findOne(Brand, {
          where: { id: routeData.brandId },
          relations: ['promoters', 'supermarkets', 'availabilityWindows'],
        });
        if (!brand) {
          throw new BadRequestException('Marca não encontrada');
        }

        if (!routeData.checklistTemplateId && brand.checklistTemplateId) {
          routeData.checklistTemplateId = brand.checklistTemplateId;
        }
      }
      
      // Handle promoters
      let promoters: { id: string }[] = [];
      if (routeData.promoterIds && routeData.promoterIds.length > 0) {
        promoters = routeData.promoterIds.map(id => ({ id }));
      } else if (routeData.promoterId) {
        promoters = [{ id: routeData.promoterId }];
      }

      if (brand && promoters.length > 0 && Array.isArray(brand.promoters) && brand.promoters.length > 0) {
        const allowed = new Set((brand.promoters || []).map((p: any) => p.id));
        const invalid = promoters.map(p => p.id).filter(pid => !allowed.has(pid));
        if (invalid.length > 0) {
          throw new BadRequestException('Um ou mais promotores selecionados não estão vinculados à marca.');
        }
      }

      if (brand && Array.isArray(items) && items.length > 0 && Array.isArray(brand.supermarkets) && brand.supermarkets.length > 0) {
        const allowedSm = new Set((brand.supermarkets || []).map((s: any) => s.id));
        const invalid = items.map(i => i.supermarketId).filter(id => !allowedSm.has(id));
        if (invalid.length > 0) {
          throw new BadRequestException('Um ou mais PDVs selecionados não estão vinculados à marca.');
        }
      }

      const route = this.routesRepository.create({
        ...routeData,
        promoterId: routeData.promoterId || (promoters.length > 0 ? promoters[0].id : null),
        promoter: routeData.promoterId ? { id: routeData.promoterId } : (promoters.length > 0 ? promoters[0] : null),
        promoters: promoters
      });
      console.log('RoutesService.create entity before save:', JSON.stringify(route));
      
      const savedRoute = await queryRunner.manager.save(Route, route);
      console.log('RoutesService.create saved entity:', JSON.stringify(savedRoute));

      if (items && items.length > 0) {
        if (brand) {
          const allSupermarketIdsForBrand = Array.from(new Set(items.map(i => i.supermarketId)));
          const supermarketsForBrand = await queryRunner.manager.find(Supermarket, {
            where: { id: In(allSupermarketIdsForBrand) },
            relations: ['group'],
          });
          const supermarketById = new Map(supermarketsForBrand.map(s => [s.id, s]));

          const brandProducts = await queryRunner.manager.find(Product, {
            where: { brandId: brand.id },
            relations: ['supermarketGroups'],
          });

          for (const item of items) {
            const hasExplicitProducts =
              (Array.isArray(item.products) && item.products.length > 0) ||
              (Array.isArray(item.productIds) && item.productIds.length > 0);
            if (hasExplicitProducts) continue;

            const supermarket = supermarketById.get(item.supermarketId) as any;
            const groupId = supermarket?.group?.id || null;

            const allowedProducts = brandProducts.filter(p => {
              const groups = (p as any).supermarketGroups || [];
              if (!Array.isArray(groups) || groups.length === 0) return true;
              if (!groupId) return false;
              return groups.some((g: any) => g.id === groupId);
            });

            item.productIds = allowedProducts.map(p => p.id);
            item.products = item.productIds.map((pid: string) => ({ productId: pid }));
          }
        }

        if (brand && savedRoute.date) {
          this.validateBrandAvailability(brand, savedRoute.date, items);
        }

        // Validate promoter availability for all items first
        if (savedRoute.promoters && savedRoute.promoters.length > 0) {
          for (const promoter of savedRoute.promoters) {
            for (const item of items) {
              await this.checkPromoterAvailability(
                promoter.id,
                savedRoute.date,
                item.startTime,
                item.estimatedDuration
              );
            }
          }
        }

        // Pre-fetch products and checklists
        const allProductIds = new Set<string>();
        const allChecklistTemplateIds = new Set<string>();
        const allSupermarketIds = new Set<string>();

        items.forEach(item => {
          allSupermarketIds.add(item.supermarketId);
          if (item.productIds) item.productIds.forEach(id => allProductIds.add(id));
          if (item.products) {
              item.products.forEach(p => {
                  allProductIds.add(p.productId);
                  if (p.checklistTemplateId) allChecklistTemplateIds.add(p.checklistTemplateId);
              });
          }
        });

        // Pre-fetch Supermarkets with Groups
        const supermarketsMap = new Map<string, any>();
        if (allSupermarketIds.size > 0) {
            const supermarkets = await queryRunner.manager.find('Supermarket', {
                where: { id: In(Array.from(allSupermarketIds)) },
                relations: ['group']
            });
            supermarkets.forEach((s: any) => supermarketsMap.set(s.id, s));
        }

        const productsMap = new Map<string, Product>();
        if (allProductIds.size > 0) {
          const products = await queryRunner.manager.find(Product, {
              where: { id: In(Array.from(allProductIds)) },
              relations: [
                'checklistTemplate',
                'checklistTemplate.items',
                'checklistTemplate.items.competitor',
                'checklistTemplate.items.competitors',
                'supermarketGroups',
                'client',
                'brand',
                'brand.client'
              ]
          });
          products.forEach(p => {
            productsMap.set(p.id, p);
            const brand: any = (p as any).brand;
            if (brand?.checklistTemplateId) {
              allChecklistTemplateIds.add(brand.checklistTemplateId);
            }

            const client: any = (p as any).client || brand?.client;
            if (client?.defaultVisitChecklistTemplateId) {
              allChecklistTemplateIds.add(client.defaultVisitChecklistTemplateId);
            }
            if (client?.defaultInventoryChecklistTemplateId) {
              allChecklistTemplateIds.add(client.defaultInventoryChecklistTemplateId);
            }
          });
        }

        const checklistTemplatesMap = new Map<string, ChecklistTemplate>();
        if (allChecklistTemplateIds.size > 0) {
            const templates = await queryRunner.manager.find(ChecklistTemplate, {
                where: { id: In(Array.from(allChecklistTemplateIds)) },
                relations: ['items', 'items.competitor', 'items.competitors']
            });
            templates.forEach(t => checklistTemplatesMap.set(t.id, t));
        }

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const routeItem = this.routeItemsRepository.create({
            supermarket: { id: item.supermarketId },
            supermarketId: item.supermarketId,
            route: { id: savedRoute.id },
            routeId: savedRoute.id,
            order: item.order || i + 1,
            startTime: item.startTime,
            endTime: item.endTime,
            estimatedDuration: item.estimatedDuration
          });
          const savedItem = await queryRunner.manager.save(RouteItem, routeItem);
          const currentSupermarket = supermarketsMap.get(item.supermarketId);

          const itemProductsToProcess: { productId: string; checklistTemplateId?: string; checklistTypes?: string[]; requiresStockPhotos?: boolean }[] = [];
          if (item.products) itemProductsToProcess.push(...item.products);
          if (item.productIds) {
             item.productIds.forEach(pid => {
                 if (!itemProductsToProcess.find(p => p.productId === pid)) {
                     itemProductsToProcess.push({ productId: pid });
                 }
             });
          }

          if (itemProductsToProcess.length > 0) {
            for (const prodData of itemProductsToProcess) {
               const product = productsMap.get(prodData.productId);
               const forcedTypes = Array.isArray(prodData.checklistTypes)
                 ? Array.from(new Set(prodData.checklistTypes.map(t => String(t).toUpperCase()).filter(Boolean)))
                 : [];
               
               // FILTERING LOGIC: Check Assortment (SupermarketGroup)
               if (!this.routeFactoryService.shouldAddProductToSupermarket(product, currentSupermarket)) {
                   continue;
               }

               const rip = this.routeItemProductsRepository.create({
                   routeItem: { id: savedItem.id },
                   routeItemId: savedItem.id,
                   product: { id: prodData.productId },
                   productId: prodData.productId,
                   checklistTemplateId: prodData.checklistTemplateId,
                   checklistTypes: forcedTypes.length > 0 ? forcedTypes : null,
                   requiresStockPhotos: !!prodData.requiresStockPhotos
               });
               const savedRip = await queryRunner.manager.save(RouteItemProduct, rip);

               if (forcedTypes.length > 0) {
                   await this.routeFactoryService.createChecklistsFromTypes(queryRunner.manager, savedRip, forcedTypes as any);
               } else {
                   const checklistTemplate = this.routeFactoryService.resolveChecklistTemplate(
                       product,
                       prodData.checklistTemplateId,
                       savedRoute.checklistTemplateId,
                       checklistTemplatesMap,
                       savedRoute.type
                   );
                   
                   if (checklistTemplate) {
                       await this.routeFactoryService.createChecklists(queryRunner.manager, savedRip, checklistTemplate);
                   }
               }
            }
          }
        }
      }

      await queryRunner.commitTransaction();
      return this.findOne(savedRoute.id);
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      
      if (err.status === 400 || err.name === 'BadRequestException' || err instanceof BadRequestException) {
          throw new BadRequestException(err.message);
      }
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async addPromoter(routeId: string, promoterId: string) {
    const route = await this.routesRepository.findOne({
        where: { id: routeId },
        relations: ['promoters']
    });

    if (!route) throw new NotFoundException('Route not found');

    const promoter = await this.dataSource.getRepository(Employee).findOne({ where: { id: promoterId } });
    if (!promoter) throw new NotFoundException('Promoter not found');

    // Check if already assigned
    if (route.promoters && route.promoters.some(p => p.id === promoterId)) {
        return route; // Already assigned
    }

    if (!route.promoters) route.promoters = [];
    route.promoters.push(promoter as Employee);
    
    // Maintain backward compatibility
    if (!route.promoterId) {
        route.promoter = promoter as Employee;
        route.promoterId = promoterId;
    }

    // Workaround for type issue:
    // The Route entity defines 'promoters' as Employee[], but TypeORM save might complain if we pass partial objects
    // or if the type checking is strict about missing properties.
    // However, for relations, we usually just need the ID.
    // The error says: "Type 'ObjectLiteral' is missing the following properties from type 'Employee': id, fullName, cpf, rg, and 30 more."
    // This suggests that 'promoter' variable is typed as ObjectLiteral or similar, but the entity expects full Employee.
    // We already fetched 'promoter' from DB as Employee, so it should be fine unless the type inference is wrong.
    // Let's cast it to any to bypass the strict check during assignment if needed, or ensure it's fully typed.
    
    // Actually, looking at the error log:
    // src/routes/routes.service.ts:201:26 - error TS2345: Argument of type 'ObjectLiteral' is not assignable to parameter of type 'Employee'.
    // src/routes/routes.service.ts:205:9 - error TS2740: Type 'ObjectLiteral' is missing the following properties from type 'Employee'
    
    // The 'promoter' variable comes from:
    // const promoter = await this.dataSource.getRepository(Employee).findOne({ where: { id: promoterId } });
    
    // If it's found, it is an Employee.
    // Wait, lines 5, 201, 205 in the error log correspond to the file content.
    
    // Let's explicitely type it or cast it.
    
    await this.routesRepository.save(route);
    return this.findOne(route.id);
  }

  async findAll(userId?: string, date?: string) {
    let allowedClientIds: string[] | null = null;
    let restrictToPromoterId: string | null = null;
    
    if (userId) {
        const userRepo = this.dataSource.getRepository(User);
        const user = await userRepo.findOne({ 
            where: { id: userId }, 
            relations: ['clients', 'role', 'employee'] 
        });

        if (user) {
            const roleName = user.role?.name?.toLowerCase() || '';
            const isAdmin = ['admin', 'administrador do sistema', 'manager', 'rh'].includes(roleName);
            
            console.log(`RoutesService.findAll: User ${user.email} (${userId}), Role: ${roleName}, IsAdmin: ${isAdmin}, Employee: ${user.employee?.id}, Clients: ${user.clients?.length}`);

            if (!isAdmin) {
                // 1. Client Restriction
                if (user.clients && user.clients.length > 0) {
                    allowedClientIds = user.clients.map(c => c.id);
                    console.log('RoutesService.findAll: Restricting by Clients:', allowedClientIds);
                } else if (roleName.includes('supervisor')) {
                    // Existing logic: Supervisors without clients see nothing? 
                    // Keeping this behavior for now to avoid regressions, but it seems strict.
                    if (!allowedClientIds) allowedClientIds = [];
                    console.log('RoutesService.findAll: Supervisor role detected, but no clients linked?');
                }

                // 2. Promoter Restriction (Decoupled from Client Restriction)
                // If user has an employee record, isn't a supervisor, and isn't a client account -> Restrict to their ID.
                // This ensures Promoters ONLY see their routes, even if they accidentally have clients linked.
                const isSupervisor = roleName.includes('supervisor');
                const isClient = roleName === 'client';

                if (user.employee && !isSupervisor && !isClient) {
                    restrictToPromoterId = user.employee.id;
                    console.log('RoutesService.findAll: Restricting to Promoter:', restrictToPromoterId);
                    // If restricting to specific promoter, ignore client restrictions to ensure they see all assigned routes
                    allowedClientIds = null;
                }

                // 3. Fallback: If no filters set, show nothing
                if (!allowedClientIds && !restrictToPromoterId) {
                    allowedClientIds = [];
                    console.log('RoutesService.findAll: No access rights detected');
                }
            }
        }
    }

    const qb = this.routesRepository.createQueryBuilder('route')
      .leftJoinAndSelect('route.items', 'items')
      .leftJoinAndSelect('items.supermarket', 'supermarket')
      .leftJoinAndSelect('supermarket.group', 'group')
      .leftJoinAndSelect('route.promoter', 'promoter')
      .leftJoinAndSelect('route.promoters', 'promoters')
      .leftJoinAndSelect('promoter.supervisor', 'supervisor')
      .leftJoinAndSelect('items.products', 'itemProducts')
      .leftJoinAndSelect('itemProducts.product', 'product')
      .leftJoinAndSelect('itemProducts.completedBy', 'completedBy')
      .leftJoinAndSelect('itemProducts.checklists', 'checklists')
      .leftJoinAndSelect('product.brand', 'brand')
      .leftJoinAndSelect('brand.checklistTemplate', 'brandChecklistTemplate')
      .leftJoinAndSelect('brandChecklistTemplate.items', 'brandTemplateItems')
      .leftJoinAndSelect('brandTemplateItems.competitors', 'brandTemplateCompetitors')
      .leftJoinAndSelect('product.checklistTemplate', 'checklistTemplate')
      .leftJoinAndSelect('checklistTemplate.items', 'templateItems')
      .leftJoinAndSelect('templateItems.competitors', 'templateCompetitors')
      .leftJoinAndSelect('items.checkins', 'checkins')
      .leftJoinAndSelect('checkins.promoter', 'checkinPromoter')
      .where('route.isTemplate IS NOT TRUE')
      .orderBy('route.date', 'DESC');

    if (date) {
        qb.andWhere('route.date = :date', { date });
    }

    if (restrictToPromoterId) {
        qb.andWhere('(promoter.id = :promoterId OR promoters.id = :promoterId)', { promoterId: restrictToPromoterId });
    }

    if (allowedClientIds !== null) {
        if (allowedClientIds.length === 0) {
            return [];
        }
        
        qb.leftJoin('product.client', 'productClient')
          .leftJoin('brand.client', 'brandClient')
          .leftJoin('supermarket.clients', 'smClient')
          .andWhere(
              '(productClient.id IN (:...clientIds) OR brandClient.id IN (:...clientIds) OR smClient.id IN (:...clientIds))',
              { clientIds: allowedClientIds }
          );
    }

    return qb.getMany();
  }

  async findAllSummary(
    userId?: string,
    filters?: { date?: string; startDate?: string; endDate?: string },
  ) {
    const date = filters?.date;
    const startDate = filters?.startDate;
    const endDate = filters?.endDate;

    let allowedClientIds: string[] | null = null;
    let restrictToPromoterId: string | null = null;

    if (userId) {
      const userRepo = this.dataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { id: userId },
        relations: ['clients', 'role', 'employee'],
      });

      if (user) {
        const roleName = user.role?.name?.toLowerCase() || '';
        const isAdmin = ['admin', 'administrador do sistema', 'manager', 'rh'].includes(roleName);

        if (!isAdmin) {
          if (user.clients && user.clients.length > 0) {
            allowedClientIds = user.clients.map(c => c.id);
          } else if (roleName.includes('supervisor')) {
            if (!allowedClientIds) allowedClientIds = [];
          }

          const isSupervisor = roleName.includes('supervisor');
          const isClient = roleName === 'client';

          if (user.employee && !isSupervisor && !isClient) {
            restrictToPromoterId = user.employee.id;
            allowedClientIds = null;
          }

          if (!allowedClientIds && !restrictToPromoterId) {
            allowedClientIds = [];
          }
        }
      }
    }

    const qb = this.routesRepository
      .createQueryBuilder('route')
      .leftJoin('route.items', 'items')
      .leftJoin('items.supermarket', 'supermarket')
      .leftJoin('supermarket.clients', 'smClient')
      .leftJoin('route.brand', 'brand')
      .leftJoin('brand.client', 'brandClient')
      .leftJoin('route.promoter', 'promoter')
      .leftJoin('route.promoters', 'promoters')
      .leftJoin('items.checkins', 'checkins')
      .where('route.isTemplate IS NOT TRUE')
      .orderBy('route.date', 'DESC');

    qb.select('route.id', 'route_id')
      .addSelect('route.date', 'route_date')
      .addSelect('route.status', 'route_status')
      .addSelect('route.type', 'route_type')
      .addSelect('route.isTemplate', 'route_isTemplate')
      .addSelect('route.recurrenceGroup', 'route_recurrenceGroup')
      .addSelect('promoter.id', 'promoter_id')
      .addSelect('promoter.fullName', 'promoter_fullName')
      .addSelect('promoters.id', 'promoters_id')
      .addSelect('promoters.fullName', 'promoters_fullName')
      .addSelect('items.id', 'item_id')
      .addSelect('items.status', 'item_status')
      .addSelect('items.order', 'item_order')
      .addSelect('items.startTime', 'item_startTime')
      .addSelect('items.endTime', 'item_endTime')
      .addSelect('items.estimatedDuration', 'item_estimatedDuration')
      .addSelect('items.checkInTime', 'item_checkInTime')
      .addSelect('items.checkOutTime', 'item_checkOutTime')
      .addSelect('supermarket.id', 'supermarket_id')
      .addSelect('supermarket.fantasyName', 'supermarket_fantasyName')
      .addSelect('supermarket.street', 'supermarket_street')
      .addSelect('supermarket.number', 'supermarket_number')
      .addSelect('supermarket.neighborhood', 'supermarket_neighborhood')
      .addSelect('supermarket.city', 'supermarket_city')
      .addSelect('supermarket.state', 'supermarket_state')
      .addSelect('supermarket.zipCode', 'supermarket_zipCode')
      .addSelect('checkins.id', 'checkin_id')
      .addSelect('checkins.promoterId', 'checkin_promoterId')
      .addSelect('checkins.checkInTime', 'checkin_checkInTime')
      .addSelect('checkins.checkOutTime', 'checkin_checkOutTime');

    if (date) {
      qb.andWhere('route.date = :date', { date });
    } else if (startDate && endDate) {
      qb.andWhere('route.date BETWEEN :startDate AND :endDate', { startDate, endDate });
    } else if (startDate) {
      qb.andWhere('route.date >= :startDate', { startDate });
    } else if (endDate) {
      qb.andWhere('route.date <= :endDate', { endDate });
    }

    if (restrictToPromoterId) {
      qb.andWhere('(promoter.id = :promoterId OR promoters.id = :promoterId)', { promoterId: restrictToPromoterId });
    }

    if (allowedClientIds !== null) {
      if (allowedClientIds.length === 0) {
        return [];
      }
      qb.andWhere('(brandClient.id IN (:...clientIds) OR smClient.id IN (:...clientIds))', { clientIds: allowedClientIds });
    }

    const rows = await qb.getRawMany();
    const routesById = new Map<string, any>();
    const itemsByRoute = new Map<string, Map<string, any>>();

    const ensureRoute = (routeId: string) => {
      const existing = routesById.get(routeId);
      if (existing) return existing;
      const created: any = {
        id: routeId,
        date: null,
        status: null,
        type: null,
        isTemplate: false,
        recurrenceGroup: null,
        promoter: null,
        promoters: [],
        items: [],
      };
      routesById.set(routeId, created);
      itemsByRoute.set(routeId, new Map());
      return created;
    };

    for (const r of rows) {
      const routeId = r.route_id;
      if (!routeId) continue;

      const route = ensureRoute(routeId);
      route.date = route.date ?? r.route_date;
      route.status = route.status ?? r.route_status;
      route.type = route.type ?? r.route_type;
      route.isTemplate = Boolean(r.route_isTemplate);
      route.recurrenceGroup = route.recurrenceGroup ?? r.route_recurrenceGroup;

      if (r.promoter_id && !route.promoter) {
        route.promoter = { id: r.promoter_id, fullName: r.promoter_fullName };
      }

      if (r.promoters_id) {
        const has = (route.promoters || []).some((p: any) => p?.id === r.promoters_id);
        if (!has) {
          route.promoters = [...(route.promoters || []), { id: r.promoters_id, fullName: r.promoters_fullName }];
        }
      }

      if (r.item_id) {
        const map = itemsByRoute.get(routeId)!;
        let item = map.get(r.item_id);
        if (!item) {
          item = {
            id: r.item_id,
            status: r.item_status,
            order: r.item_order,
            startTime: r.item_startTime,
            endTime: r.item_endTime,
            estimatedDuration: r.item_estimatedDuration,
            checkInTime: r.item_checkInTime,
            checkOutTime: r.item_checkOutTime,
            supermarket: r.supermarket_id
              ? {
                  id: r.supermarket_id,
                  fantasyName: r.supermarket_fantasyName,
                  street: r.supermarket_street,
                  number: r.supermarket_number,
                  neighborhood: r.supermarket_neighborhood,
                  city: r.supermarket_city,
                  state: r.supermarket_state,
                  zipCode: r.supermarket_zipCode,
                }
              : null,
            checkins: [],
          };
          map.set(r.item_id, item);
          route.items.push(item);
        }

        if (r.checkin_id) {
          const exists = (item.checkins || []).some((c: any) => c?.id === r.checkin_id);
          if (!exists) {
            item.checkins.push({
              id: r.checkin_id,
              promoterId: r.checkin_promoterId,
              checkInTime: r.checkin_checkInTime,
              checkOutTime: r.checkin_checkOutTime,
            });
          }
        }
      }
    }

    return Array.from(routesById.values());
  }

  findByPromoter(promoterId: string) {
    return this.routesRepository.find({
      where: [
          { promoter: { id: promoterId } },
          { promoters: { id: promoterId } }
      ],
      relations: [
        'promoters',
        'items', 
        'items.supermarket', 
        'items.supermarket.group',
        'items.products', 
        'items.products.completedBy',
        'items.products.product', 
        'items.products.product.brand',
        'items.products.product.brand.checklistTemplate',
        'items.products.product.brand.checklistTemplate.items',
        'items.products.product.brand.checklistTemplate.items.competitor',
        'items.products.product.brand.checklistTemplate.items.competitors',
        'items.products.product.checklistTemplate',
        'items.products.product.checklistTemplate.items',
        'items.products.product.checklistTemplate.items.competitor',
        'items.products.product.checklistTemplate.items.competitors'
      ],
      order: { date: 'DESC' }
    });
  }

  async findByClient(clientId: string) {
    console.log('RoutesService.findByClient called with:', clientId);
    try {
      const routes = await this.routesRepository.createQueryBuilder('route')
        .innerJoinAndSelect('route.items', 'items')
        .innerJoinAndSelect('items.supermarket', 'supermarket')
        .leftJoinAndSelect('route.promoter', 'promoter')
        .leftJoinAndSelect('items.products', 'itemProducts')
        .leftJoinAndSelect('itemProducts.completedBy', 'completedBy')
        .leftJoinAndSelect('itemProducts.checklists', 'checklists')
        .leftJoinAndSelect('itemProducts.product', 'product')
        .leftJoinAndSelect('product.checklistTemplate', 'checklistTemplate')
        .leftJoinAndSelect('checklistTemplate.items', 'templateItems')
        .leftJoinAndSelect('templateItems.competitors', 'templateCompetitors')
        .leftJoinAndSelect('product.client', 'productClient')
        .leftJoinAndSelect('product.brand', 'brand')
        .leftJoinAndSelect('brand.checklistTemplate', 'brandChecklistTemplate')
        .leftJoinAndSelect('brandChecklistTemplate.items', 'brandTemplateItems')
        .leftJoinAndSelect('brandTemplateItems.competitors', 'brandTemplateCompetitors')
        .leftJoinAndSelect('brand.client', 'brandClient')
        .leftJoin('supermarket.clients', 'smClient')
        .where('productClient.id = :clientId', { clientId })
        .orWhere('brandClient.id = :clientId', { clientId })
        .orWhere('smClient.id = :clientId', { clientId })
        .orderBy('route.date', 'DESC')
        .getMany();
        
      console.log(`RoutesService.findByClient found ${routes.length} routes`);
      return routes;
    } catch (error) {
      console.error('Error in findByClient:', error);
      throw new InternalServerErrorException('Error fetching client routes');
    }
  }

  async findClientSupermarkets(clientId: string) {
    console.log('RoutesService.findClientSupermarkets called with:', clientId);
    if (!clientId) {
      console.error('RoutesService.findClientSupermarkets: No clientId provided');
      return [];
    }

    try {
      const client = await this.dataSource.getRepository(Client).findOne({
        where: { id: clientId },
        relations: ['supermarkets']
      });
      
      if (!client) {
        console.warn(`RoutesService.findClientSupermarkets: Client not found for id ${clientId}`);
        return [];
      }

      console.log(`RoutesService.findClientSupermarkets found ${client.supermarkets?.length || 0} supermarkets`);
      return client.supermarkets || [];
    } catch (error) {
      console.error('Error in findClientSupermarkets:', error);
      // Do not throw 500, return empty array to prevent frontend crash
      // or rethrow as InternalServerErrorException if you want to signal failure
      // For now, let's return empty array but log the error
      return [];
    }
  }

  findTemplates() {
    return this.routesRepository.find({
      where: { isTemplate: true },
      relations: ['items', 'items.supermarket', 'promoter', 'items.products', 'items.products.product']
    });
  }

  async duplicate(id: string, newDate: string, newPromoterId?: string) {
    const originalRoute = await this.findOne(id);
    if (!originalRoute) {
      throw new Error('Route not found');
    }

    const { id: _, items, ...routeData } = originalRoute;
    
    // Create new route object
    const newRouteData: CreateRouteDto = {
      ...routeData,
      date: newDate,
      promoterId: newPromoterId || originalRoute.promoterId,
      status: 'DRAFT', // Reset status for new route
      isTemplate: false, // Duplicated route is usually an actual route
      templateName: null,
      items: items.map(item => ({
        supermarketId: item.supermarketId,
        order: item.order,
        startTime: item.startTime,
        endTime: item.endTime,
        estimatedDuration: item.estimatedDuration,
        productIds: item.products.map(p => p.productId)
      }))
    };

    return this.create(newRouteData);
  }

  async createBatch(body: { 
    dates: string[]; 
    promoterIds?: string[]; 
    items: CreateRouteDto['items']; 
    status?: string; 
    type?: string;
    brandId?: string;
    checklistTemplateId?: string;
    recurrenceGroup?: string;
    replaceFrom?: string;
  }) {
    const { dates, promoterIds, items, status, type, replaceFrom, brandId, checklistTemplateId } = body;
    let { recurrenceGroup } = body;

    if (!dates || dates.length === 0) {
      throw new BadRequestException('Nenhuma data selecionada');
    }

    // Generate new group ID if not provided
    if (!recurrenceGroup) {
      recurrenceGroup = uuidv4();
    }

    // If replaceFrom is provided, delete future routes in this group
          if (replaceFrom && recurrenceGroup) {
            await this.routesRepository.delete({
              recurrenceGroup,
              date: MoreThanOrEqual(replaceFrom),
              status: In(['DRAFT', 'CONFIRMED']) // Allow updating drafts and confirmed routes
            });
          }

    const results = [];
    for (const date of dates) {
      const dto: CreateRouteDto = {
        date,
        promoterIds,
        status: status || 'DRAFT',
        isTemplate: false,
        items,
        type: type || 'VISIT',
        brandId,
        checklistTemplateId,
        recurrenceGroup
      };
      const created = await this.create(dto);
      results.push(created);
    }
    return results;
  }
  findOne(id: string) {
    return this.routesRepository.findOne({
      where: { id },
      relations: [
        'brand',
        'checklistTemplate',
        'promoters', 
        'items', 
        'items.supermarket', 
        'items.supermarket.group',
        'promoter', 
        'items.products', 
        'items.products.product', 
        'items.products.product.client',
        'items.products.product.brand',
        'items.products.product.brand.checklistTemplate',
        'items.products.product.brand.checklistTemplate.items',
        'items.products.product.brand.checklistTemplate.items.competitor',
        'items.products.product.brand.checklistTemplate.items.competitors',
        'items.products.product.checklistTemplate',
        'items.products.product.checklistTemplate.items',
        'items.products.product.checklistTemplate.items.competitor',
        'items.products.product.checklistTemplate.items.competitors',
        'items.products.checklists',
         'items.products.checklists.completedBy',
         'items.products.completedBy',
         'items.checkins',
         'items.checkins.promoter'
       ]
     });
   }

  async update(id: string, updateRouteDto: UpdateRouteDto, user?: any) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      console.log(`Updating route ${id}`, JSON.stringify(updateRouteDto));

      // 1. Fetch route with relations using queryRunner
      const route = await queryRunner.manager.findOne(Route, {
        where: { id },
        relations: ['items', 'items.products', 'promoters']
      });

      if (!route) {
          throw new BadRequestException('Route not found');
      }

      // Check if route can be edited
      const userRole = user?.role?.toLowerCase() || '';
      const isAdmin = ['admin', 'manager', 'superadmin', 'administrador do sistema', 'supervisor de operações', 'supervisor'].includes(userRole);

      if (!isAdmin) {
        if (route.status === 'COMPLETED') {
            throw new BadRequestException('Cannot edit a completed route');
        }

        const hasStarted = route.items?.some(item => 
            item.checkInTime || 
            (item.status !== 'PENDING' && item.status !== 'SKIPPED')
        );

        if (hasStarted) {
            throw new BadRequestException('Cannot edit a route that has already started execution');
        }
      }

      const { items, promoterId, ...routeData } = updateRouteDto;
      const effectiveBrandId = (routeData as any).brandId ?? (route as any).brandId;
      let brand: Brand | null = null;
      if (effectiveBrandId) {
        brand = await queryRunner.manager.findOne(Brand, {
          where: { id: effectiveBrandId },
          relations: ['promoters', 'supermarkets', 'availabilityWindows'],
        });
        if (!brand) {
          throw new BadRequestException('Marca não encontrada');
        }

        if ((routeData as any).brandId && !('checklistTemplateId' in updateRouteDto) && brand.checklistTemplateId) {
          (routeData as any).checklistTemplateId = brand.checklistTemplateId;
        }
      }
      
      // Track added promoters for availability check
      let addedPromoters: any[] = [];

      // 2. Update basic fields using save() to ensure relations are handled correctly
      Object.assign(route, routeData);
      
      // Handle promoter update explicitly
      // If promoterIds is provided, use it to update promoters relation
      if (updateRouteDto.promoterIds !== undefined) {
         if (updateRouteDto.promoterIds.length > 0) {
             // Calculate added promoters
             const newIds = updateRouteDto.promoterIds;
             const oldIds = route.promoters ? route.promoters.map(p => p.id) : [];
             const addedIds = newIds.filter(id => !oldIds.includes(id));
             
             if (addedIds.length > 0) {
                 // We need to fetch these employees to use them later, or just use their IDs
                 // Since checkPromoterAvailability uses ID, we can just store IDs, 
                 // but for consistency let's store objects if needed. 
                 // Actually we can just query them or create partial objects.
                 addedPromoters = addedIds.map(id => ({ id }));
             }

             // promoterIds are Employee IDs
             route.promoters = updateRouteDto.promoterIds.map(id => ({ id } as any));
             
             // Sync legacy field
             route.promoter = route.promoters[0];
             route.promoterId = route.promoters[0].id;
         } else {
             route.promoters = [];
             route.promoter = null;
             route.promoterId = null;
         }
      } else if (promoterId !== undefined) {
         // Fallback legacy behavior
         route.promoterId = promoterId;
         route.promoter = (promoterId === null || promoterId === '') ? null : { id: promoterId } as any;
         if (route.promoter) {
             // If we set single promoter, ensure it's in the list
             // Check if this promoter was already in list
             const wasInList = route.promoters?.some(p => p.id === promoterId);
             if (!wasInList) {
                 addedPromoters = [route.promoter];
             }
             route.promoters = [route.promoter];
         } else {
             route.promoters = [];
         }
      }

      if (brand && Array.isArray(brand.promoters) && brand.promoters.length > 0) {
        const allowedPromoters = new Set((brand.promoters || []).map((p: any) => p.id));
        const routePromoterIds = (route.promoters || []).map((p: any) => p.id).filter(Boolean);
        const invalid = routePromoterIds.filter((pid: string) => !allowedPromoters.has(pid));
        if (invalid.length > 0) {
          throw new BadRequestException('Um ou mais promotores selecionados não estão vinculados à marca.');
        }
      }

      if (brand && Array.isArray(brand.supermarkets) && brand.supermarkets.length > 0) {
        const supermarketsToValidate = Array.isArray(items) ? items : (route.items || []);
        const allowedSm = new Set((brand.supermarkets || []).map((s: any) => s.id));
        const invalid = supermarketsToValidate
          .map((i: any) => i.supermarketId)
          .filter((sid: string) => sid && !allowedSm.has(sid));
        if (invalid.length > 0) {
          throw new BadRequestException('Um ou mais PDVs selecionados não estão vinculados à marca.');
        }
      }

      if (brand) {
        const scheduleItems = Array.isArray(items) ? items : (route.items || []);
        const targetDate = (route as any).date;
        if (targetDate) {
          this.validateBrandAvailability(brand, targetDate, scheduleItems as any);
        }
      }

      await queryRunner.manager.save(Route, route);

      // 3. Update items if provided
      if (items) {
          // Validate schedule availability for new items
          // Check for ALL assigned promoters (both existing and new)
          const targetPromoters = route.promoters && route.promoters.length > 0 
              ? route.promoters 
              : (route.promoter ? [route.promoter] : []);
             
          const targetDate = routeData.date || route.date;
             
          if (targetPromoters.length > 0 && targetDate && !isAdmin) {
              for (const promoter of targetPromoters) {
                  for (const item of items) {
                     await this.checkPromoterAvailability(
                         promoter.id,
                         targetDate,
                         item.startTime,
                         item.estimatedDuration,
                         id // exclude current route
                     );
                  }
              }
          }


          // Pre-fetch products and checklists
          const allProductIds = new Set<string>();
          const allChecklistTemplateIds = new Set<string>();
          const allSupermarketIds = new Set<string>();

          items.forEach(item => {
            allSupermarketIds.add(item.supermarketId);
            if (item.productIds) item.productIds.forEach(id => allProductIds.add(id));
            if (item.products) {
                item.products.forEach(p => {
                    allProductIds.add(p.productId);
                    if (p.checklistTemplateId) allChecklistTemplateIds.add(p.checklistTemplateId);
                });
            }
          });

          const productsMap = new Map<string, Product>();
          if (allProductIds.size > 0) {
            const products = await queryRunner.manager.find(Product, {
                where: { id: In(Array.from(allProductIds)) },
                relations: [
                  'checklistTemplate',
                  'checklistTemplate.items',
                  'checklistTemplate.items.competitor',
                  'checklistTemplate.items.competitors',
                  'supermarketGroups',
                  'client',
                  'brand',
                  'brand.client'
                ]
            });
            products.forEach(p => {
              productsMap.set(p.id, p);
              const brand: any = (p as any).brand;
              if (brand?.checklistTemplateId) {
                allChecklistTemplateIds.add(brand.checklistTemplateId);
              }

              const client: any = (p as any).client || brand?.client;
              if (client?.defaultVisitChecklistTemplateId) {
                allChecklistTemplateIds.add(client.defaultVisitChecklistTemplateId);
              }
              if (client?.defaultInventoryChecklistTemplateId) {
                allChecklistTemplateIds.add(client.defaultInventoryChecklistTemplateId);
              }
            });
          }

          const supermarketsMap = new Map<string, any>();
          if (allSupermarketIds.size > 0) {
              const supermarkets = await queryRunner.manager.find(Supermarket, {
                  where: { id: In(Array.from(allSupermarketIds)) },
                  relations: ['group']
              });
              supermarkets.forEach((s: any) => supermarketsMap.set(s.id, s));
          }

          const checklistTemplatesMap = new Map<string, ChecklistTemplate>();
          if (allChecklistTemplateIds.size > 0) {
              const templates = await queryRunner.manager.find(ChecklistTemplate, {
                  where: { id: In(Array.from(allChecklistTemplateIds)) },
                  relations: ['items', 'items.competitor', 'items.competitors']
              });
              templates.forEach(t => checklistTemplatesMap.set(t.id, t));
          }

          // Helper function to add product to item
          const addProductToItem = async (savedItem: RouteItem, prodData: { productId: string; checklistTemplateId?: string; checklistTypes?: string[]; requiresStockPhotos?: boolean }) => {
                const currentSupermarket = supermarketsMap.get(savedItem.supermarketId);
                const product = productsMap.get(prodData.productId);
                const forcedTypes = Array.isArray(prodData.checklistTypes)
                  ? Array.from(new Set(prodData.checklistTypes.map(t => String(t).toUpperCase()).filter(Boolean)))
                  : [];
                   
                // FILTERING LOGIC: Check Assortment (SupermarketGroup)
                if (product && product.supermarketGroups && product.supermarketGroups.length > 0) {
                    if (!currentSupermarket || !currentSupermarket.group) return;
                    const isAllowed = product.supermarketGroups.some(g => g.id === currentSupermarket.group.id);
                    if (!isAllowed) return;
                }

                 const rip = queryRunner.manager.create(RouteItemProduct, {
                     routeItem: savedItem,
                     routeItemId: savedItem.id,
                     product: { id: prodData.productId },
                     productId: prodData.productId,
                     checked: false,
                     checklistTemplateId: prodData.checklistTemplateId,
                     checklistTypes: forcedTypes.length > 0 ? forcedTypes : null,
                     requiresStockPhotos: !!prodData.requiresStockPhotos
                 });
                 const savedRip = await queryRunner.manager.save(RouteItemProduct, rip);

                 if (forcedTypes.length > 0) {
                     await this.routeFactoryService.createChecklistsFromTypes(queryRunner.manager, savedRip, forcedTypes as any);
                     return;
                 }

                 const checklistTemplate = this.routeFactoryService.resolveChecklistTemplate(
                     product,
                     prodData.checklistTemplateId,
                     (route as any).checklistTemplateId,
                     checklistTemplatesMap,
                     (route as any).type || 'VISIT'
                 );

                 if (checklistTemplate) {
                     await this.routeFactoryService.createChecklists(queryRunner.manager, savedRip, checklistTemplate);
                 }
          };

          // RECONCILIATION LOGIC START
          const existingItems = await queryRunner.manager.find(RouteItem, { 
              where: { route: { id } },
              relations: ['products'] 
          });
          
          const existingItemsMap = new Map(existingItems.map(i => [i.id, i]));
          const processedItemIds = new Set<string>();

          for (const item of items) {
              let savedItem: RouteItem;

              if (item.id && existingItemsMap.has(item.id)) {
                  // UPDATE existing item
                  const existingItem = existingItemsMap.get(item.id);
                  processedItemIds.add(item.id);

                  // Update allowed fields
                  existingItem.order = item.order;
                  existingItem.startTime = item.startTime;
                  existingItem.endTime = item.endTime;
                  existingItem.estimatedDuration = item.estimatedDuration;
                  
                  if (existingItem.supermarketId !== item.supermarketId) {
                      existingItem.supermarket = { id: item.supermarketId } as any;
                      existingItem.supermarketId = item.supermarketId;
                  }

                  savedItem = await queryRunner.manager.save(RouteItem, existingItem);

                  // Reconcile Products
                  const currentProductsMap = new Map(existingItem.products.map(p => [p.productId, p]));
                  const newProductIds = new Set<string>();
                  
                  const itemProductsToProcess: { productId: string; checklistTemplateId?: string; checklistTypes?: string[]; requiresStockPhotos?: boolean }[] = [];
                  if (item.products) itemProductsToProcess.push(...item.products);
                  if (item.productIds) {
                     item.productIds.forEach(pid => {
                         if (!itemProductsToProcess.find(p => p.productId === pid)) {
                             itemProductsToProcess.push({ productId: pid });
                         }
                     });
                  }

                  for (const prodData of itemProductsToProcess) {
                      newProductIds.add(prodData.productId);
                      const existingRip = currentProductsMap.get(prodData.productId);
                      if (!existingRip) {
                        await addProductToItem(savedItem, prodData);
                        continue;
                      }

                      const oldTemplateId = existingRip.checklistTemplateId || null;
                      const newTemplateId = prodData.checklistTemplateId || null;
                      const newForcedTypes = Array.isArray(prodData.checklistTypes)
                        ? Array.from(new Set(prodData.checklistTypes.map(t => String(t).toUpperCase()).filter(Boolean)))
                        : [];
                      const oldForcedTypes = Array.isArray((existingRip as any).checklistTypes)
                        ? Array.from(new Set(((existingRip as any).checklistTypes as any[]).map(t => String(t).toUpperCase()).filter(Boolean)))
                        : [];

                      const oldForcedKey = oldForcedTypes.slice().sort().join('|');
                      const newForcedKey = newForcedTypes.slice().sort().join('|');

                      existingRip.checklistTemplateId = prodData.checklistTemplateId as any;
                      (existingRip as any).checklistTypes = newForcedTypes.length > 0 ? newForcedTypes : null;
                      (existingRip as any).requiresStockPhotos = !!prodData.requiresStockPhotos;
                      await queryRunner.manager.save(RouteItemProduct, existingRip);

                      const shouldRebuildChecklists = oldForcedKey !== newForcedKey || oldTemplateId !== newTemplateId;
                      if (shouldRebuildChecklists) {
                        await queryRunner.manager.delete(RouteItemProductChecklist, { routeItemProductId: existingRip.id } as any);

                        if (newForcedTypes.length > 0) {
                          await this.routeFactoryService.createChecklistsFromTypes(queryRunner.manager, existingRip, newForcedTypes as any);
                        } else {
                          const product = productsMap.get(prodData.productId);
                          const checklistTemplate = this.routeFactoryService.resolveChecklistTemplate(
                            product,
                            prodData.checklistTemplateId,
                            (route as any).checklistTemplateId,
                            checklistTemplatesMap,
                            (route as any).type || 'VISIT'
                          );
                          if (checklistTemplate) {
                            await this.routeFactoryService.createChecklists(queryRunner.manager, existingRip, checklistTemplate);
                          }
                        }
                      }
                  }

                  const productsToRemove = existingItem.products.filter(p => !newProductIds.has(p.productId));
                  
                  // STRICT CHECK: Cannot remove products that are already checked/started
                  const completedRemoved = productsToRemove.find(p => p.checked || p.checkInTime);
                  if (completedRemoved) {
                      throw new BadRequestException(`Não é possível remover o produto "${completedRemoved.product?.name || 'Item'}" pois já foi iniciado ou concluído.`);
                  }

                  if (productsToRemove.length > 0) {
                      await queryRunner.manager.remove(productsToRemove);
                  }

              } else {
                  // CREATE new item
                  const routeItem = queryRunner.manager.create(RouteItem, {
                    route: { id: id } as Route,
                    routeId: id,
                    supermarket: { id: item.supermarketId },
                    supermarketId: item.supermarketId,
                    order: item.order,
                      startTime: item.startTime,
                      endTime: item.endTime,
                      estimatedDuration: item.estimatedDuration,
                      status: 'PENDING'
                  });
                  
                  savedItem = await queryRunner.manager.save(RouteItem, routeItem);

                  const itemProductsToProcess: { productId: string; checklistTemplateId?: string; checklistTypes?: string[]; requiresStockPhotos?: boolean }[] = [];
                  if (item.products) itemProductsToProcess.push(...item.products);
                  if (item.productIds) {
                     item.productIds.forEach(pid => {
                         if (!itemProductsToProcess.find(p => p.productId === pid)) {
                             itemProductsToProcess.push({ productId: pid });
                         }
                     });
                  }

                  if (itemProductsToProcess.length > 0) {
                      for (const prodData of itemProductsToProcess) {
                          await addProductToItem(savedItem, prodData);
                      }
                  }
              }
          }

          // Delete items removed from route
          const itemsToDelete = existingItems.filter(i => !processedItemIds.has(i.id));
          
          // STRICT CHECK: Cannot remove items (stops) that have started execution
          const startedItemRemoved = itemsToDelete.find(i => i.checkInTime || i.products?.some(p => p.checked || p.checkInTime));
          if (startedItemRemoved) {
             throw new BadRequestException(`Não é possível remover o ponto de venda "${startedItemRemoved.supermarket?.fantasyName || 'PDV'}" pois já foi iniciado.`);
          }

          if (itemsToDelete.length > 0) {
              await queryRunner.manager.remove(itemsToDelete);
          }
      } else if (addedPromoters.length > 0) {
          const targetDate = routeData.date || route.date;
          if (targetDate && route.items && route.items.length > 0) {
              for (const promoter of addedPromoters) {
                  for (const item of route.items) {
                      if (item.startTime && item.estimatedDuration) {
                         await this.checkPromoterAvailability(
                             promoter.id,
                             targetDate,
                             item.startTime,
                             item.estimatedDuration,
                             id
                         );
                      }
                  }
              }
          }
      }
      
      await queryRunner.commitTransaction();

      // NOTIFY Promoters about the update
      try {
        const updatedRoute = await this.findOne(id);
        const promotersToNotify = updatedRoute.promoters || (updatedRoute.promoter ? [updatedRoute.promoter] : []);
        
        for (const promoter of promotersToNotify) {
            const user = await this.dataSource.getRepository(User).findOne({ where: { employeeId: promoter.id } });
            if (user) { // Ensure promoter has a linked user account
                await this.notificationsService.create({
                    userId: user.id,
                    title: 'Rota Atualizada',
                    message: `Sua rota do dia ${new Date(updatedRoute.date).toLocaleDateString('pt-BR')} foi atualizada. Novos produtos foram adicionados.`,
                    type: 'alert',
                    relatedId: updatedRoute.id
                });
            }
        }
      } catch (notifyError) {
          console.error('Error sending notification after route update:', notifyError);
          // Don't fail the request if notification fails
      }

      return this.findOne(id);
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      console.error('Error updating route (Stack):', error.stack);
      console.error('Error updating route (Message):', error.message);
      console.error('Error updating route (Full):', JSON.stringify(error, null, 2));
      
      // Fix for error instance check
      if (error instanceof HttpException) {
          throw error;
      }
      if (error.status === 400 || error.name === 'BadRequestException') {
          const msg = error.response?.message || error.response || error.message;
          throw new BadRequestException(msg);
      }
      throw new InternalServerErrorException(`Erro ao salvar rota: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string, user?: any, recurrence: boolean = false) {
    const route = await this.findOne(id);
    if (!route) {
      throw new BadRequestException('Route not found');
    }

    const isAdmin = user && ['admin', 'manager', 'superadmin'].includes(user.role);

    // Helper to check if route can be deleted
    const canDelete = (r: Route) => {
      if (isAdmin) return true;
      const hasStarted = r.items?.some(item => 
          item.checkInTime || 
          (item.status !== 'PENDING' && item.status !== 'SKIPPED')
      );
      return !(hasStarted || r.status === 'COMPLETED' || r.status === 'IN_PROGRESS');
    };

    if (!canDelete(route)) {
      throw new BadRequestException('Cannot delete a route that has already started execution or is completed');
    }

    if (recurrence && route.recurrenceGroup) {
      // Delete series from this date onwards
      const futureRoutes = await this.routesRepository.find({
        where: {
          recurrenceGroup: route.recurrenceGroup,
          date: MoreThanOrEqual(route.date)
        },
        relations: ['items']
      });

      // Validate all future routes
      for (const r of futureRoutes) {
        if (!canDelete(r)) {
             throw new BadRequestException(`Cannot delete series because route on ${r.date} has already started or is completed`);
        }
      }

      const ids = futureRoutes.map(r => r.id);
      if (ids.length > 0) {
        return this.routesRepository.delete(ids);
      }
      return { affected: 0 };
    }

    return this.routesRepository.delete(id);
  }

  async removeBatch(query: { startDate: string; endDate?: string; promoterId?: string }, user?: any) {
    const isAdmin = user && ['admin', 'manager', 'superadmin'].includes(user.role);
    if (!isAdmin) {
      throw new UnauthorizedException('Only admins can perform batch deletion');
    }

    const { startDate, endDate, promoterId } = query;
    
    const whereClause: any = {
      date: endDate ? Between(startDate, endDate) : MoreThanOrEqual(startDate),
      status: In(['DRAFT', 'CONFIRMED']) // Only delete non-started routes by default for safety
    };

    if (promoterId) {
      // Handle both legacy and new relation
      // This is tricky with OR logic in TypeORM simple find
      // Let's use QueryBuilder for robustness
      const qb = this.routesRepository.createQueryBuilder('route')
        .leftJoin('route.promoters', 'promoter')
        .where('route.date >= :startDate', { startDate });
      
      if (endDate) {
        qb.andWhere('route.date <= :endDate', { endDate });
      }

      qb.andWhere('route.status IN (:...statuses)', { statuses: ['DRAFT', 'CONFIRMED'] });

      if (promoterId) {
        qb.andWhere(new Brackets(qb2 => {
          qb2.where('route.promoterId = :pid', { pid: promoterId })
             .orWhere('promoter.id = :pid', { pid: promoterId });
        }));
      }

      const routes = await qb.getMany();
      if (routes.length === 0) return { affected: 0 };
      
      return this.routesRepository.delete(routes.map(r => r.id));
    }

    return this.routesRepository.delete(whereClause);
  }

  async getRouteReport(id: string) {
    const route = await this.routesRepository.findOne({
      where: { id },
      relations: [
        'promoter',
        'items',
        'items.supermarket',
        'items.products',
        'items.products.product',
        'items.products.product.brand',
        'items.products.product.client',
        'items.products.product.categoryRef',
      ],
    });

    if (!route) {
      throw new NotFoundException('Route not found');
    }

    return {
      routeId: route.id,
      date: route.date,
      promoterName: route.promoter?.fullName || 'N/A',
      items: route.items.map((item) => ({
        supermarketName: item.supermarket?.fantasyName || 'N/A',
        checkInTime: item.checkInTime,
        checkOutTime: item.checkOutTime,
        categoryPhotos: item.categoryPhotos || {},
        products: item.products.map((p) => {
          const gondola = p.gondolaCount || 0;
          const inventory = p.inventoryCount || 0;
          return {
            productName: p.product.name,
            ean: p.product.barcode,
            category: p.product.categoryRef?.name || p.product.category || 'Sem Categoria',
            brand: p.product.brand?.name || 'N/A',
            gondolaCount: p.gondolaCount,
            inventoryCount: p.inventoryCount,
            totalCount: gondola + inventory,
            ruptureReason: p.ruptureReason,
            isCompleted: (p.gondolaCount !== null && p.inventoryCount !== null) || !!p.ruptureReason,
            photos: p.photos || []
          };
        }),
      })),
    };
  }

  async getEvidenceReport(startDate: string, endDate: string, clientId?: string) {
    const query = this.routeItemProductsRepository.createQueryBuilder('rip')
      .leftJoinAndSelect('rip.routeItem', 'ri')
      .leftJoinAndSelect('ri.route', 'r')
      .leftJoinAndSelect('r.promoter', 'promoter')
      .leftJoinAndSelect('ri.supermarket', 's')
      .leftJoinAndSelect('rip.product', 'p')
      .leftJoinAndSelect('p.brand', 'b')
      .leftJoinAndSelect('rip.checklists', 'cl')
      .where('r.date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .orderBy('r.date', 'DESC');

    if (clientId) {
      query.leftJoin('s.clients', 'c')
           .andWhere('c.id = :clientId', { clientId });
    }

    // Filter items that have photos in 'photos' column OR 'checklists' with type PHOTO and value
    query.andWhere(new Brackets(qb => {
      qb.where("rip.photos IS NOT NULL AND rip.photos != ''")
        .orWhere("cl.type = :type AND cl.value IS NOT NULL AND cl.value != ''", { type: ChecklistItemType.PHOTO });
    }));

    const results = await query.getMany();
    return results;
  }

  // Rules
  async createRule(rule: Partial<RouteRule>) {
    return this.routeRulesRepository.save(this.routeRulesRepository.create(rule));
  }

  async findAllRules() {
    return this.routeRulesRepository.find();
  }

  async updateItem(id: string, data: { categoryPhotos?: any }) {
    const item = await this.routeItemsRepository.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Route Item not found');

    if (data.categoryPhotos !== undefined) {
      // Smart Merge Logic for Category Photos
      // This preserves categories that might have been added by other promoters concurrently
      // but were not present in the current payload.
      // For categories present in the payload, the payload is considered the source of truth.
      const currentPhotos = item.categoryPhotos || {};
      const newPhotos = data.categoryPhotos || {};
      
      if (typeof newPhotos === 'object' && newPhotos !== null) {
          // Start with existing photos
          const merged = { ...currentPhotos };
          
          // Overwrite with new data for specific categories
          for (const [category, photos] of Object.entries(newPhotos)) {
              merged[category] = photos;
          }
          
          item.categoryPhotos = merged;
      } else {
          // Fallback for non-object data (should not happen usually)
          item.categoryPhotos = data.categoryPhotos;
      }
    }

    return this.routeItemsRepository.save(item);
  }

  private async processAndSaveImage(buffer: Buffer, itemId: string, supermarketName: string, promoterName: string): Promise<string> {
    const timestamp = Date.now();
    const date = new Date(timestamp);
    const dateStr = date.toLocaleDateString('pt-BR');
    const timeStr = date.toLocaleTimeString('pt-BR');
    const fileName = `${itemId}_${timestamp}_${Math.random().toString(36).substring(7)}.webp`;
    const filePath = path.join(UPLOAD_ROOT, fileName);
    
    try {
      fs.writeFileSync('debug_last_save_path.txt', `Last save path: ${filePath}\nUPLOAD_ROOT: ${UPLOAD_ROOT}\nTimestamp: ${new Date().toISOString()}`);
    } catch (e) {
      console.error('Failed to write debug file', e);
    }
    
    if (!fs.existsSync(UPLOAD_ROOT)) {
      fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
    }

    // Create SVG Watermark
    /* 
    // DISABLED: PWA already applies watermark. Double watermarking causes issues and overwrites correct data.
    const width = 800; // Target width
    const height = 600; // Target height (approx)
    
    // SVG with semi-transparent background and text
    const svgText = `
    <svg width="${width}" height="${height}">
      <style>
        .text { fill: white; font-family: Arial, sans-serif; font-weight: bold; font-size: 24px; filter: drop-shadow(1px 1px 1px black); }
        .bg { fill: rgba(0, 0, 0, 0.5); }
      </style>
      <!-- Bottom Background Strip -->
      <rect x="0" y="${height - 80}" width="${width}" height="80" class="bg" />
      
      <!-- Text Lines -->
      <text x="20" y="${height - 50}" class="text">${supermarketName}</text>
      <text x="20" y="${height - 20}" class="text" style="font-size: 18px;">${promoterName} | ${dateStr} ${timeStr}</text>
    </svg>
    `;
    const svgBuffer = Buffer.from(svgText);
    */

    try {
        // Process Image with Sharp
        // Just resize/convert, DO NOT apply watermark again
        await sharp(buffer)
            .resize(800, 800, { fit: 'inside', withoutEnlargement: true }) // Resize to max 800x800
            // .composite([{ input: svgBuffer, gravity: 'south' }]) // Apply watermark at bottom
            .webp({ quality: 80 }) // Convert to WebP for optimization
            .toFile(filePath);
            
    } catch (error) {
        console.error('Error processing image with watermark:', error);
        // Fallback: Save original buffer if processing fails
        fs.writeFileSync(filePath, buffer);
    }

    return `/uploads/${fileName}`;
  }

  async uploadPhoto(itemId: string, file: any, type: string, category?: string) {
    console.log(`RoutesService.uploadPhoto: itemId=${itemId}, type=${type}, category=${category}`);
    const item = await this.routeItemsRepository.findOne({ 
        where: { id: itemId },
        relations: ['supermarket', 'route', 'route.promoter', 'route.promoters']
    });
    if (!item) throw new NotFoundException('Route Item not found');

    // Prepare Watermark Data
    const supermarketName = item.supermarket?.fantasyName || 'PDV Desconhecido';
    
    // Determine Promoter Name
    let promoterName = 'Promotor';
    if (item.route?.promoter?.fullName) {
        promoterName = item.route.promoter.fullName;
    } else if (item.route?.promoters && item.route.promoters.length > 0) {
        promoterName = item.route.promoters[0].fullName;
    }

    const url = await this.processAndSaveImage(file.buffer, itemId, supermarketName, promoterName);

    // If category and type are provided, update the route item categoryPhotos
          const normalizedType = type.replace('CATEGORY_', '').toLowerCase();
          if (category && (normalizedType === 'before' || normalizedType === 'after' || normalizedType === 'storage')) {
              console.log(`RoutesService.uploadPhoto: Updating categoryPhotos for category=${category}, type=${normalizedType}`);
              
              // Clone existing photos to ensure TypeORM detects the change
              const newCategoryPhotos = { ...(item.categoryPhotos || {}) };
              
              if (!newCategoryPhotos[category]) {
                  newCategoryPhotos[category] = {};
              }

              // Ensure the category object is also cloned if it exists (though shallow copy above handles top level)
              // But deeper levels need care if we mutate.
              // Let's create a new object for the category to be safe.
              const categoryObj = { ...newCategoryPhotos[category] };
              const current = categoryObj[normalizedType as 'before' | 'after' | 'storage'];

              let updatedList: string[];
              if (Array.isArray(current)) {
                  updatedList = [...current, url];
              } else if (current) {
                   // Convert existing string to array
                   updatedList = [current as string, url];
              } else {
                   // Initialize as array
                   updatedList = [url];
              }
              
              categoryObj[normalizedType as 'before' | 'after' | 'storage'] = updatedList;
              newCategoryPhotos[category] = categoryObj;

              item.categoryPhotos = newCategoryPhotos;
              console.log('RoutesService.uploadPhoto: Saving item with new categoryPhotos:', JSON.stringify(item.categoryPhotos));
              
              // Use update instead of save to force update of specific column if needed, 
              // but save is better for relations.
              // However, with simple-json, save() should work if object reference changed.
              await this.routeItemsRepository.save(item);
          }

          return { url, categoryPhotos: item.categoryPhotos };
        }

  async checkProduct(routeItemId: string, productId: string, data: { checked?: boolean, observation?: string, isStockout?: boolean, stockoutType?: string, photos?: string[], checkInTime?: string, checkOutTime?: string, validityDate?: string, validityQuantity?: number, validityStoreDate?: string, validityStoreQuantity?: number, validityStockDate?: string, validityStockQuantity?: number, stockCount?: number, gondolaCount?: number, inventoryCount?: number, ruptureReason?: string, checklists?: { id: string, isChecked: boolean, value?: string }[] }, userId?: string) {
    console.log(`RoutesService.checkProduct: Item ${routeItemId}, Product ${productId}`);
    console.log('Payload:', JSON.stringify(data));

    const itemProduct = await this.routeItemProductsRepository.findOne({
      where: { routeItemId, productId },
      relations: ['product', 'product.brand', 'routeItem', 'routeItem.supermarket', 'routeItem.route', 'checklists', 'completedBy']
    });

    if (itemProduct?.routeItem?.route) {
        this.validateSyncDeadline(itemProduct.routeItem.route.date);
    }

    let employee = null;
    if (userId) {
        const user = await this.dataSource.getRepository(User).findOne({ 
            where: { id: userId },
            relations: ['employee']
        });
        employee = user?.employee || null;
    }

    if (itemProduct) {
      if (employee) {
          itemProduct.completedBy = employee;
      }
      if (data.checked !== undefined) itemProduct.checked = data.checked;
      if (data.observation !== undefined) itemProduct.observation = data.observation;
      if (data.isStockout !== undefined) itemProduct.isStockout = data.isStockout;
      if (data.stockoutType !== undefined) itemProduct.stockoutType = data.stockoutType;
      if (data.photos !== undefined) {
      // Process photos to ensure they are saved as files (handling Base64 from offline sync)
      const processedPhotos: string[] = [];
      
      for (const photo of data.photos) {
        if (photo.startsWith('data:image')) {
           try {
             // Extract Base64 data
             const matches = photo.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
             if (matches && matches.length === 3) {
                const buffer = Buffer.from(matches[2], 'base64');
                
                // Get context for watermark
                const supermarketName = itemProduct.routeItem?.supermarket?.fantasyName || 'PDV Desconhecido';
                let promoterName = 'Promotor';
                if (itemProduct.completedBy?.fullName) {
                    promoterName = itemProduct.completedBy.fullName;
                } else if (employee?.fullName) {
                    promoterName = employee.fullName;
                }

                const url = await this.processAndSaveImage(buffer, routeItemId, supermarketName, promoterName);
                processedPhotos.push(url);
             } else {
                // Invalid Base64 format
                console.error('Invalid Base64 format in checkProduct');
                throw new BadRequestException('Formato de imagem inválido (Base64 corrompido).');
             }
           } catch (err) {
             console.error('Error processing Base64 photo in checkProduct:', err);
             // Do NOT fallback to Base64 string as it causes database/display issues
             // Throw error so the sync action fails and retries (or stays pending)
             throw new InternalServerErrorException('Falha ao processar e salvar a foto: ' + err.message);
           }
        } else {
           processedPhotos.push(photo);
        }
      }
      itemProduct.photos = processedPhotos;
    }
      if (data.checkInTime !== undefined) itemProduct.checkInTime = new Date(data.checkInTime);
      if (data.checkOutTime !== undefined) itemProduct.checkOutTime = new Date(data.checkOutTime);
      if (data.validityDate !== undefined) itemProduct.validityDate = data.validityDate;
      if (data.validityQuantity !== undefined) itemProduct.validityQuantity = data.validityQuantity;
      if (data.validityStoreDate !== undefined) itemProduct.validityStoreDate = data.validityStoreDate;
      if (data.validityStoreQuantity !== undefined) itemProduct.validityStoreQuantity = data.validityStoreQuantity;
      if (data.validityStockDate !== undefined) itemProduct.validityStockDate = data.validityStockDate;
      if (data.validityStockQuantity !== undefined) itemProduct.validityStockQuantity = data.validityStockQuantity;
      if (data.ruptureReason !== undefined) itemProduct.ruptureReason = data.ruptureReason;

      if (
        data.validityStoreDate !== undefined ||
        data.validityStoreQuantity !== undefined ||
        data.validityStockDate !== undefined ||
        data.validityStockQuantity !== undefined
      ) {
        const storeDate = itemProduct.validityStoreDate ? String(itemProduct.validityStoreDate) : '';
        const storeQty = itemProduct.validityStoreQuantity !== null && itemProduct.validityStoreQuantity !== undefined ? Number(itemProduct.validityStoreQuantity) : 0;
        const stockDate = itemProduct.validityStockDate ? String(itemProduct.validityStockDate) : '';
        const stockQty = itemProduct.validityStockQuantity !== null && itemProduct.validityStockQuantity !== undefined ? Number(itemProduct.validityStockQuantity) : 0;

        const hasStore = !!(storeDate && storeQty > 0);
        const hasStock = !!(stockDate && stockQty > 0);

        const overall = (() => {
          if (hasStore && hasStock) {
            return storeDate <= stockDate ? { date: storeDate, qty: storeQty } : { date: stockDate, qty: stockQty };
          }
          if (hasStore) return { date: storeDate, qty: storeQty };
          if (hasStock) return { date: stockDate, qty: stockQty };
          return null;
        })();

        if (overall) {
          itemProduct.validityDate = overall.date;
          itemProduct.validityQuantity = overall.qty;
        }
      }
      
      // Handle Counts
      if (data.gondolaCount !== undefined) itemProduct.gondolaCount = data.gondolaCount;
      if (data.inventoryCount !== undefined) itemProduct.inventoryCount = data.inventoryCount;
      if (data.stockCount !== undefined) itemProduct.stockCount = data.stockCount;
      if (data.ruptureReason !== undefined) itemProduct.ruptureReason = data.ruptureReason;
      
      // Log for debugging stock count issues
      if (data.gondolaCount !== undefined || data.inventoryCount !== undefined || data.stockCount !== undefined) {
          console.log(`[STOCK DEBUG] Updating product ${productId} in item ${routeItemId}. Data:`, {
              gondola: data.gondolaCount,
              inventory: data.inventoryCount,
              stock: data.stockCount,
              rupture: data.ruptureReason,
              isStockout: data.isStockout
          });
      }
      
      // Calculate total stock count if both are provided or update individually
      // If stockCount is provided directly (legacy), use it. 
      // Otherwise, sum gondola + inventory if available.
      if (data.stockCount !== undefined) {
        itemProduct.stockCount = data.stockCount;
      } else {
        // Auto-sum if we have the components
        const g = itemProduct.gondolaCount || 0;
        const i = itemProduct.inventoryCount || 0;
        // Only update stockCount if we actually received update for one of the components
        if (data.gondolaCount !== undefined || data.inventoryCount !== undefined) {
             itemProduct.stockCount = g + i;
        }
      }

      // Check for brand notification logic
      if (itemProduct.product?.brand?.waitForStockCount) {
          // Check if product has STOCK_COUNT checklist
          const hasStockCountChecklist = itemProduct.checklists?.some(c => c.type === ChecklistItemType.STOCK_COUNT) || 
                                         itemProduct.checklists?.some(c => c.description?.toLowerCase().includes('estoque') || c.description?.toLowerCase().includes('contagem'));

          // Only trigger approval if it has the specific checklist
          if (hasStockCountChecklist) {
            // If status is not already approved, set to pending review
            if (itemProduct.stockCountStatus !== 'APPROVED') {
               itemProduct.stockCountStatus = 'PENDING_REVIEW';
               if (!itemProduct.approvalToken) {
                 itemProduct.approvalToken = uuidv4();
               }
               
               const contact = itemProduct.product.brand.stockNotificationContact;
               if (contact) {
                  const supermarketName = itemProduct.routeItem?.supermarket?.fantasyName || 'PDV Desconhecido';
                  const productName = itemProduct.product.name;
                  const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
                  // Generate a simplified link directly to the validation page
                   const approvalLink = `${frontendUrl}/stock-validation?token=${itemProduct.approvalToken}`;

                const message = `*Validação de Estoque Necessária*\n\n` +
                  `📦 *Produto:* ${productName}\n` +
                  `🏢 *PDV:* ${supermarketName}\n` +
                  `🔢 *Estoque Informado:* ${data.stockCount}\n\n` +
                  `⚠️ O promotor está aguardando liberação.\n` +
                  `🔗 *Clique para validar:* ${approvalLink}`;

                console.log(`[NOTIFICATION SYSTEM] Sending WhatsApp to ${contact}`);
                // Fire and forget notification to not block the response time significantly
                this.whatsappService.sendText(contact, message).catch(err => 
                  console.error('Failed to send WhatsApp notification', err)
                );
             } else {
                 console.warn(`[NOTIFICATION SYSTEM] Brand ${itemProduct.product.brand.name} has wait enabled but no contact configured.`);
             }
          }
        }
      }

      if (data.checklists && data.checklists.length > 0 && itemProduct.checklists) {
        // Update checklists in memory to leverage cascade save and avoid race conditions
        data.checklists.forEach(incoming => {
            const existing = itemProduct.checklists.find(c => c.id === incoming.id);
            if (existing) {
                existing.isChecked = incoming.isChecked;
                existing.value = incoming.value;
                if (employee) existing.completedBy = employee;
            }
        });

        // Propagate validity date from checklist to product
        const validityChecklist = itemProduct.checklists.find(c => c.type === ChecklistItemType.VALIDITY_CHECK && c.isChecked && c.value);
        if (validityChecklist) {
            itemProduct.validityDate = validityChecklist.value;
        }
      } else if (data.checked && itemProduct.checklists?.length > 0) {
        // Auto-complete checklists if product is checked but no specific checklist data provided
        // This handles cases where frontend only sends checked=true (e.g. from summary view)
        itemProduct.checklists.forEach(c => {
            // For VALIDITY_CHECK, only auto-check if data is present
            if (c.type === ChecklistItemType.VALIDITY_CHECK) {
                 const hasValidityLegacy = !!(itemProduct.validityDate && (itemProduct.validityQuantity !== null && itemProduct.validityQuantity !== undefined));
                 const hasValidityStore = !!(itemProduct.validityStoreDate && itemProduct.validityStoreQuantity !== null && itemProduct.validityStoreQuantity !== undefined);
                 const hasValidityStock = !!(itemProduct.validityStockDate && itemProduct.validityStockQuantity !== null && itemProduct.validityStockQuantity !== undefined);
                 if (hasValidityLegacy || hasValidityStore || hasValidityStock) {
                     c.isChecked = true;
                     if (employee) c.completedBy = employee;
                 }
            } 
            // For STOCK_COUNT, only auto-check if stock count is present
            else if (c.type === ChecklistItemType.STOCK_COUNT) {
                 if (itemProduct.stockCount !== null && itemProduct.stockCount !== undefined) {
                     c.isChecked = true;
                     if (employee) c.completedBy = employee;
                 }
            }
            // For standard checklists, mark as done
            else {
                 c.isChecked = true;
                 if (employee) c.completedBy = employee;
            }
        });
      }

      const saved = await this.routeItemProductsRepository.save(itemProduct);

      return saved;
    }
    
    // If it doesn't exist, maybe we should create it? 
    // For now, let's assume it must exist (linked during route creation)
    // Or we could dynamically link it if the promoter decides to check a product not originally planned.
    // Let's stick to updating existing ones for now as per "vincular os produtos que serao conferidos".
    throw new Error('Product not linked to this route item');
  }

  async manualExecution(itemId: string, data: { 
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
      checklists?: Array<{
        description: string;
        type: string;
        value?: string;
        isChecked: boolean;
        competitorName?: string;
      }>;
    }[] 
  }, user?: any) {
    const item = await this.routeItemsRepository.findOne({ 
      where: { id: itemId },
      relations: ['route']
    });

    if (!item) throw new BadRequestException('Route Item not found');

    // Update Item Times and Status
    item.checkInTime = new Date(data.checkInTime);
    item.checkOutTime = new Date(data.checkOutTime);
    item.status = 'COMPLETED';
    item.manualEntryBy = user?.email || 'admin';
    item.manualEntryAt = new Date();
    if (data.observation) item.observation = data.observation;

    await this.routeItemsRepository.save(item);

    // Update Route Promoter if provided
    if (data.promoterId && item.route && item.route.promoterId !== data.promoterId) {
       await this.routesRepository.update(item.route.id, { promoter: { id: data.promoterId }, promoterId: data.promoterId });
    }

    // Update Products
    if (data.products && data.products.length > 0) {
      for (const p of data.products) {
        let productRel = await this.routeItemProductsRepository.findOne({
          where: { routeItemId: itemId, productId: p.productId },
          relations: ['checklists']
        });

        if (!productRel) {
          productRel = this.routeItemProductsRepository.create({
            routeItemId: itemId,
            productId: p.productId,
            routeItem: item,
            product: { id: p.productId }
          });
        }

        productRel.checked = p.checked;
        productRel.isStockout = p.isStockout;
        productRel.observation = p.observation;
        productRel.photos = p.photos;
        if ((p as any).validityDate) productRel.validityDate = (p as any).validityDate;
        if ((p as any).validityQuantity !== undefined) productRel.validityQuantity = (p as any).validityQuantity;
        if ((p as any).validityStoreDate) productRel.validityStoreDate = (p as any).validityStoreDate;
        if ((p as any).validityStoreQuantity !== undefined) productRel.validityStoreQuantity = (p as any).validityStoreQuantity;
        if ((p as any).validityStockDate) productRel.validityStockDate = (p as any).validityStockDate;
        if ((p as any).validityStockQuantity !== undefined) productRel.validityStockQuantity = (p as any).validityStockQuantity;
        if ((p as any).stockCount) productRel.stockCount = (p as any).stockCount;
        
        // Checklist Handling
        if (p.checklists && p.checklists.length > 0) {
            if (!productRel.checklists) productRel.checklists = [];
            
            for (const checkData of p.checklists) {
                const existing = productRel.checklists.find(c => 
                    c.description === checkData.description && 
                    c.competitorName === checkData.competitorName
                );

                if (existing) {
                    existing.isChecked = checkData.isChecked;
                    existing.value = checkData.value;
                    await this.dataSource.getRepository(RouteItemProductChecklist).save(existing);
                } else {
                    const newChecklist = this.dataSource.getRepository(RouteItemProductChecklist).create({
                        routeItemProduct: productRel,
                        description: checkData.description,
                        type: checkData.type as any,
                        value: checkData.value,
                        isChecked: checkData.isChecked,
                        competitorName: checkData.competitorName
                    });
                    await this.dataSource.getRepository(RouteItemProductChecklist).save(newChecklist);
                }
            }
        }

        await this.routeItemProductsRepository.save(productRel);
      }
    }

    // Validate Photos for Manual Entry Completion
    const updatedItem = await this.routeItemsRepository.findOne({
      where: { id: itemId },
      relations: ['products']
    });

    if (updatedItem) {
        const missingPhotos = updatedItem.products.some(p => !p.photos || p.photos.length === 0);
        if (missingPhotos) {
            // Revert status to PENDING if photos are missing, or throw error?
            // User said: "se finalizar sem fotos ele fica pendente"
            // Since we already saved status=COMPLETED above (line 413), we should probably revert it or throw error.
            // But Manual Entry is an admin action, maybe we should just warn?
            // The user instruction seems general. Let's enforce it.
            // Reverting status to PENDING if validation fails
            updatedItem.status = 'PENDING';
            await this.routeItemsRepository.save(updatedItem);
            throw new BadRequestException('A visita ficou como PENDENTE pois todos os produtos precisam ter fotos.');
        }
    }

    return this.findOne(item.routeId);
  }

  async updateRouteItemStatus(id: string, status: string, time?: Date) {
    const updateData: any = { status };
    if (status === 'CHECKIN' || status === 'IN_PROGRESS') {
      updateData.checkInTime = time || new Date();
    } else if (status === 'CHECKOUT' || status === 'COMPLETED') {
      updateData.checkOutTime = time || new Date();
    }
    return this.routeItemsRepository.update(id, updateData);
  }

  private validateSyncDeadline(routeDate: string | Date) {
    if (!routeDate) return;

    const now = new Date();
    const dateVal: any = routeDate;
    const dateStr = dateVal instanceof Date ? dateVal.toISOString().split('T')[0] : String(dateVal).split('T')[0];
    
    // Deadline is the next day at 20:00
    const cutoff20h = new Date(`${dateStr}T20:00:00`);
    const deadline24h = new Date(cutoff20h);
    deadline24h.setHours(deadline24h.getHours() + 24);

    if (now > deadline24h) {
         // "apartir de agora tem que ser feito lançamento manual"
         throw new BadRequestException('Prazo de sincronismo expirado (> 24h após 20:00). Realize o lançamento manual no painel web.');
    }
  }

  private ensureRouteIsToday(routeDate: string | Date) {
    if (!routeDate) return;
    // Usar fuso horário do Brasil (UTC-3) para determinar o "hoje"
    const nowUtc = new Date();
    const brazilOffsetMs = 3 * 60 * 60 * 1000; // UTC-3
    const brazilNow = new Date(nowUtc.getTime() - brazilOffsetMs);
    const todayStr = `${brazilNow.getUTCFullYear()}-${String(brazilNow.getUTCMonth() + 1).padStart(2, '0')}-${String(brazilNow.getUTCDate()).padStart(2, '0')}`;
    const dateVal: any = routeDate;
    let routeStr: string;
    if (dateVal instanceof Date) {
      // Converter a data da rota para o mesmo fuso (UTC-3) antes de comparar
      const brazilRoute = new Date(dateVal.getTime() - brazilOffsetMs);
      routeStr = `${brazilRoute.getUTCFullYear()}-${String(brazilRoute.getUTCMonth() + 1).padStart(2, '0')}-${String(brazilRoute.getUTCDate()).padStart(2, '0')}`;
    } else {
      // Se vier como string (YYYY-MM-DD), comparar diretamente
      routeStr = String(dateVal).split('T')[0];
    }
    if (routeStr !== todayStr) {
      throw new BadRequestException('Check-in só é permitido na data da rota.');
    }
  }

  async checkIn(itemId: string, data: { lat: number; lng: number; timestamp: string; entryPhoto?: string }, userId?: string) {
    const item = await this.routeItemsRepository.findOne({ 
      where: { id: itemId },
      relations: ['route', 'checkins', 'checkins.promoter']
    });
    if (!item) throw new NotFoundException('Item not found');
    
    if (item.route) {
        this.ensureRouteIsToday(item.route.date);
        this.validateSyncDeadline(item.route.date);
    }
    
    // Always update status to CHECKIN if it was PENDING
    if (item.status === 'PENDING') {
        item.status = 'CHECKIN';
        item.checkInTime = new Date(data.timestamp);
    }

    // Register individual promoter checkin
    if (userId) {
        const promoter = await this.dataSource.getRepository(Employee).findOne({ where: { id: userId } });
        if (promoter) {
            // Check if already checked in (open checkin)
            const existingCheckin = item.checkins?.find(c => c.promoterId === userId && !c.checkOutTime);
            if (!existingCheckin) {
                const newCheckin = this.dataSource.getRepository(RouteItemCheckin).create({
                    routeItem: { id: itemId },
                    routeItemId: itemId,
                    promoter: { id: userId },
                    promoterId: userId,
                    checkInTime: new Date(data.timestamp),
                    entryPhoto: data.entryPhoto
                });
                await this.dataSource.getRepository(RouteItemCheckin).save(newCheckin);
            }
        }
    }
    
    // Always update status to CHECKIN if it was PENDING
    // Note: We do this after creating checkin record to ensure consistency
    await this.routeItemsRepository.save(item);

    // Return the FRESH item with all relations (including the new checkin)
    // This is crucial for the frontend to see the new checkin in the 'checkins' array
    return this.routeItemsRepository.findOne({ 
      where: { id: itemId },
      relations: ['route', 'checkins', 'checkins.promoter', 'products']
    });
  }

  async getInventoryDueDates(params: { brandId?: string; supermarketId?: string; dates: string[] }) {
    const { brandId, supermarketId, dates } = params;
    if (!brandId || !supermarketId) return { dueDates: [] };
    if (!Array.isArray(dates) || dates.length === 0) return { dueDates: [] };

    const brand = await this.dataSource.getRepository(Brand).findOne({ where: { id: brandId } });
    if (!brand) throw new BadRequestException('Marca não encontrada');

    const frequencyDays =
      Number((brand as any).inventoryFrequencyDays) ||
      (brand.inventoryFrequency === 'weekly'
        ? 7
        : brand.inventoryFrequency === 'biweekly'
          ? 15
          : brand.inventoryFrequency === 'monthly'
            ? 30
            : 0);

    if (!frequencyDays || frequencyDays <= 0) {
      return { dueDates: [] };
    }

    const last = await this.routeItemProductsRepository
      .createQueryBuilder('rip')
      .innerJoin('rip.product', 'p')
      .innerJoin('rip.routeItem', 'ri')
      .where('p.brandId = :brandId', { brandId })
      .andWhere('ri.supermarketId = :supermarketId', { supermarketId })
      .andWhere('rip.inventoryCount IS NOT NULL')
      .andWhere('rip.checkOutTime IS NOT NULL')
      .orderBy('rip.checkOutTime', 'DESC')
      .select(['rip.id', 'rip.checkOutTime'])
      .getOne();

    const toBrtDateString = (d: Date) => {
      const brazilOffsetMs = 3 * 60 * 60 * 1000;
      const brt = new Date(d.getTime() - brazilOffsetMs);
      return `${brt.getUTCFullYear()}-${String(brt.getUTCMonth() + 1).padStart(2, '0')}-${String(brt.getUTCDate()).padStart(2, '0')}`;
    };

    const parseBrtDate = (dateStr: string) => new Date(`${dateStr}T03:00:00.000Z`);
    const addDays = (dateStr: string, days: number) => {
      const dt = parseBrtDate(dateStr);
      dt.setUTCDate(dt.getUTCDate() + days);
      return dt.toISOString().slice(0, 10);
    };

    const startOfWeekMonday = (dateStr: string) => {
      const dt = parseBrtDate(dateStr);
      const dow = dt.getUTCDay();
      const diff = (dow + 6) % 7;
      dt.setUTCDate(dt.getUTCDate() - diff);
      return dt.toISOString().slice(0, 10);
    };

    const endOfWeekSunday = (weekStart: string) => {
      const dt = parseBrtDate(weekStart);
      dt.setUTCDate(dt.getUTCDate() + 6);
      return dt.toISOString().slice(0, 10);
    };

    const lastDateStr = last?.checkOutTime ? toBrtDateString(new Date(last.checkOutTime as any)) : null;
    const dueAt = lastDateStr ? addDays(lastDateStr, frequencyDays) : null;

    if (!dueAt) {
      const first = dates.slice().sort().find(Boolean);
      return { dueDates: first ? [first] : [] };
    }

    const weekStart = startOfWeekMonday(dueAt);
    const weekEnd = endOfWeekSunday(weekStart);
    const firstInWeek = dates
      .slice()
      .sort()
      .find(d => d >= weekStart && d <= weekEnd);

    return {
      lastInventoryDate: lastDateStr,
      dueAt,
      dueWeekStart: weekStart,
      dueWeekEnd: weekEnd,
      dueDates: firstInWeek ? [firstInWeek] : [],
    };
  }

  private async checkRecentInventory(scopeType: 'client' | 'brand', scopeId: string, supermarketId: string, frequency: string): Promise<boolean> {
    if (!scopeId || !supermarketId || !frequency || frequency === 'daily') return false;
    
    const now = new Date();
    const startDate = new Date();
    
    if (frequency === 'weekly') {
      startDate.setDate(now.getDate() - 7);
    } else if (frequency === 'biweekly') {
      startDate.setDate(now.getDate() - 15);
    } else if (frequency === 'monthly') {
      startDate.setMonth(now.getMonth() - 1);
    } else {
      return false; // unknown -> assume required (no recent found)
    }
    
    // Check if any inventory count exists for this scope at this supermarket since startDate
    const qb = this.routeItemProductsRepository.createQueryBuilder('rip')
      .innerJoin('rip.product', 'product')
      .innerJoin('rip.routeItem', 'ri')
      .innerJoin('ri.supermarket', 'sm')
      .where('sm.id = :supermarketId', { supermarketId })
      .andWhere('ri.checkOutTime >= :startDate', { startDate })
      .andWhere('rip.inventoryCount IS NOT NULL');

    if (scopeType === 'client') {
        qb.innerJoin('product.client', 'client')
          .andWhere('client.id = :scopeId', { scopeId });
    } else {
         qb.innerJoin('product.brand', 'brand')
           .andWhere('brand.id = :scopeId', { scopeId });
    }

    const count = await qb.getCount();
      
    return count > 0;
  }

  async checkOut(itemId: string, data: { lat: number; lng: number; timestamp: string; exitPhoto?: string }, userId?: string) {
    const item = await this.routeItemsRepository.findOne({ 
      where: { id: itemId },
      relations: [
        'route',
        'supermarket',
        'products',
        'products.product',
        'products.product.client',
        'products.product.brand',
        'products.checklists',
        'checkins'
      ]
    });
    if (!item) throw new NotFoundException('Item not found');

    if (item.route) {
        this.validateSyncDeadline(item.route.date);
    }

    // Geolocation Validation
    if (item.supermarket && item.supermarket.latitude && item.supermarket.longitude) {
      const clientRanges = item.products?.map(p => (p.product?.client as any)?.locationRange).filter((r: any) => r !== undefined && r !== null) || [];
      const maxRange = clientRanges.length > 0 ? Math.max(...clientRanges) : 500; // Default 500m

      const dist = this.calculateDistance(data.lat, data.lng, Number(item.supermarket.latitude), Number(item.supermarket.longitude));
      
      if (dist > maxRange) {
         throw new BadRequestException(`Você está a ${Math.round(dist)}m do local. O raio permitido é de ${maxRange}m. Aproxime-se do PDV para finalizar.`);
      }
    }

    // Close individual promoter checkin
    if (userId) {
        const openCheckin = await this.dataSource.getRepository(RouteItemCheckin).findOne({
            where: { routeItemId: itemId, promoterId: userId, checkOutTime: IsNull() }
        });
        
        if (openCheckin) {
            openCheckin.checkOutTime = new Date(data.timestamp);
            if (data.exitPhoto) openCheckin.exitPhoto = data.exitPhoto;
            await this.dataSource.getRepository(RouteItemCheckin).save(openCheckin);
        } else {
            // Fallback: If no open checkin found (maybe legacy flow or error), create one closed immediately?
            // Or just ignore.
            // Let's create a closed one to record the exit at least.
             const newCheckin = this.dataSource.getRepository(RouteItemCheckin).create({
                routeItem: { id: itemId },
                promoter: { id: userId },
                checkInTime: new Date(data.timestamp), // Approximated
                checkOutTime: new Date(data.timestamp),
                exitPhoto: data.exitPhoto
            });
            await this.dataSource.getRepository(RouteItemCheckin).save(newCheckin);
        }
    }
    
    // Validações de conclusão (categoria e produto)
    // 1) Fotos por Marca+Categoria: cada grupo presente nos produtos do item deve possuir fotos 'before' (mín 1) e 'after' (mín 1)
    const categoryPhotos: Record<string, any> = (item as any).categoryPhotos || {};
    const hasAnyBrandCategoryKey = Object.keys(categoryPhotos).some(k => k.includes('::'));

    const groups = new Map<string, { brandLabel: string; categoryLabel: string }>();
    const categoryToBrands = new Map<string, Set<string>>();
    const groupRequiresStockPhotos = new Map<string, boolean>();

    for (const ip of item.products || []) {
      const categoryLabel = (ip.product?.categoryRef?.name) || (ip.product as any)?.category || 'Sem Categoria';
      const brandKey = ip.product?.brand?.id || ip.product?.brand?.name || 'SEM_MARCA';
      const brandLabel = ip.product?.brand?.name || 'Sem Marca';

      if (!categoryToBrands.has(categoryLabel)) categoryToBrands.set(categoryLabel, new Set());
      categoryToBrands.get(categoryLabel)!.add(String(brandKey));

      const groupKey = `${brandKey}::${categoryLabel}`;
      groups.set(groupKey, { brandLabel, categoryLabel });
      groupRequiresStockPhotos.set(groupKey, (groupRequiresStockPhotos.get(groupKey) || false) || !!(ip as any)?.requiresStockPhotos);
    }

    let categoryPhotoMissing = false;
    let missingGroupLabel = '';
    const minBeforePhotos = 1;

    for (const [groupKey, meta] of groups.entries()) {
      const fallbackOk = (() => {
        const brandsForCategory = categoryToBrands.get(meta.categoryLabel);
        return brandsForCategory ? brandsForCategory.size === 1 : true;
      })();

      const photos = (categoryPhotos[groupKey] ?? ((!hasAnyBrandCategoryKey && fallbackOk) ? categoryPhotos[meta.categoryLabel] : undefined)) || {};

      const beforeCount = Array.isArray(photos.before) ? photos.before.length : (photos.before ? 1 : 0);
      const afterCount = Array.isArray(photos.after) ? photos.after.length : (photos.after ? 1 : 0);

      if (beforeCount < minBeforePhotos || afterCount < 1) {
        categoryPhotoMissing = true;
        missingGroupLabel = `${meta.brandLabel} • ${meta.categoryLabel}`;
        break;
      }

      const stockPhotosRequired = groupRequiresStockPhotos.get(groupKey) || false;
      if (stockPhotosRequired) {
        const storageCount = Array.isArray((photos as any).storage) ? (photos as any).storage.length : ((photos as any).storage ? 1 : 0);
        if (storageCount < 2) {
          categoryPhotoMissing = true;
          missingGroupLabel = `${meta.brandLabel} • ${meta.categoryLabel} (Estoque Antes / Depois)`;
          break;
        }
      }

      const extraKey = `${groupKey}::EXTRA`;
      const extra = categoryPhotos[extraKey] || {};
      const extraProducts = Array.isArray(extra.extraProducts) ? extra.extraProducts : [];
      const extraAfterCount = Array.isArray(extra.after) ? extra.after.length : (extra.after ? 1 : 0);

      if (extraProducts.length > 0 && extraAfterCount < 1) {
        categoryPhotoMissing = true;
        missingGroupLabel = `${meta.brandLabel} • ${meta.categoryLabel} (Ponto Extra)`;
        break;
      }
    }

    if (categoryPhotoMissing) {
      if (item.status === 'CHECKIN') item.status = 'PENDING';
      await this.routeItemsRepository.save(item);
      throw new BadRequestException(`Faltam fotos obrigatórias (Antes / Depois) em "${missingGroupLabel}". Verifique todas as marcas e categorias.`);
    }

    // Pre-calculate inventory requirements
    const inventoryRequirements = new Map<string, boolean>();
    const uniqueBrandIds = new Set<string>();
    const uniqueClientIds = new Set<string>();

    item.products?.forEach(p => {
        if (p.product?.brand?.id) uniqueBrandIds.add(p.product.brand.id);
        if (p.product?.client?.id) uniqueClientIds.add(p.product.client.id);
    });

    // Check Brands
    for (const bid of uniqueBrandIds) {
         const prod = item.products.find(p => p.product.brand?.id === bid);
         const brand = prod?.product.brand as any;
         if (brand?.inventoryFrequency && brand.inventoryFrequency !== 'daily') {
              const hasRecent = await this.checkRecentInventory('brand', bid, item.supermarket.id, brand.inventoryFrequency);
              inventoryRequirements.set(`brand:${bid}`, !hasRecent);
         } else {
              inventoryRequirements.set(`brand:${bid}`, true);
         }
    }

    // Check Clients
    for (const cid of uniqueClientIds) {
         const prod = item.products.find(p => p.product.client?.id === cid);
         const client = prod?.product.client as any;
         if (client?.inventoryFrequency && client.inventoryFrequency !== 'daily') {
              const hasRecent = await this.checkRecentInventory('client', cid, item.supermarket.id, client.inventoryFrequency);
              inventoryRequirements.set(`client:${cid}`, !hasRecent);
         } else {
              inventoryRequirements.set(`client:${cid}`, true);
         }
    }

    // 2) Regras por produto: contagens, validade, checklist e ruptura
    const hasProductValidationIssue = (item.products || []).some(ip => {
      const isRupture = !!ip.isStockout;
      const client = (ip.product as any)?.client as any;
      const brand = (ip.product as any)?.brand as any;
      const routeType = item.route?.type || 'VISIT';
      const checklists = ip.checklists || [];

      // Ruptura exige motivo
      if (isRupture) {
        if (!ip.ruptureReason || ip.ruptureReason.trim().length === 0) return true;
        return false;
      }

      const stockCountItemsCount = checklists.filter(c => c.type === 'STOCK_COUNT').length;
      const requiresGondola = stockCountItemsCount >= 1;
      const requiresInventory = stockCountItemsCount >= 2;

      const hasGondola = ip.gondolaCount !== null && ip.gondolaCount !== undefined;
      
      let isRequiredByFrequency = true;
      if (brand && brand.inventoryFrequency) {
           isRequiredByFrequency = inventoryRequirements.get(`brand:${brand.id}`) ?? true;
      } else if (client && client.inventoryFrequency) {
           isRequiredByFrequency = inventoryRequirements.get(`client:${client.id}`) ?? true;
      }

      const inventoryRequiredByPolicy = routeType === 'INVENTORY' || (!!client?.requiresInventoryCount && isRequiredByFrequency);
      if (requiresGondola && !hasGondola) return true;
      if (requiresInventory || (requiresGondola && inventoryRequiredByPolicy)) {
        const hasInventory = ip.inventoryCount !== null && ip.inventoryCount !== undefined;
        if (!hasInventory) return true;
      }

      // Checklist: não bloquear a finalização para checklists "simples".
      // Só validar regras realmente obrigatórias (Estoque/Validade).

      // Fotos: Pelo menos uma foto por produto é obrigatória (exceto se for ruptura, talvez? Mas geralmente precisa provar a ruptura também).
      // Assumindo rigoroso: sem foto = pendência.
      // REMOVIDO: A validação de fotos agora é feita por categoria (categoryPhotos).
      // if (!ip.photos || ip.photos.length === 0) return true;

      // Validade: se existir checklist de validade no produto, exigir preenchimento
      const hasValidityChecklist = checklists.some(c => c.type === ChecklistItemType.VALIDITY_CHECK);
      if (hasValidityChecklist) {
        const hasLegacy = !!(ip.validityDate && ip.validityQuantity !== null && ip.validityQuantity !== undefined && ip.validityQuantity > 0);
        const hasStore = !!(ip.validityStoreDate && ip.validityStoreQuantity !== null && ip.validityStoreQuantity !== undefined && ip.validityStoreQuantity > 0);
        const hasStock = !!(ip.validityStockDate && ip.validityStockQuantity !== null && ip.validityStockQuantity !== undefined && ip.validityStockQuantity > 0);
        if (!hasLegacy && !hasStore && !hasStock) return true;
      }

      return false;
    });
    if (hasProductValidationIssue) {
      if (item.status === 'CHECKIN') item.status = 'PENDING';
      await this.routeItemsRepository.save(item);
      throw new BadRequestException('Existem pendências nos produtos (Estoque, Validade, Checklist ou Fotos). Verifique os itens marcados.');
    }

    // Fotos e validações OK: qualquer promotor pode finalizar o item
    item.status = 'CHECKOUT';
    item.checkOutTime = new Date(data.timestamp);

    await this.routeItemsRepository.save(item);

    // Check if all items in the route are completed
    if (item.route) {
        const routeItems = await this.routeItemsRepository.find({ 
            where: { route: { id: item.route.id } } 
        });
        
        const allCompleted = routeItems.every(i => 
            i.id === item.id ? (item.status === 'CHECKOUT' || item.status === 'COMPLETED') : 
            (i.status === 'CHECKOUT' || i.status === 'COMPLETED')
        );

        if (allCompleted) {
            await this.routesRepository.update(item.route.id, { status: 'COMPLETED' });
        }
    }

    return this.routeItemsRepository.findOne({ 
      where: { id: itemId },
      relations: ['route', 'products', 'checkins', 'checkins.promoter']
    });
  }

  async findPendingApprovals() {
    return this.routeItemProductsRepository.find({
      where: { stockCountStatus: 'PENDING_REVIEW' },
      relations: ['product', 'product.brand', 'routeItem', 'routeItem.supermarket', 'routeItem.route'],
      order: { checkInTime: 'DESC' }
    });
  }

  async processStockApproval(id: string, action: 'APPROVE' | 'REJECT', observation?: string) {
    const itemProduct = await this.routeItemProductsRepository.findOne({
      where: { id },
      relations: ['product', 'product.brand']
    });

    if (!itemProduct) {
      throw new NotFoundException('Product check not found');
    }

    if (itemProduct.stockCountStatus === 'APPROVED') {
       return { success: true, message: 'Already approved' };
    }

    if (action === 'APPROVE') {
      itemProduct.stockCountStatus = 'APPROVED';
    } else if (action === 'REJECT') {
      itemProduct.stockCountStatus = 'REJECTED';
    }

    if (observation) {
      itemProduct.observation = (itemProduct.observation ? itemProduct.observation + '\n' : '') + `[Admin ${action}]: ${observation}`;
    }

    await this.routeItemProductsRepository.save(itemProduct);
    return { success: true, status: itemProduct.stockCountStatus };
  }

  async getPublicStockValidation(token: string) {
    const itemProduct = await this.routeItemProductsRepository.findOne({
      where: { approvalToken: token },
      relations: ['product', 'product.brand', 'routeItem', 'routeItem.supermarket']
    });

    if (!itemProduct) {
      throw new NotFoundException('Validation request not found or expired');
    }

    return {
      id: itemProduct.id,
      productName: itemProduct.product.name,
      brandName: itemProduct.product.brand.name,
      supermarketName: itemProduct.routeItem?.supermarket?.fantasyName || 'PDV Desconhecido',
      stockCount: itemProduct.stockCount,
      status: itemProduct.stockCountStatus,
      timestamp: itemProduct.checkInTime || new Date(),
      observation: itemProduct.observation
    };
  }

  async processPublicStockValidation(token: string, action: 'APPROVE' | 'REJECT', observation?: string) {
    const itemProduct = await this.routeItemProductsRepository.findOne({
      where: { approvalToken: token },
      relations: ['product', 'product.brand']
    });

    if (!itemProduct) {
      throw new NotFoundException('Validation request not found or expired');
    }

    if (itemProduct.stockCountStatus === 'APPROVED') {
       return { success: true, message: 'Already approved' };
    }

    if (action === 'APPROVE') {
      itemProduct.stockCountStatus = 'APPROVED';
      // Clear token after approval? Or keep it for history? 
      // Keep it for now, maybe nullify later.
    } else if (action === 'REJECT') {
      itemProduct.stockCountStatus = 'REJECTED';
    }

    if (observation) {
      itemProduct.observation = (itemProduct.observation ? itemProduct.observation + '\n' : '') + `[Validation ${action}]: ${observation}`;
    }

    await this.routeItemProductsRepository.save(itemProduct);
    
    // Notify promoter? (WebSocket or just status update on next fetch)
    // For now, next fetch.

    return { success: true, status: itemProduct.stockCountStatus };
  }



  private async checkPromoterAvailability(promoterId: string, date: string, startTime: string, estimatedDuration: number, excludeRouteId?: string) {
    if (!promoterId || !date || !startTime || !estimatedDuration) return;

    const blockingAbsence = await this.absencesService.findBlockingAbsence(promoterId, date, startTime, estimatedDuration);
    if (blockingAbsence) {
      const startDate = blockingAbsence.startDate ? new Date(blockingAbsence.startDate as any).toISOString().slice(0, 10) : date;
      const endDate = blockingAbsence.endDate ? new Date(blockingAbsence.endDate as any).toISOString().slice(0, 10) : startDate;
      const startT = blockingAbsence.startTime ? String(blockingAbsence.startTime).slice(0, 5) : '';
      const endT = blockingAbsence.endTime ? String(blockingAbsence.endTime).slice(0, 5) : '';
      const period =
        startDate === endDate
          ? (startT || endT ? `${startDate} ${startT || '00:00'} - ${endT || '23:59'}` : startDate)
          : `${startDate} - ${endDate}`;
      throw new BadRequestException(`O promotor possui ${String(blockingAbsence.type || 'ausência')} em ${period}.`);
    }

    // Convert time to minutes
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = startMinutes + estimatedDuration;

    // Find other routes for this promoter on this date (Main OR Shared)
    const routes = await this.routesRepository.find({
      where: [
        { promoter: { id: promoterId }, date: date },
        { promoters: { id: promoterId }, date: date }
      ],
      relations: ['items', 'items.supermarket']
    });

    for (const route of routes) {
      if (excludeRouteId && route.id === excludeRouteId) continue;

      for (const item of route.items) {
        if (!item.startTime || !item.estimatedDuration) continue;

        const itemStart = this.timeToMinutes(item.startTime);
        const itemEnd = itemStart + item.estimatedDuration;

        // Check overlap: (StartA < EndB) && (EndA > StartB)
        if (startMinutes < itemEnd && endMinutes > itemStart) {
           throw new BadRequestException(`O promotor já possui um agendamento conflitante neste horário (PDV: ${item.supermarket?.fantasyName || 'Desconhecido'}, ${item.startTime} - ${this.minutesToTime(itemEnd)}).`);
        }
      }
    }
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private validateBrandAvailability(
    brand: Brand,
    date: string,
    items: Array<{ startTime?: string; endTime?: string; estimatedDuration?: number }>,
  ) {
    const windows = Array.isArray((brand as any).availabilityWindows) ? (brand as any).availabilityWindows : [];
    const activeWindows = windows.filter((w: any) => w && w.active !== false);
    if (activeWindows.length === 0) return;

    const dt = new Date(`${date}T03:00:00.000Z`);
    const dayOfWeek = dt.getUTCDay();
    const dayWindow = activeWindows.find((w: any) => Number(w.dayOfWeek) === dayOfWeek);
    if (!dayWindow) {
      throw new BadRequestException('A marca não atende neste dia da semana.');
    }

    const windowStart = this.timeToMinutes(String(dayWindow.startTime));
    const windowEnd = this.timeToMinutes(String(dayWindow.endTime));

    for (const item of items || []) {
      if (!item?.startTime) continue;

      const start = this.timeToMinutes(String(item.startTime));
      const end = item.endTime
        ? this.timeToMinutes(String(item.endTime))
        : typeof item.estimatedDuration === 'number'
          ? start + Number(item.estimatedDuration)
          : start;

      if (end < start) {
        throw new BadRequestException('Horário inválido no agendamento.');
      }

      if (start < windowStart || end > windowEnd) {
        throw new BadRequestException(
          `Horário fora do atendimento da marca (${String(dayWindow.startTime)} - ${String(dayWindow.endTime)}).`,
        );
      }
    }
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }
}
