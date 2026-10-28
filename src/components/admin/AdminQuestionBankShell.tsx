"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AdminSidebar, { AdminTab } from "@/components/admin/AdminSidebar";
import Header from "@/components/layout/Header";
import { LayoutDashboard, ChevronRight } from "lucide-react";

interface AdminQuestionBankShellProps {
  user: {
    username: string;
    displayName: string;
    roles: string[];
  };
  activeYear?: string | null;
  activeSemester?: string | null;
  subjectName: string;
  children: React.ReactNode;
}

export default function AdminQuestionBankShell({
  user,
  activeYear,
  activeSemester,
  subjectName,
  children,
}: AdminQuestionBankShellProps) {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleSelectTab = (tab: AdminTab) => {
    if (tab === "dashboard") {
      router.push("/admin");
    } else {
      router.push(`/admin?tab=${tab}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row">
      {/* Collapsible Sidebar */}
      <AdminSidebar
        activeTab="question_banks"
        onSelectTab={handleSelectTab}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <Header
          user={user}
          activeYear={activeYear}
          activeSemester={activeSemester}
          onToggleMobileMenu={() => setMobileSidebarOpen(true)}
          breadcrumb={
            <nav className="flex items-center gap-1.5 sm:gap-2 text-xs text-slate-500 overflow-hidden" aria-label="Breadcrumb">
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 text-slate-500 hover:text-[#0D274C] font-medium transition cursor-pointer shrink-0"
                title="Ke Dashboard"
              >
                <div className="w-6 h-6 rounded-md bg-slate-100 hover:bg-[#0D274C]/10 flex items-center justify-center text-slate-500 hover:text-[#0D274C] transition">
                  <LayoutDashboard className="w-3.5 h-3.5" />
                </div>
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              <span className="text-slate-500 font-medium whitespace-nowrap shrink-0">
                Data Ujian
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              <Link
                href="/admin?tab=question_banks"
                className="text-slate-500 hover:text-[#0D274C] font-medium whitespace-nowrap transition cursor-pointer shrink-0"
              >
                Bank Soal
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              <span className="font-bold text-[#0D274C] whitespace-nowrap truncate max-w-[140px] sm:max-w-xs md:max-w-none">
                {subjectName}
              </span>
            </nav>
          }
        />

        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
