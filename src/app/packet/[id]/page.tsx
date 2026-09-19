import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function PacketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Demo packet</h1>
        </CardTitle>
        <CardDescription>
          This is a placeholder. No packet has been loaded.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="break-all text-sm text-muted-foreground">
          Packet reference: {id}
        </p>
      </CardContent>
    </Card>
  );
}
