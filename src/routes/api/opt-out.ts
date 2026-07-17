import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const handleOptOut = createServerFn({ method: "GET" })
  .validator((data: unknown) => {
    const d = data as { phone?: string };
    return { phone: d.phone || "" };
  })
  .handler(async ({ data }) => {
    const { processOptOut } = await import("~/services/sms-service");

    if (!data.phone || data.phone.trim().length < 10) {
      return `
        <html><head><title>Unsubscribe</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;">
          <div style="text-align:center;padding:2rem;">
            <h1 style="color:#dc2626;">Invalid Request</h1>
            <p style="color:#6b7280;">Please provide a valid phone number to unsubscribe.</p>
          </div>
        </body></html>`;
    }

    try {
      const count = await processOptOut(data.phone.trim());
      const message = count > 0
        ? "You have been unsubscribed from all future SMS messages."
        : "This number was not found in our system, but no further messages will be sent.";

      return `
        <html><head><title>Unsubscribed</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;">
          <div style="text-align:center;padding:2rem;max-width:400px;">
            <div style="font-size:3rem;margin-bottom:1rem;">✅</div>
            <h1 style="color:#111827;margin-bottom:0.5rem;">Unsubscribed</h1>
            <p style="color:#6b7280;line-height:1.5;">${message}</p>
          </div>
        </body></html>`;
    } catch (err) {
      console.error("[opt-out] Error processing opt-out:", err);
      return `
        <html><head><title>Error</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;">
          <div style="text-align:center;padding:2rem;">
            <h1 style="color:#dc2626;">Something went wrong</h1>
            <p style="color:#6b7280;">Please try again or contact support.</p>
          </div>
        </body></html>`;
    }
  });

export const Route = createFileRoute("/api/opt-out")({
  component: OptOutRoute,
});

function OptOutRoute() {
  return null;
}

export { handleOptOut };
