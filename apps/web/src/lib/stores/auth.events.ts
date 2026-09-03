type AuthIdentityListener = (authenticated: boolean) => void;

const listeners = new Set<AuthIdentityListener>();

export function onAuthIdentityChange(listener: AuthIdentityListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitAuthIdentityChange(authenticated: boolean): void {
  listeners.forEach((listener) => listener(authenticated));
}
