import { errorJson, json } from "@/lib/http";
import { buildPacketView, getPacket } from "@/lib/packet";
import { packetViewSchema } from "@/lib/packet-view";
import { requireSession } from "@/lib/session";

/** The returned packet, only within its own paired session. Any other ID or session is a 404. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const packet = await getPacket(auth.session.id, id);
    if (!packet) return errorJson(404, "packet_not_found");
    return json(packetViewSchema.parse(buildPacketView(packet)));
  } catch {
    return errorJson(503, "packet_unavailable");
  }
}
