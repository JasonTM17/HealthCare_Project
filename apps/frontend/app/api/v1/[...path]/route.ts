import { proxyHealthcareRequest } from "../../../../lib/server/healthcare-bff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface HealthcareApiRouteContext {
  params: Promise<{ path: string[] }>;
}

async function handle(request: Request, context: HealthcareApiRouteContext): Promise<Response> {
  const { path } = await context.params;
  return proxyHealthcareRequest(request, path);
}

export {
  handle as DELETE,
  handle as GET,
  handle as HEAD,
  handle as OPTIONS,
  handle as PATCH,
  handle as POST,
  handle as PUT,
};
