CREATE INDEX IF NOT EXISTS idx_transactions_team_created
  ON public.transactions (team_id, created_at DESC);