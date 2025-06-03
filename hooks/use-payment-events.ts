import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PaymentState {
  lastSuccessfulPayment: {
    courseId: string | null;
    timestamp: number | null;
  };
  notifyPaymentSuccess: (courseId: string) => void;
  resetPaymentState: (courseId: string) => void;
}

/**
 * A hook to manage payment events across the application.
 * This allows components to react to successful payments without direct coupling.
 */
export const usePaymentEvents = create<PaymentState>()(
  persist(
    (set) => ({
      lastSuccessfulPayment: {
        courseId: null,
        timestamp: null,
      },
      notifyPaymentSuccess: (courseId: string) => {
        set({
          lastSuccessfulPayment: {
            courseId,
            timestamp: Date.now(),
          }
        });
      },
      resetPaymentState: (courseId: string) => {
        set((state) => {
          // Only reset if courseId matches the last successful payment
          if (state.lastSuccessfulPayment.courseId === courseId) {
            return {
              lastSuccessfulPayment: {
                courseId: null,
                timestamp: null,
              }
            };
          }
          return state;
        });
      }
    }),
    {
      name: 'payment-events-storage',
      // Only store for a short time to handle navigation and refreshes
      partialize: (state) => ({ lastSuccessfulPayment: state.lastSuccessfulPayment }),
    }
  )
);
