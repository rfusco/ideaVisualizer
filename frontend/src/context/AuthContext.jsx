import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("auth_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios
        .get("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem("auth_token");
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(email, password) {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    const res = await axios.post("/api/auth/login", form);
    localStorage.setItem("auth_token", res.data.access_token);
    setToken(res.data.access_token);
    setUser(res.data.user);
  }

  async function register(email, password) {
    const res = await axios.post("/api/auth/register", { email, password });
    localStorage.setItem("auth_token", res.data.access_token);
    setToken(res.data.access_token);
    setUser(res.data.user);
  }

  function logout() {
    localStorage.removeItem("auth_token");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
