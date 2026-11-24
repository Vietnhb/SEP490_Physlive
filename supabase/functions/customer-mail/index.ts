import { handle } from "./core.ts";
Deno.serve((request:Request)=>handle(request,{
 bridgeSecret:Deno.env.get("PHYS_EMAIL_BRIDGE_SECRET")||"",
 resendKey:Deno.env.get("RESEND_API_KEY")||"",
 from:Deno.env.get("CUSTOMER_EMAIL_FROM")||"",
 replyDomain:Deno.env.get("CUSTOMER_EMAIL_REPLY_DOMAIN")||"",
}));
