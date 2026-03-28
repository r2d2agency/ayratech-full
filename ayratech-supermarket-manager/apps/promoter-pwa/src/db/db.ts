import Dexie, { Table } from 'dexie';

export interface OfflineRoute {
  id: string;
  date: string;
  promoterId: string;
  promoters?: any[];
  items: any[]; // Storing full route items structure
  status: string;
  syncedAt: Date;
}

export interface PendingAction {
  id?: number;
  type: 'CHECKIN' | 'CHECKOUT' | 'FORM' | 'PHOTO' | 'TIME_CLOCK' | 'PRODUCT_CHECK' | 'DOCUMENT_UPLOAD' | 'BREAKAGE_REPORT';
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  payload: any;
  createdAt: Date;
  status: 'PENDING' | 'SYNCING' | 'ERROR';
  error?: string;
  retryCount: number;
}

export class AppDatabase extends Dexie {
  routes!: Table<OfflineRoute, string>;
  pendingActions!: Table<PendingAction, number>;

  constructor() {
    super('AyraTechPromoterDB');
    this.version(1).stores({
      routes: 'id, date, promoterId',
      pendingActions: '++id, type, status, createdAt'
    });
  }
}

export const db = new AppDatabase();
