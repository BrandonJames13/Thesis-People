import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext();

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
      role: user.user_metadata?.user_role || user.user_metadata?.role || "faculty",
      raw: user, // keep raw in case you need it later
    };
  }

  useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    setCurrentUser(shapeUser(session?.user ?? null)); // ← wrap
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
    setCurrentUser(shapeUser(session?.user ?? null)); // ← wrap
  });

  return () => subscription.unsubscribe();
}, []);

     console.log("AuthContext: currentUser", currentUser);

  // * LOGIN FUNCTION
  const login = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return { success: false, message: error.message };

    return { success: true };
  }, []);

  // * SIGN UP FUNCTION - CALLS THE CUSTOM AUTH SERVER ENDPOINT
 const signUp = useCallback(async (email, password, name) => {
  const { error } = await supabase.auth.signUp({ email, password, options: { data: { name: name, role: "professor" } } });
  if (error) { console.error(error.message);
    return { success: false, message: error.message }; }
  return { success: true }; }, []);

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

  return (
    <AuthContext.Provider value={{ currentUser, login, signUp, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}