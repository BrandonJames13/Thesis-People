import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext();

function normalizeRole(role) {
  const normalized = String(role || "")
    .toLowerCase()
    .trim();
  if (normalized === "admin") return "admin";
  return "faculty";
}

async function resolveRoleFromDatabase(userId, fallbackRole) {
  if (!userId) {
    return fallbackRole;
  }

  const { data, error } = await supabase
    .from("users_table")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.role) {
    return fallbackRole;
  }

  return normalizeRole(data.role);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);

  // * CHECK FOR EXISTING SESSION ON MOUNT

  function shapeUser(user) {
    if (!user) return null;
    const name = user.user_metadata?.name || user.email;
    const initials = name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    return {
      id: user.id,
      email: user.email,
      name,
      initials,
      role: normalizeRole(
        user.user_metadata?.user_role || user.user_metadata?.role || "faculty",
      ),
      raw: user, //* keep raw in case you need it later
    };
  }

  useEffect(() => {
    let isMounted = true;

    const setHydratedUser = async (rawUser) => {
      const shaped = shapeUser(rawUser ?? null);

      if (!shaped) {
        if (isMounted) {
          setCurrentUser(null);
        }
        return;
      }

      const resolvedRole = await resolveRoleFromDatabase(
        shaped.id,
        shaped.role,
      );

      if (isMounted) {
        setCurrentUser({
          ...shaped,
          role: resolvedRole,
        });
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setHydratedUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setHydratedUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // * LOGIN FUNCTION
  const login = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return { success: false, message: error.message };

    return { success: true };
  }, []);

  // * SIGN UP FUNCTION - CALLS THE CUSTOM AUTH SERVER ENDPOINT
  const signUp = useCallback(async (email, password, name) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name, role: "professor" } },
    });
    if (error) {
      console.error(error.message);
      return { success: false, message: error.message };
    }
    return { success: true };
  }, []);

  // * LOGOUT FUNCTION

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // * CHANGE PASSWORD FUNCTION
  const changePassword = useCallback(async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return error.message;
    return null;
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      isAdmin: currentUser?.role === "admin",
      login,
      signUp,
      logout,
      changePassword,
    }),
    [currentUser, login, signUp, logout, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
