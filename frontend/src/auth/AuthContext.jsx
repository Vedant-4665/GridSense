import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import { OWNER_ROLES } from "./roles.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined while the session is being checked, null when logged out.
  const [user, setUser] = useState(undefined);
  // Set when the session check failed for a reason other than "not signed in",
  // so the app can say the server is unreachable instead of pretending the
  // person has been logged out.
  const [unreachable, setUnreachable] = useState(null);

  const check = useCallback(() => {
    setUnreachable(null);
    return api.me()
      .then((account) => { setUser(account); })
      .catch((error) => {
        setUser(null);
        if (error?.status !== 401) setUnreachable(error);
      });
  }, []);

  useEffect(() => {
    check();
    const expire = () => setUser(null);
    window.addEventListener("gridsense:unauthorized", expire);
    return () => window.removeEventListener("gridsense:unauthorized", expire);
  }, [check]);

  const value = useMemo(() => {
    const signIn = async (request) => {
      const account = await request;
      setUser(account);
      return account;
    };
    return {
      user,
      unreachable,
      retryConnection: check,
      isOwner: Boolean(user && OWNER_ROLES.has(user.role)),
      login: (email, password) => signIn(api.login(email, password)),
      register: (account) => signIn(api.register(account)),
      demo: (role) => signIn(api.demo(role)),
      logout: async () => {
        await api.logout().catch(() => {});
        setUser(null);
      },
    };
  }, [user, unreachable, check]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
