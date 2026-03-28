import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { RouteItem } from './entities/route-item.entity';
import { RouteItemProduct } from './entities/route-item-product.entity';
import { RouteItemProductChecklist } from './entities/route-item-product-checklist.entity';
import { Product } from '../entities/product.entity';
import { Supermarket } from '../entities/supermarket.entity';
import { ChecklistTemplate } from '../checklists/entities/checklist-template.entity';
import { ChecklistItemType } from '../checklists/entities/checklist-template-item.entity';

@Injectable()
export class RouteFactoryService {
    /**
     * Determines if a product can be added to a supermarket based on SupermarketGroup restrictions.
     */
    shouldAddProductToSupermarket(product: Product, supermarket: any): boolean {
        // If product has restricted groups, supermarket MUST belong to one of them.
        if (product && product.supermarketGroups && product.supermarketGroups.length > 0) {
            if (!supermarket || !supermarket.group) {
                // Supermarket has no group, but product is restricted -> SKIP
                return false;
            }
            const isAllowed = product.supermarketGroups.some(g => g.id === supermarket.group.id);
            if (!isAllowed) {
                // Product is restricted to groups A, B, but Supermarket is in group C (or A != C) -> SKIP
                return false;
            }
        }
        // If product.supermarketGroups is empty, it's available to all (Global).
        return true;
    }

    /**
     * Resolves the correct checklist template for a product in a route.
     * Hierarchy: Explicit -> Product Specific -> Client Default -> Brand Client Default
     */
    resolveChecklistTemplate(
        product: Product, 
        explicitTemplateId?: string, 
        routeChecklistTemplateId?: string,
        templatesMap?: Map<string, ChecklistTemplate>,
        routeType: string = 'VISIT'
    ): ChecklistTemplate | null {
        if (explicitTemplateId && templatesMap) {
            return templatesMap.get(explicitTemplateId) || null;
        }
        
        if (!product) return null;

        if (routeChecklistTemplateId && templatesMap) {
            return templatesMap.get(routeChecklistTemplateId) || null;
        }

        if (product.checklistTemplate) {
            return product.checklistTemplate as any;
        }

        const brand: any = (product as any).brand;
        if (brand?.checklistTemplateId && templatesMap) {
            return templatesMap.get(brand.checklistTemplateId) || null;
        }

        const client: any = (product as any).client || brand?.client;
        
        // Determine client default template based on route type
        const clientTemplateId = routeType === 'INVENTORY'
             ? client?.defaultInventoryChecklistTemplateId || client?.defaultVisitChecklistTemplateId
             : client?.defaultVisitChecklistTemplateId || client?.defaultInventoryChecklistTemplateId;
             
        if (clientTemplateId && templatesMap) {
            return templatesMap.get(clientTemplateId) || null;
        }
        
        return null;
    }

    /**
     * Creates checklist items for a RouteItemProduct based on a template.
     */
    async createChecklists(
        manager: EntityManager,
        routeItemProduct: RouteItemProduct,
        template: ChecklistTemplate
    ) {
        if (!template?.items?.length) return;

        const checklists = [];
        for (const tplItem of template.items) {
             if (tplItem.type === ChecklistItemType.PRICE_CHECK && tplItem.competitors?.length > 0) {
                 for (const comp of tplItem.competitors) {
                     checklists.push(manager.create(RouteItemProductChecklist, {
                         routeItemProduct,
                         description: tplItem.description,
                         type: tplItem.type,
                         isChecked: false,
                         competitorName: comp.name
                     }));
                 }
             } else {
                 checklists.push(manager.create(RouteItemProductChecklist, {
                     routeItemProduct,
                     description: tplItem.description,
                     type: tplItem.type,
                     isChecked: false,
                     competitorName: tplItem.competitor?.name || null
                 }));
             }
        }
        
        if (checklists.length > 0) {
            await manager.save(RouteItemProductChecklist, checklists);
        }
    }

    async createChecklistsFromTypes(
        manager: EntityManager,
        routeItemProduct: RouteItemProduct,
        types: ChecklistItemType[]
    ) {
        const normalized = Array.from(new Set((types || []).filter(Boolean)));
        if (normalized.length === 0) return;

        const checklists: RouteItemProductChecklist[] = [];

        if (normalized.includes(ChecklistItemType.STOCK_COUNT)) {
            checklists.push(manager.create(RouteItemProductChecklist, {
                routeItemProduct,
                description: 'Contagem (Loja)',
                type: ChecklistItemType.STOCK_COUNT,
                isChecked: false
            }));
            checklists.push(manager.create(RouteItemProductChecklist, {
                routeItemProduct,
                description: 'Contagem (Estoque)',
                type: ChecklistItemType.STOCK_COUNT,
                isChecked: false
            }));
        }

        if (normalized.includes(ChecklistItemType.VALIDITY_CHECK)) {
            checklists.push(manager.create(RouteItemProductChecklist, {
                routeItemProduct,
                description: 'Validade',
                type: ChecklistItemType.VALIDITY_CHECK,
                isChecked: false
            }));
        }

        if (checklists.length > 0) {
            await manager.save(RouteItemProductChecklist, checklists);
        }
    }
}
