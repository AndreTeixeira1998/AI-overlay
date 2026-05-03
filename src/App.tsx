import SubscribedApp from "./_pages/SubscribedApp"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useCallback, useEffect, useState } from "react"
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport
} from "./components/ui/toast"
import { ToastContext } from "./contexts/toast"

// Create a React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: Infinity,
      retry: 1,
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: 1
    }
  }
})

function App() {
  const [toastState, setToastState] = useState({
    open: false,
    title: "",
    description: "",
    variant: "neutral" as const
  })
  const [currentLanguage, setCurrentLanguage] = useState<string>("java")

  // Helper function to safely update language
  const updateLanguage = useCallback((newLanguage: string) => {
    window.__LANGUAGE__ = newLanguage
  }, [])

  useEffect(() => {
    updateLanguage(currentLanguage)
  }, [currentLanguage, updateLanguage])

  // Mark as initialized so the main process can proceed when needed
  useEffect(() => {
    window.__IS_INITIALIZED__ = true
    return () => {
      window.__IS_INITIALIZED__ = false
    }
  }, [])

  // Show toast method
  const showToast = useCallback(
    (
      title: string,
      description: string,
      variant: "neutral" | "success" | "error"
    ) => {
      setToastState({
        open: true,
        title,
        description,
        // @ts-ignore
        variant
      })
    },
    []
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ToastContext.Provider value={{ showToast }}>
          <SubscribedApp
            currentLanguage={currentLanguage}
            setLanguage={setCurrentLanguage}
          />
          <Toast
            open={toastState.open}
            onOpenChange={(open) =>
              setToastState((prev) => ({ ...prev, open }))
            }
            variant={toastState.variant}
            duration={1500}
          >
            <ToastTitle>{toastState.title}</ToastTitle>
            <ToastDescription>{toastState.description}</ToastDescription>
          </Toast>
          <ToastViewport />
        </ToastContext.Provider>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
