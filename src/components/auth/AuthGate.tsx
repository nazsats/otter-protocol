"use client";
import { useAuth } from "@/context/AuthContext";
import AuthModal from "./AuthModal";

// Renders the auth modal globally when triggered from anywhere
export default function AuthGate() {
  const { authModal } = useAuth();
  if (!authModal) return null;
  return <AuthModal />;
}
