"use client";

import { useSyncExternalStore } from "react";

function subscribeToConnectionStatus(onStatusChange: () => void) {
  window.addEventListener("online", onStatusChange);
  window.addEventListener("offline", onStatusChange);

  return () => {
    window.removeEventListener("online", onStatusChange);
    window.removeEventListener("offline", onStatusChange);
  };
}

function getConnectionStatus() {
  return navigator.onLine;
}

function getServerConnectionStatus() {
  return true;
}

export function ConnectionStatus() {
  const online = useSyncExternalStore(
    subscribeToConnectionStatus,
    getConnectionStatus,
    getServerConnectionStatus,
  );

  return (
    <span
      className={
        online
          ? "text-xs font-medium text-green-700"
          : "text-xs font-medium text-amber-700"
      }
    >
      {online ? "Online" : "Offline — changes saved locally"}
    </span>
  );
}
