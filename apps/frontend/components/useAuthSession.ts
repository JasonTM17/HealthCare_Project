"use client";

import { useEffect, useState } from "react";
import {
  readAuthSession,
  subscribeToAuthSession,
} from "../lib/api-client";

export function useAuthSession() {
  const [session, setSession] = useState(() => readAuthSession());

  useEffect(() => {
    const updateSession = (): void => setSession(readAuthSession());
    updateSession();
    return subscribeToAuthSession(updateSession);
  }, []);

  return session;
}
