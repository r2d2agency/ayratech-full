import React, { useMemo } from 'react';
import { Users, AlertTriangle, CheckCircle, MapPin, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface SupervisorDashboardProps {
  routes: any[];
}

const SupervisorDashboardView: React.FC<SupervisorDashboardProps> = ({ routes }) => {
  
  const stats = useMemo(() => {
    let totalPromoters = new Set();
    let activePromoters = new Set();
    let completedVisits = 0;
    let totalVisits = 0;
    let ruptures = 0;
    let activeVisitsList: any[] = [];
    let ruptureList: any[] = [];

    routes.forEach(route => {
      if (route.promoter) {
        totalPromoters.add(route.promoter.id);
      }

      route.items.forEach((item: any) => {
        totalVisits++;
        
        if (item.status === 'CHECKOUT' || item.status === 'COMPLETED') {
          completedVisits++;
        }
        
        if (item.status === 'CHECKIN') {
          if (route.promoter) activePromoters.add(route.promoter.id);
          activeVisitsList.push({
            promoterName: route.promoter?.fullName || 'Desconhecido',
            supermarketName: item.supermarket?.fantasyName || 'Loja',
            checkInTime: item.checkInTime,
            photo: route.promoter?.avatarUrl // Assuming avatar exists or use placeholder
          });
        }

        // Check products for ruptures
        if (item.products) {
          item.products.forEach((prod: any) => {
            if (prod.isStockout) {
              ruptures++;
              ruptureList.push({
                productName: prod.product?.name,
                supermarketName: item.supermarket?.fantasyName,
                promoterName: route.promoter?.fullName,
                time: item.updatedAt || new Date().toISOString() // Assuming timestamp exists
              });
            }
          });
        }
      });
    });

    return {
      totalPromoters: totalPromoters.size,
      activePromoters: activePromoters.size,
      completedVisits,
      totalVisits,
      ruptures,
      activeVisitsList,
      ruptureList: ruptureList.slice(0, 5) // Last 5 ruptures
    };
  }, [routes]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-800 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
        <h2 className="text-xl font-bold mb-1">Visão Geral</h2>
        <p className="text-blue-100 text-sm">Acompanhamento em tempo real</p>
        
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1 text-blue-100">
              <Users size={16} />
              <span className="text-xs">Ativos</span>
            </div>
            <p className="text-2xl font-bold">{stats.activePromoters}/{stats.totalPromoters}</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1 text-blue-100">
              <CheckCircle size={16} />
              <span className="text-xs">Visitas</span>
            </div>
            <p className="text-2xl font-bold">{stats.completedVisits}/{stats.totalVisits}</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1 text-red-200">
              <AlertTriangle size={16} />
              <span className="text-xs">Rupturas</span>
            </div>
            <p className="text-2xl font-bold text-red-100">{stats.ruptures}</p>
          </div>
        </div>
      </div>

      {/* Active Now Section */}
      <section>
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          Em Atendimento Agora
        </h3>
        
        {stats.activeVisitsList.length === 0 ? (
          <div className="bg-white p-6 rounded-xl text-center text-gray-400 text-sm">
            Nenhum promotor em loja no momento.
          </div>
        ) : (
          <div className="space-y-3">
            {stats.activeVisitsList.map((visit, idx) => (
              <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                  {visit.promoterName.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{visit.promoterName}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <MapPin size={12} />
                    {visit.supermarketName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    <Clock size={12} />
                    {visit.checkInTime ? format(new Date(visit.checkInTime), 'HH:mm') : '--:--'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Alerts */}
      <section>
        <h3 className="font-bold text-gray-800 mb-3">Últimas Rupturas Reportadas</h3>
        {stats.ruptureList.length === 0 ? (
          <div className="bg-white p-6 rounded-xl text-center text-gray-400 text-sm">
            Nenhuma ruptura reportada hoje.
          </div>
        ) : (
          <div className="space-y-3">
            {stats.ruptureList.map((alert, idx) => (
              <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-red-500">
                <p className="font-medium text-gray-900">{alert.productName}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-500">{alert.supermarketName}</span>
                  <span className="text-xs text-gray-400">{alert.promoterName}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default SupervisorDashboardView;
