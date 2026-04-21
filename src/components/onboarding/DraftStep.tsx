import DraftPicker from "./DraftPicker";

interface Props {
  teamName: string;
  onFinish: () => void;
}

export default function DraftStep({ teamName, onFinish }: Props) {
  return <DraftPicker teamName={teamName} onFinish={onFinish} variant="onboarding" />;
}
