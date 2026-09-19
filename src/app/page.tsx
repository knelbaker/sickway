import Link from "next/link";
import { Button } from "@/components/ui/button";
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
          A synthetic workflow from student intake to a clinician brief and a
          returned patient packet. These screens are placeholders for the demo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button asChild>
          <Link href="/s">Student intake</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/hcp">Clinician workspace</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/packet/test">Example packet</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
