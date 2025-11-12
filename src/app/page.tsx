// import { getQueryClient, trpc } from "@/trpc/server";
// import { Client } from "./client";
// import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
// import { Suspense } from "react";

// const Page = async () => {
//   const queryClient = getQueryClient();

//   void queryClient.prefetchQuery(trpc.getUsers.queryOptions());

//   return (
//     <div className="min-h-screen min-w-screen flex items-center justify-center">
//       <HydrationBoundary state={dehydrate(queryClient)}>
//         <Suspense fallback={<div>Loading...</div>}>
//           <Client />
//         </Suspense>
//       </HydrationBoundary>
//     </div>
//   );
// };

// export default Page;
"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/trpc/client";

import { useMutation } from "@tanstack/react-query";

const Page = () => {
  // const { data } = authClient.useSession();

  // await requireAuth();

  const trpc = useTRPC();
  const testAi = useMutation(trpc.testAI.mutationOptions());

  // const data = await caller.getUsers();
  return (
    <div className="min-h-screen min-w-screen flex items-center justify-center">
      {/* {JSON.stringify(data)}
      {data && <Button onClick={() => authClient.signOut()}>Logout</Button>} */}
      protected route
      <Button
        disabled={testAi.isPending}
        onClick={() => {
          testAi.mutate();
        }}
      >
        Test AI
      </Button>
      {testAi.data && JSON.stringify(testAi.data)}
    </div>
  );
};

export default Page;
