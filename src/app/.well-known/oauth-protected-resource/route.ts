import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";
import { supabaseIssuer } from "@/modules/crm/server/mcp-auth";

// RFC 9728 metadata: tells MCP clients that Supabase Auth issues the tokens.
export function GET(request: Request) {
  return protectedResourceHandler({ authServerUrls: [supabaseIssuer()] })(
    request,
  );
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
