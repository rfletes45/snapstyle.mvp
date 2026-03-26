/**
 * SignupContext
 *
 * Holds temporary pre-auth signup state (email, password, TOS) across
 * the multi-step signup flow within the AuthStack. Unmounted automatically
 * when AppGate transitions away from the AuthStack.
 *
 * This ensures that moving back/forward between SignupEmail and
 * SignupPassword does not lose previously entered data.
 */

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SignupState {
  email: string;
  password: string;
  confirmPassword: string;
  tosAccepted: boolean;
}

interface SignupContextValue extends SignupState {
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  setConfirmPassword: (confirmPassword: string) => void;
  setTosAccepted: (accepted: boolean) => void;
  /** Reset all signup state (used on cancel / sign-out) */
  reset: () => void;
}

const INITIAL_STATE: SignupState = {
  email: "",
  password: "",
  confirmPassword: "",
  tosAccepted: false,
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SignupContext = createContext<SignupContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SignupProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SignupState>(INITIAL_STATE);

  const setEmail = useCallback(
    (email: string) => setState((s) => ({ ...s, email })),
    [],
  );
  const setPassword = useCallback(
    (password: string) => setState((s) => ({ ...s, password })),
    [],
  );
  const setConfirmPassword = useCallback(
    (confirmPassword: string) => setState((s) => ({ ...s, confirmPassword })),
    [],
  );
  const setTosAccepted = useCallback(
    (tosAccepted: boolean) => setState((s) => ({ ...s, tosAccepted })),
    [],
  );

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return (
    <SignupContext.Provider
      value={{
        ...state,
        setEmail,
        setPassword,
        setConfirmPassword,
        setTosAccepted,
        reset,
      }}
    >
      {children}
    </SignupContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSignup(): SignupContextValue {
  const ctx = useContext(SignupContext);
  if (!ctx) {
    throw new Error("useSignup must be used within a SignupProvider");
  }
  return ctx;
}
