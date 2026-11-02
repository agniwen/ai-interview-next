import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

function Home() {
  return (
    <div className="flex flex-col gap-4 p-8">
      <h1 className="font-heading text-4xl font-bold">Welcome to TanStack Start</h1>
      <p className="text-lg text-muted-foreground">
        Edit <code>src/routes/index.tsx</code> to get started.
      </p>
      <Button className="self-start">Get started</Button>
    </div>
  );
}

export const Route = createFileRoute("/")({ component: Home });
