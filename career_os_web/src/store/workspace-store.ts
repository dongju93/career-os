import { create } from 'zustand';
import type { StackPackageId } from '../data/stack-packages';

type WorkspaceState = {
  highlightedPackage: StackPackageId;
  incrementSharedCount: () => void;
  reset: () => void;
  selectPackage: (packageId: StackPackageId) => void;
  sharedCount: number;
};

function createInitialState() {
  return {
    highlightedPackage: 'mantine' as StackPackageId,
    sharedCount: 0,
  };
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  ...createInitialState(),
  incrementSharedCount: () =>
    set((state) => ({
      sharedCount: state.sharedCount + 1,
    })),
  reset: () => set(createInitialState()),
  selectPackage: (packageId) =>
    set({
      highlightedPackage: packageId,
    }),
}));

export function resetWorkspaceStore() {
  useWorkspaceStore.getState().reset();
}
