'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface AdminSidebarContextType {
  collapsed: boolean;
  setCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  setMobileOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  toggleMobileOpen: () => void;
}

const AdminSidebarContext = createContext<AdminSidebarContextType | undefined>(undefined);

export function AdminSidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('admin_sidebar_collapsed');
    if (saved !== null) {
      setCollapsedState(saved === 'true');
    }
  }, []);

  const setCollapsed = (value: boolean | ((prev: boolean) => boolean)) => {
    setCollapsedState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      if (typeof window !== 'undefined') {
        localStorage.setItem('admin_sidebar_collapsed', String(next));
      }
      return next;
    });
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => !prev);
  };

  const toggleMobileOpen = () => {
    setMobileOpen((prev) => !prev);
  };

  return (
    <AdminSidebarContext.Provider
      value={{
        collapsed: mounted ? collapsed : false,
        setCollapsed,
        toggleCollapsed,
        mobileOpen,
        setMobileOpen,
        toggleMobileOpen,
      }}
    >
      {children}
    </AdminSidebarContext.Provider>
  );
}

export function useAdminSidebar() {
  const context = useContext(AdminSidebarContext);
  if (!context) {
    throw new Error('useAdminSidebar must be used within an AdminSidebarProvider');
  }
  return context;
}
