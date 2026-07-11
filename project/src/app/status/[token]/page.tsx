import Header from "@/app/components/Header";
import { getRequestStatus } from "@/lib/booking";
import StatusClient from "./StatusClient";

export const dynamic = "force-dynamic";

export default async function StatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { status } = await getRequestStatus(token);

  return (
    <>
      <Header />
      <StatusClient token={token} initialStatus={status} />
    </>
  );
}
