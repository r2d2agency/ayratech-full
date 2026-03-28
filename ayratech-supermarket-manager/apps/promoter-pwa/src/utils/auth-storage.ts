
// Simple SHA-256 hash function for offline credential verification
export const hashPassword = async (password: string): Promise<string> => {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

interface StoredSession {
  identifier: string;
  passwordHash: string;
  token: string;
  user: any;
  lastLogin: number;
}

const STORAGE_KEY = 'offline_session_backup';

export const saveOfflineSession = async (identifier: string, password: string, token: string, user: any) => {
  try {
    const passwordHash = await hashPassword(password);
    const session: StoredSession = {
      identifier,
      passwordHash,
      token,
      user,
      lastLogin: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.error('Error saving offline session:', error);
  }
};

export const verifyOfflineLogin = async (identifier: string, password: string): Promise<{ token: string; user: any } | null> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const session: StoredSession = JSON.parse(stored);
    
    // Check identifier (case insensitive for email, direct for CPF)
    const isIdentifierMatch = session.identifier.toLowerCase() === identifier.toLowerCase() || 
                              session.identifier.replace(/\D/g, '') === identifier.replace(/\D/g, '');

    if (!isIdentifierMatch) return null;

    const inputHash = await hashPassword(password);
    if (inputHash === session.passwordHash) {
      return { token: session.token, user: session.user };
    }
    
    return null;
  } catch (error) {
    console.error('Error verifying offline login:', error);
    return null;
  }
};
