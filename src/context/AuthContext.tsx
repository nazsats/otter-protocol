"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from "firebase/auth";
import { auth, googleProvider, twitterProvider } from "@/lib/firebase";
import { createUserProfile, getUserProfile, linkWallet } from "@/lib/referral";

interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  walletAddress: string | null;
  referralCode: string;
  referralCount: number;
  tier: "NEWCOMER" | "MEMBER" | "OG";
  referredBy: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  authModal: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  signInWithGoogle: (referralCode?: string) => Promise<void>;
  signInWithTwitter: (referralCode?: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName: string,
    referralCode?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  /** Bind a wallet to the account. First connect only — never overwrites an
   *  existing binding (use changeWallet for that). Returns the resulting state. */
  bindWallet: (address: string) => Promise<"bound" | "already" | "mismatch">;
  /** Explicitly rebind the account to a new wallet (Profile → Change wallet). */
  changeWallet: (address: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authModal, setAuthModal] = useState(false);

  const refreshProfile = async () => {
    if (!user) return;
    const p = await getUserProfile(user.uid);
    if (p) setProfile(p as UserProfile);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Store uid so the wallet hook can link wallet → Firebase without auth dependency
        localStorage.setItem("otter_uid", u.uid);
        const p = await getUserProfile(u.uid);
        setProfile(p as UserProfile | null);
      } else {
        localStorage.removeItem("otter_uid");
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = async (referralCode?: string) => {
    const result = await signInWithPopup(auth, googleProvider);
    await createUserProfile(result.user.uid, {
      email:       result.user.email,
      displayName: result.user.displayName,
      referredBy:  referralCode ?? null,
    });
    await refreshProfile();
  };

  const signInWithTwitter = async (referralCode?: string) => {
    console.log("[OTTER AUTH] signInWithTwitter — start");
    console.log("[OTTER AUTH] Firebase authDomain:", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
    console.log("[OTTER AUTH] App URL:", process.env.NEXT_PUBLIC_APP_URL);
    try {
      const result = await signInWithPopup(auth, twitterProvider);
      console.log("[OTTER AUTH] signInWithPopup success — uid:", result.user.uid);
      console.log("[OTTER AUTH] providerData:", JSON.stringify(result.user.providerData));
      const handle = (result.user.providerData[0]?.displayName) || result.user.displayName;
      await createUserProfile(result.user.uid, {
        email:       result.user.email,
        displayName: handle,
        referredBy:  referralCode ?? null,
      });
      console.log("[OTTER AUTH] createUserProfile done");
      await refreshProfile();
      console.log("[OTTER AUTH] refreshProfile done — Twitter sign-in complete");
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string; customData?: unknown };
      console.error("[OTTER AUTH] Twitter sign-in FAILED");
      console.error("[OTTER AUTH] Error code:", e?.code);
      console.error("[OTTER AUTH] Error message:", e?.message);
      console.error("[OTTER AUTH] Full error:", JSON.stringify(err, null, 2));
      throw err;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    await refreshProfile();
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    displayName: string,
    referralCode?: string
  ) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });
    await createUserProfile(result.user.uid, {
      email,
      displayName,
      referredBy: referralCode ?? null,
    });
    await refreshProfile();
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
  };

  // First-time bind only. If a wallet is already bound, this NEVER silently
  // overwrites it — a different wallet is reported as "mismatch" so the UI can
  // tell the user they connected the wrong wallet.
  const bindWallet = async (address: string): Promise<"bound" | "already" | "mismatch"> => {
    if (!user) return "mismatch";
    const current = profile?.walletAddress;
    if (current) {
      return current.toLowerCase() === address.toLowerCase() ? "already" : "mismatch";
    }
    await linkWallet(user.uid, address);
    await refreshProfile();
    return "bound";
  };

  // Explicit rebind (Profile → Change wallet). Overwrites the binding.
  const changeWallet = async (address: string) => {
    if (!user) return;
    await linkWallet(user.uid, address);
    await refreshProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        authModal,
        openAuthModal:  () => setAuthModal(true),
        closeAuthModal: () => setAuthModal(false),
        signInWithGoogle,
        signInWithTwitter,
        signInWithEmail,
        signUpWithEmail,
        logout,
        bindWallet,
        changeWallet,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
