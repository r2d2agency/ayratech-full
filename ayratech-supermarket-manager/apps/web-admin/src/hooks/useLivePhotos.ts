import { useState, useEffect } from 'react';
import api from '../api/client';

export interface RecentPhoto {
  id: string;
  photoUrl: string;
  productName: string;
  brandName: string;
  supermarketName: string;
  promoterName: string;
  timestamp: string;
}

export function useLivePhotos(minutes = 30, intervalMs = 15000, clientId?: string) {
  const [photos, setPhotos] = useState<RecentPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPhotos = async () => {
    try {
      const params: any = { minutes };
      if (clientId) params.clientId = clientId;
      
      const res = await api.get('/routes/photos/recent', { params });
      setPhotos(res.data);
    } catch (error) {
      console.error('Error fetching recent photos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
    const interval = setInterval(fetchPhotos, intervalMs);
    return () => clearInterval(interval);
  }, [minutes, intervalMs, clientId]);

  return { photos, loading, refresh: fetchPhotos };
}
