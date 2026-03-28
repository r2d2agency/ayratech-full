import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../api/client';
import { Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TimeClockAlert = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [alert, setAlert] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    const socket = io(API_URL + '/time-clock');

    socket.on('connect', () => {
      console.log('Connected to TimeClock WebSocket');
      // Assuming user object has employeeId or id. 
      // Usually auth user has 'id' which maps to User entity, but we need Employee ID.
      // If user.employeeId exists, use it. If not, we might need to fetch it or assuming user.id is what we want?
      // In backend Auth, we usually attach employeeId to payload if linked.
      // Let's assume user.employeeId is available or we use user.id if it matches.
      // Checking AuthContext might be useful, but for now let's try user.employeeId || user.id
      socket.emit('join-employee-room', { employeeId: (user as any).employee?.id || user.id });
    });

    socket.on('employee-alert', (data) => {
        console.log('Received Alert', data);
        setAlert(data);
        if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  if (!alert) return null;

  return (
    <div className="fixed inset-0 z-50 bg-red-600 bg-opacity-95 flex flex-col items-center justify-center p-6 text-white text-center animate-in zoom-in duration-300">
      <div className="bg-white text-red-600 p-6 rounded-full mb-6 shadow-lg animate-bounce">
        <Clock size={64} />
      </div>
      <h1 className="text-3xl font-bold mb-4">{alert.title}</h1>
      <p className="text-xl mb-8">{alert.message}</p>
      
      <button 
        onClick={() => {
            setAlert(null);
            navigate('/time-clock');
        }}
        className="bg-white text-red-600 px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-gray-100 active:scale-95 transition-transform w-full"
      >
        REGISTRAR PONTO AGORA
      </button>
      
      <button 
        onClick={() => setAlert(null)}
        className="mt-4 text-white/80 font-medium"
      >
        Fechar
      </button>
    </div>
  );
};

export default TimeClockAlert;
