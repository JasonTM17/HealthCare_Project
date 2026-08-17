"use client";

import { useSyncExternalStore } from "react";
import {
  getAuthSessionSnapshot,
  getServerAuthSessionSnapshot,
  subscribeToAuthSession,
} from "../lib/api-client";

export function useAuthSession() {
  return useSyncExternalStore(
    subscribeToAuthSession,
    getAuthSessionSnapshot,
    getServerAuthSessionSnapshot,
  );
}
