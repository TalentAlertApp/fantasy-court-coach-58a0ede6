import DraftPicker from "./DraftPicker";
import type { CompetitionCode } from "@/lib/competitions";

interface Props {
  teamName: string;
  leagueCode?: CompetitionCode;
  onFinish: () => void;
  onBack?: () => void;
}

export default function DraftStep({ teamName, leagueCode, onFinish, onBack }: Props) {
  return <DraftPicker teamName={teamName} leagueCode={leagueCode} onFinish={onFinish} onBack={onBack} />;
}
