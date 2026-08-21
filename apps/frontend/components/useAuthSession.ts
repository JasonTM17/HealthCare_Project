"use client";

import { useSyncExternalStore } from "react";
import {
  getServerAuthSessionSnapshot,
  readAuthSession,
  subscribeToAuthSession,
  type AuthSession,
} from "../lib/api-client";

export function useAuthSession(): AuthSession | null {
  return useSyncExternalStore(
    subscribeToAuthSession,
    readAuthSession,
    getServerAuthSessionSnapshot,
  );
}
