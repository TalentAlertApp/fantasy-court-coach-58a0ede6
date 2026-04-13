import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { TeamProvider } from "@/contexts/TeamContext";
import AppLayout from "@/components/layout/AppLayout";
import RosterPage from "@/pages/RosterPage";
import PlayersPage from "@/pages/PlayersPage";
import TeamsPage from "@/pages/TeamsPage";
import SchedulePage from "@/pages/SchedulePage";
import ScheduleGridPage from "@/pages/ScheduleGridPage";
import ScoringPage from "@/pages/ScoringPage";

import AIHubPage from "@/pages/AIHubPage";
import CommissionerPage from "@/pages/CommissionerPage";
import AdvancedPage from "@/pages/AdvancedPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 30_000,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <TeamProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<RosterPage />} />
              <Route path="/roster" element={<Navigate to="/" replace />} />
              <Route path="/scoring" element={<ScoringPage />} />
              <Route path="/transactions" element={<PlayersPage />} />
              <Route path="/players" element={<Navigate to="/transactions" replace />} />
              <Route path="/teams" element={<TeamsPage />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/schedule/grid" element={<ScheduleGridPage />} />
              <Route path="/advanced" element={<AdvancedPage />} />
              <Route path="/ai" element={<AIHubPage />} />
              <Route path="/commissioner" element={<CommissionerPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TeamProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
