import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import RosterPage from "@/pages/RosterPage";
import PlayersPage from "@/pages/PlayersPage";
import TransactionsPage from "@/pages/TransactionsPage";
import SchedulePage from "@/pages/SchedulePage";
import StatsPage from "@/pages/StatsPage";
import AIHubPage from "@/pages/AIHubPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<RosterPage />} />
            <Route path="/roster" element={<RosterPage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/ai" element={<AIHubPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
