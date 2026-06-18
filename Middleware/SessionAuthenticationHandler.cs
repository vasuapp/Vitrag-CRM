using System;
using System.IO;
using System.Security.Claims;
using System.Security.Principal;
using System.Threading.Tasks;
using Microsoft.Owin;
using Newtonsoft.Json;
using VitragCRM.Backend.Models;

namespace VitragCRM.Backend.Middleware
{
    public class SessionAuthenticationHandler : OwinMiddleware
    {
        public SessionAuthenticationHandler(OwinMiddleware next) : base(next)
        {
        }

        public override async Task Invoke(IOwinContext context)
        {
            // 1. Check x-agent-session header (used by CRM panel)
            string agentSessionHeader = context.Request.Headers["x-agent-session"];
            if (!string.IsNullOrWhiteSpace(agentSessionHeader))
            {
                try
                {
                    // Decode URL-encoded headers if needed, otherwise parse directly
                    string decodedHeader = Uri.UnescapeDataString(agentSessionHeader);
                    var agent = JsonConvert.DeserializeObject<Agent>(decodedHeader);
                    if (agent != null)
                    {
                        // Attach agent session object to OWIN environment
                        context.Environment["AgentSession"] = agent;

                        // Create Principal and set on Context
                        var identity = new GenericIdentity(agent.Name ?? "Agent");
                        identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, agent.Id.ToString()));
                        identity.AddClaim(new Claim(ClaimTypes.Email, agent.Email ?? ""));
                        identity.AddClaim(new Claim(ClaimTypes.Role, agent.Role ?? "Agent"));
                        
                        context.Request.User = new ClaimsPrincipal(identity);
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error deserializing x-agent-session header: {ex.Message}");
                }
            }

            // 2. Check client_session_id cookie (used by Client Portal)
            string cookieHeader = context.Request.Headers["Cookie"];
            if (!string.IsNullOrWhiteSpace(cookieHeader))
            {
                string clientSessionId = GetCookieValue(cookieHeader, "client_session_id");
                if (!string.IsNullOrWhiteSpace(clientSessionId) && int.TryParse(clientSessionId, out int leadId))
                {
                    context.Environment["ClientLeadId"] = leadId;
                }
            }

            await Next.Invoke(context);
        }

        private string GetCookieValue(string cookieHeader, string cookieName)
        {
            var cookies = cookieHeader.Split(';');
            foreach (var cookie in cookies)
            {
                var parts = cookie.Trim().Split('=');
                if (parts.Length == 2 && parts[0].Trim().Equals(cookieName, StringComparison.OrdinalIgnoreCase))
                {
                    return parts[1].Trim();
                }
            }
            return null;
        }
    }
}
