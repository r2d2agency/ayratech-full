import React, { useEffect, useState, useRef } from 'react';
import { Search, Bell, FileText, Info, CheckCircle, Menu, Sun, Moon } from 'lucide-react';
import api from '../api/client';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../utils/image';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

interface User {
  id: string;
  email: string;
  role: {
    name: string;
  };
  employee?: {
    name: string;
    fullName: string;
    facialPhotoUrl?: string;
    position?: string;
  };
}

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  type: string;
  createdAt: string;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    fetchUser();

    // Close notifications on click outside
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUser = async () => {
    try {
      // Use /auth/profile instead of /users/me to support both Users and Clients
      const response = await api.get('/auth/profile');
      const data = response.data;
      
      if (data.role === 'client') {
         setUser({
            id: data.clientId,
            email: data.username,
            role: { name: 'Cliente' },
            employee: {
                name: data.razaoSocial,
                fullName: data.razaoSocial,
                position: 'Acesso Externo'
            }
         });
         // Clients don't have notifications system yet
         return; 
      }

      // If regular user, we might want more details, but profile has basic info
      // Or we can call /users/me if we really need DB fresh data
      // For now, let's stick to profile or try /users/me only if not client
      try {
          const userDetail = await api.get('/users/me');
          setUser(userDetail.data);
          fetchNotifications();
      } catch (e) {
          // Fallback to token data
           setUser({
            id: data.userId,
            email: data.username,
            role: { name: data.role },
            employee: data.employee
         });
      }

    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data);
    } catch (error) {
      // console.error('Error fetching notifications:', error);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };
  
  const handleMarkAllAsRead = async () => {
      try {
          await api.patch('/notifications/read-all');
          setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      } catch (error) {
          console.error('Error marking all as read:', error);
      }
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'document': return <FileText size={16} className="text-blue-500" />;
      case 'alert': return <Info size={16} className="text-red-500" />;
      default: return <Info size={16} className="text-gray-500" />;
    }
  };

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between bg-[color:var(--surface)]/80 backdrop-blur-md px-8 border-b border-[color:var(--color-border)] h-16">
      <div className="flex items-center gap-4">
        <button 
          onClick={onToggleSidebar}
          className="md:hidden p-2 -ml-2 text-[color:var(--color-muted)] hover:bg-white/5 rounded-lg"
        >
          <Menu size={24} />
        </button>
        <div className="relative hidden md:block group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-muted)] transition-colors group-focus-within:text-[color:var(--color-secondary)]" size={18} />
          <input 
            type="text" 
            placeholder="Busca global..." 
            className="h-10 w-64 xl:w-80 rounded-full border-none bg-[color:var(--surface-container-highest)] pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-[color:var(--color-secondary)]/50 placeholder-[color:var(--color-muted)] text-[color:var(--color-text)]"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={toggleTheme}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl text-[color:var(--color-muted)] hover:text-[color:var(--color-secondary)] hover:bg-white/5 transition-colors border border-[color:var(--color-border)]"
          title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className="relative" ref={notificationRef}>
          <button 
            className="relative flex h-10 w-10 items-center justify-center rounded-xl text-[color:var(--color-muted)] hover:text-[color:var(--color-secondary)] hover:bg-white/5 transition-colors border border-[color:var(--color-border)]"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-12 w-80 bg-[color:var(--surface-container-low)] rounded-xl shadow-[0_0_20px_rgba(253,0,255,0.12)] border border-[color:var(--color-border)] overflow-hidden z-50">
              <div className="p-3 border-b border-[color:var(--color-border)] flex justify-between items-center bg-[color:var(--surface)]/40">
                <h3 className="font-semibold text-[color:var(--color-text)] text-sm">Notificações</h3>
                {unreadCount > 0 && (
                    <button onClick={handleMarkAllAsRead} className="text-xs text-[color:var(--color-primary)] font-medium">
                        Marcar todas como lidas
                    </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-[color:var(--color-muted)] text-sm">
                    Nenhuma notificação
                  </div>
                ) : (
                  notifications.map(notification => (
                    <div 
                      key={notification.id} 
                      className={`p-3 border-b border-[color:var(--color-border)] hover:bg-white/5 transition-colors cursor-pointer ${notification.read ? 'opacity-60' : 'bg-[color:var(--surface-container-highest)]/40'}`}
                      onClick={() => handleMarkAsRead(notification.id)}
                    >
                      <div className="flex gap-3">
                        <div className={`mt-1 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${notification.read ? 'bg-[color:var(--surface-container-highest)]' : 'bg-[color:var(--surface)] shadow-sm border border-[color:var(--color-border)]'}`}>
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm ${notification.read ? 'text-[color:var(--color-muted)]' : 'text-[color:var(--color-text)] font-medium'}`}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-[color:var(--color-muted)] mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-[10px] text-[color:var(--color-muted)] mt-1">
                            {new Date(notification.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="mt-2 h-2 w-2 rounded-full bg-[color:var(--color-tertiary)] shrink-0"></div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pl-4 border-l border-[color:var(--color-border)]">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-[color:var(--color-text)] ">
              {user?.employee?.fullName || user?.employee?.name || user?.email || 'Usuário'}
            </p>
            <p className="text-[10px] text-[color:var(--color-muted)] font-medium uppercase tracking-wider ">
              {user?.employee?.position || user?.role?.name || 'Nível de Acesso'}
            </p>
          </div>
          <div className="h-10 w-10 overflow-hidden rounded-full border border-[color:var(--color-primary)]/30 cursor-pointer transition-all bg-[color:var(--surface-container-highest)]">
            {user?.employee?.facialPhotoUrl ? (
               <img 
                 src={getImageUrl(user.employee.facialPhotoUrl)} 
                 alt="User" 
                 className="h-full w-full object-cover"
               />
            ) : (
                <img src={`https://ui-avatars.com/api/?name=${user?.employee?.name || user?.email || 'User'}&background=random`} alt="User" />
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
