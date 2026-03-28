import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../api/client';
import { Bell, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const RouteUpdateAlert = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [alert, setAlert] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    // Connect to the 'notifications' namespace
    const socket = io(API_URL + '/notifications', {
        transports: ['websocket'],
        reconnection: true
    });

    socket.on('connect', () => {
      console.log('Connected to Notifications WebSocket');
      // Join room with user ID
      socket.emit('join', user.id);
    });

    socket.on('notification', (data) => {
        console.log('Received Notification', data);
        if (data.type === 'alert') {
            setAlert(data);
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        }
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from Notifications WebSocket');
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  if (!alert) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in duration-300 text-center">
        <div className="bg-blue-100 text-blue-600 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
          <Bell size={32} />
        </div>
        
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {alert.title}
        </h2>
        
        <p className="text-gray-600 mb-6">
          {alert.message}
        </p>
        
        <div className="flex flex-col gap-3">
            <button 
                onClick={() => {
                    setAlert(null);
                    // Reload the current page to fetch fresh data
                    window.location.reload();
                }}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 transition-all"
            >
                <RefreshCw size={20} />
                Atualizar Agora
            </button>
            
            <button 
                onClick={() => setAlert(null)}
                className="text-gray-500 font-medium py-2 hover:text-gray-700"
            >
                Fechar
            </button>
        </div>
      </div>
    </div>
  );
};

export default RouteUpdateAlert;
