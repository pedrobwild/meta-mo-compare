import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Workspace {
  id: string;
  name: string;
  owner_user_id: string | null;
}

interface WorkspaceContextType {
  workspace: Workspace | null;
  workspaces: Workspace[];
  loading: boolean;
  user: any | null;
  switchWorkspace: (id: string) => void;
  signOut: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user || null;
      setUser(u);
      
      if (u) {
        // Defer workspace loading to avoid auth deadlock
        setTimeout(async () => {
          const { data } = await supabase.from('workspaces').select('*');
          const ws = (data || []) as Workspace[];
          setWorkspaces(ws);
          if (ws.length > 0) {
            setWorkspace(prev => prev || ws[0]);
          }
          setLoading(false);
        }, 0);
      } else {
        setWorkspaces([]);
        setWorkspace(null);
        setLoading(false);
      }
    });

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const switchWorkspace = (id: string) => {
    const ws = workspaces.find(w => w.id === id);
    if (ws) setWorkspace(ws);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setWorkspace(null);
  };

  return (
    <WorkspaceContext.Provider value={{ workspace, workspaces, loading, user, switchWorkspace, signOut }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
