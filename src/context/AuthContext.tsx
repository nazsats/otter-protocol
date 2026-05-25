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
  connectWallet: (address: string) => Promise<void>;
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
    const result = await signInWithPopup(auth, twitterProvider);
    // Twitter provides the handle via providerData
    const handle = (result.user.providerData[0]?.displayName) || result.user.displayName;
    await createUserProfile(result.user.uid, {
      email:       result.user.email,
      displayName: handle,
      referredBy:  referralCode ?? null,
    });
    await refreshProfile();
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

  const connectWallet = async (address: string) => {
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
        connectWallet,
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
