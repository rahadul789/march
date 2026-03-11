import { create } from 'zustand';

const useErrorStore = create((set) => ({
  globalError: null,
  setGlobalError: (error) =>
    set({
      globalError: {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'Something went wrong',
        statusCode: typeof error.statusCode === 'number' ? error.statusCode : 500,
        requestId: error.requestId || null,
        occurredAt: new Date().toISOString()
      }
    }),
  clearGlobalError: () => set({ globalError: null })
}));

export default useErrorStore;
