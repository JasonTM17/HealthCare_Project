"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getAuthHydrationSnapshot,
  getServerAuthSessionSnapshot,
  getServerAuthHydrationSnapshot,
  hydrateAuthSession,
  readAuthSession,
  subscribeToAuthSession,
  type AuthHydrationStatus,
  type AuthSession,
} from "../lib/api-client";

export function useAuthSession(): AuthSession | null {
  const session = useSyncExternalStore(
    subscribeToAuthSession,
    readAuthSession,
    getServerAuthSessionSnapshot,
  );
  useEffect(() => {
    void hydrateAuthSession();
  }, []);
  return session;
}

export function useAuthSessionStatus(): AuthHydrationStatus {
  const status = useSyncExternalStore(
    subscribeToAuthSession,
    getAuthHydrationSnapshot,
    getServerAuthHydrationSnapshot,
  );
  useEffect(() => {
    void hydrateAuthSession();
  }, []);
  return status;
}
