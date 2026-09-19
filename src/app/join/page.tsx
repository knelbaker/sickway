import { JoinSession } from "@/components/session/join-session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const { t } = await searchParams;
  const token = typeof t === "string" && t.length > 0 ? t : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Join demo session</h1>
        </CardTitle>
        <CardDescription>
          Pairs this device with a synthetic demo session started on another device.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <JoinSession token={token} />
      </CardContent>
    </Card>
  );
}
