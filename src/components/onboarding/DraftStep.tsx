import DraftPicker from "./DraftPicker";

interface Props {
  teamName: string;
  onFinish: () => void;
  onBack?: () => void;
}

export default function DraftStep({ teamName, onFinish, onBack }: Props) {
  return <DraftPicker teamName={teamName} onFinish={onFinish} onBack={onBack} />;
}
