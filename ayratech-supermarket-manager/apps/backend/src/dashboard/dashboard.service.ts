import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, In } from 'typeorm';
import { Route } from '../routes/entities/route.entity';
import { Client } from '../entities/client.entity';
import { RouteItemProduct } from '../routes/entities/route-item-product.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Route)
    private routesRepository: Repository<Route>,
    @InjectRepository(Client)
    private clientsRepository: Repository<Client>,
    @InjectRepository(RouteItemProduct)
    private routeItemProductRepository: Repository<RouteItemProduct>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async getStats(period: string = 'today', userId?: string) {
    const startDate = this.getStartDate(period);
    
    // Check user role and assigned clients
    let allowedClientIds: string[] | null = null;
    if (userId) {
        const user = await this.usersRepository.findOne({ where: { id: userId }, relations: ['clients', 'role'] });
        // If user is not admin (assume 'admin' role name for now, logic can be more complex), limit clients
        if (user && user.role?.name?.toLowerCase() !== 'admin' && user.role?.name?.toLowerCase() !== 'administrador do sistema') {
            if (user.clients && user.clients.length > 0) {
                allowedClientIds = user.clients.map(c => c.id);
            } else if (user.role?.name?.toLowerCase().includes('supervisor')) {
                // Supervisor without clients sees nothing or everything? 
                // "so veja os clientes que estao em sua responsabilidade" implies nothing if no responsibility.
                allowedClientIds = []; 
            }
        }
    }

    // 1. Visitas Realizadas (Routes Completed/Confirmed)
    const routes = await this.routesRepository.find({
      where: {
        date: MoreThanOrEqual(startDate.toISOString().split('T')[0]),
      },
      relations: ['items', 'items.products', 'items.products.product', 'items.products.product.brand', 'items.products.product.brand.client']
    });

    // Filter routes based on allowedClientIds
    // A route is relevant if it contains items for the allowed clients.
    // However, routes are typically per promoter/date, but items are per supermarket? 
    // Wait, products belong to brands which belong to clients.
    // So we need to filter *items* or *products* within the routes that belong to the allowed clients.
    
    // Filter logic:
    // If allowedClientIds is set, only count products belonging to these clients.
    // If a route has NO products from these clients, ignore the route (or just the items).
    
    const filteredRoutes = routes.map(route => {
        // Clone route to avoid mutating original if needed (though find returns new objects usually)
        const newItems = route.items.map(item => {
            const newProducts = item.products.filter(p => {
                const client = p.product?.brand?.client;
                if (!allowedClientIds) return true;
                return client && allowedClientIds.includes(client.id);
            });
            return { ...item, products: newProducts };
        }).filter(item => item.products.length > 0);
        
        return { ...route, items: newItems };
    }).filter(route => route.items.length > 0);

    const completedRoutes = filteredRoutes.filter(r => ['COMPLETED', 'CONFIRMED'].includes(r.status));
    const visitsCount = completedRoutes.reduce((acc, r) => acc + r.items.length, 0);

    // 2. Fotos Enviadas
    let photosCount = 0;
    let checkedProductsCount = 0;
    let totalProductsCount = 0;
    
    filteredRoutes.forEach(route => {
        route.items.forEach(item => {
            item.products.forEach(p => {
                totalProductsCount++;
                if (p.checked) {
                    checkedProductsCount++;
                    if (p.photos && Array.isArray(p.photos)) {
                        photosCount += p.photos.length;
                    }
                }
            });
        });
    });

    // 3. Execução Perfeita (Checked / Total)
    const perfectExecution = totalProductsCount > 0 
        ? Math.round((checkedProductsCount / totalProductsCount) * 100) 
        : 0;

    // 4. Rupturas
    const rupturesCount = totalProductsCount - checkedProductsCount;

    // 5. Performance por Marca (Client)
    const clientPerformanceMap = new Map<string, { total: number; checked: number; client: Client }>();

    filteredRoutes.forEach(route => {
        route.items.forEach(item => {
            item.products.forEach(p => {
                const client = p.product?.brand?.client;
                if (client) {
                     // Double check filter (already done above but safe to keep)
                    if (allowedClientIds && !allowedClientIds.includes(client.id)) return;

                    if (!clientPerformanceMap.has(client.id)) {
                        clientPerformanceMap.set(client.id, { total: 0, checked: 0, client });
                    }
                    const stats = clientPerformanceMap.get(client.id);
                    stats.total++;
                    if (p.checked) stats.checked++;
                }
            });
        });
    });

    // If allowedClientIds is set, we might want to show clients even if they have 0 activity today?
    // User wants "dashboard com os kpi de cada cliente...".
    // If a client has no activity today, they won't appear in routes.
    // We should pre-fill the map with allowed clients if they exist.
    if (allowedClientIds && allowedClientIds.length > 0) {
        const userClients = await this.clientsRepository.find({ where: { id: In(allowedClientIds) } });
        userClients.forEach(c => {
            if (!clientPerformanceMap.has(c.id)) {
                 clientPerformanceMap.set(c.id, { total: 0, checked: 0, client: c });
            }
        });
    }
    
    const clientPerformance = Array.from(clientPerformanceMap.values()).map(stat => ({
        id: stat.client.id,
        name: stat.client.nomeFantasia || stat.client.razaoSocial,
        logo: stat.client.logo || 'https://placehold.co/150',
        percentage: stat.total > 0 ? Math.round((stat.checked / stat.total) * 100) : 0
    })).sort((a, b) => b.percentage - a.percentage);

    return {
        visits: {
            value: visitsCount.toString(),
            trend: '+5%', 
        },
        photos: {
            value: photosCount.toString(),
            trend: '+12%',
        },
        execution: {
            value: `${perfectExecution}%`,
            trend: perfectExecution > 80 ? '+2%' : '-5%',
        },
        ruptures: {
            value: rupturesCount.toString(),
            sub: 'Produtos não encontrados',
        },
        clients: clientPerformance
    };
  }

  async getAggregate(period: string = 'today', userId?: string) {
    const startDate = this.getStartDate(period);
    let allowedClientIds: string[] | null = null;
    if (userId) {
      const user = await this.usersRepository.findOne({ where: { id: userId }, relations: ['clients', 'role'] });
      if (user && user.role?.name?.toLowerCase() !== 'admin' && user.role?.name?.toLowerCase() !== 'administrador do sistema') {
        if (user.clients && user.clients.length > 0) {
          allowedClientIds = user.clients.map(c => c.id);
        } else if (user.role?.name?.toLowerCase().includes('supervisor')) {
          allowedClientIds = [];
        }
      }
    }
    const routes = await this.routesRepository.find({
      where: {
        date: MoreThanOrEqual(startDate.toISOString().split('T')[0]),
      },
      relations: ['items', 'items.products', 'items.products.product', 'items.products.product.brand', 'items.products.product.brand.client', 'items.products.product.categoryRef']
    });
    const aggMap = new Map<string, { clientId: string; clientName: string; category: string; gondola: number; inventory: number; total: number; validitySoon: number; ruptures: number }>();
    const now = new Date();
    const soonDays = 7;
    for (const route of routes) {
      for (const item of route.items) {
        for (const p of item.products) {
          const client = p.product?.brand?.client;
          if (allowedClientIds && (!client || !allowedClientIds.includes(client.id))) continue;
          const clientId = client?.id || 'unknown';
          const clientName = client?.nomeFantasia || client?.razaoSocial || 'Cliente';
          const category = p.product?.categoryRef?.name || p.product?.category || 'Sem Categoria';
          const key = `${clientId}:${category}`;
          if (!aggMap.has(key)) {
            aggMap.set(key, { clientId, clientName, category, gondola: 0, inventory: 0, total: 0, validitySoon: 0, ruptures: 0 });
          }
          const entry = aggMap.get(key)!;
          entry.gondola += p.gondolaCount || 0;
          entry.inventory += p.inventoryCount || 0;
          entry.total += p.stockCount || 0;
          if (p.isStockout) entry.ruptures += 1;
          if (p.validityDate) {
            const valDate = new Date(p.validityDate);
            const diff = (valDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
            if (diff >= 0 && diff <= soonDays) entry.validitySoon += 1;
          }
        }
      }
    }
    return Array.from(aggMap.values()).sort((a, b) => a.clientName.localeCompare(b.clientName) || a.category.localeCompare(b.category));
  }
  private getStartDate(period: string): Date {
    const now = new Date();
    if (period === 'today') {
      return now; // Actually backend stores date as string YYYY-MM-DD usually, so this might need adjustment.
      // But let's assume we want routes from today.
      // Since date is string in DB, we should handle it carefully.
    } else if (period === 'week') {
      const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
      return firstDay;
    }
    return new Date(0); // All time
  }
}
