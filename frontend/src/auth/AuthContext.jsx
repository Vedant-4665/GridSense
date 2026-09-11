import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import { OWNER_ROLES } from "./roles.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined while the session is being checked, null when logged out.
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null));
    const expire = () => setUser(null);
    window.addEventListener("gridsense:unauthorized", expire);
    return () => window.removeEventListener("gridsense:unauthorized", expire);
  }, []);

  const value = useMemo(() => {
    const signIn = async (request) => {
      const account = await request;
      setUser(account);
      return account;
    };
    return {
      user,
      isOwner: Boolean(user && OWNER_ROLES.has(user.role)),
      login: (email, password) => signIn(api.login(email, password)),
      register: (account) => signIn(api.register(account)),
      demo: (role) => signIn(api.demo(role)),
      logout: async () => {
        await api.logout().catch(() => {});
        setUser(null);
      },
    };
  }, [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
