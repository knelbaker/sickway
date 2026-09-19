import { SessionPanel } from "@/components/session/session-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Sick Day + Doorway</h1>
        </CardTitle>
        <CardDescription>
          A synthetic workflow from student intake to a clinician brief and a returned patient
          packet. Open the student screen on a phone and the clinician screen on a laptop in the
          same demo session.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SessionPanel />
      </CardContent>
    </Card>
  );
}
