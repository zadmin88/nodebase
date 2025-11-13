import { requireAuth } from "@/lib/auth-utils";

interface PageProps {
  params: Promise<{ credenditalId: string }>;
}

const Page = async ({ params }: PageProps) => {
  await requireAuth();
  const { credenditalId } = await params;
  return <div>Credential Id: {credenditalId}</div>;
};

export default Page;
