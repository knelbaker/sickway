import { PacketView } from "@/components/packet/packet-view";
import { SessionGate } from "@/components/session/session-gate";

export default async function PacketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // The session token lives in the browser, so the packet is fetched client-side with it.
  return (
    <SessionGate title="Demo packet">
      <PacketView packetId={id} />
    </SessionGate>
  );
}
