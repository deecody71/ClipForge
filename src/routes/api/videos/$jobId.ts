import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/videos/$jobId")({
  component: ApiVideosRoute,
});

function ApiVideosRoute() {
  return null;
}
