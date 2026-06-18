using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.RegularExpressions;
using System.Web.Http;
using Microsoft.Owin;
using Npgsql;
using Dapper;
using VitragCRM.Backend.Data;
using VitragCRM.Backend.Models;

namespace VitragCRM.Backend.Controllers
{
    public class ClientPortalController : ApiController
    {
        private string GetConnString() => DbConnectionFactory.GetConnectionString();

        private int? GetClientLeadId()
        {
            var owinContext = Request.GetOwinContext();
            return owinContext.Environment.ContainsKey("ClientLeadId") 
                ? (int?)owinContext.Environment["ClientLeadId"] 
                : null;
        }

        [HttpPost]
        [Route("api/client/login")]
        public IHttpActionResult ClientLogin([FromBody] Newtonsoft.Json.Linq.JObject body)
        {
            if (body == null || body["phone"] == null) 
                return BadRequest("Phone number is required.");

            string phone = body["phone"].ToString().Trim();
            string cleanPhone = Regex.Replace(phone, @"[^0-9]", "");

            if (string.IsNullOrEmpty(cleanPhone))
                return BadRequest("Invalid phone number.");

            try
            {
                using (var conn = new NpgsqlConnection(GetConnString()))
                {
                    conn.Open();
                    var leads = conn.Query<Lead>("SELECT * FROM leads WHERE deleted_at IS NULL").ToList();
                    
                    var lead = leads.FirstOrDefault(l =>
                    {
                        string lPhone = Regex.Replace(l.Phone ?? "", @"[^0-9]", "");
                        return !string.IsNullOrEmpty(lPhone) && 
                               (lPhone.Contains(cleanPhone) || cleanPhone.Contains(lPhone));
                    });

                    if (lead == null)
                    {
                        return ResponseMessage(Request.CreateResponse(HttpStatusCode.Unauthorized, new
                        {
                            error = "Authentication failed. Phone number not registered as an active lead."
                        }));
                    }

                    // Setup Response with HttpOnly session cookie
                    var response = Request.CreateResponse(HttpStatusCode.OK, new
                    {
                        success = true,
                        message = "Client authenticated successfully!",
                        lead = new
                        {
                            id = lead.Id,
                            name = lead.Name,
                            phone = lead.Phone,
                            stage = lead.Stage
                        }
                    });

                    var cookie = new CookieHeaderValue("client_session_id", lead.Id.ToString())
                    {
                        Path = "/",
                        MaxAge = TimeSpan.FromDays(30),
                        HttpOnly = true
                    };
                    response.Headers.AddCookies(new[] { cookie });

                    return ResponseMessage(response);
                }
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        [HttpGet]
        [Route("api/client/dashboard")]
        public IHttpActionResult GetClientDashboard()
        {
            int? leadId = GetClientLeadId();
            if (!leadId.HasValue)
            {
                return ResponseMessage(Request.CreateResponse(HttpStatusCode.Unauthorized, new
                {
                    error = "Unauthorized portal access. Please login."
                }));
            }

            try
            {
                using (var conn = new NpgsqlConnection(GetConnString()))
                {
                    conn.Open();

                    var lead = conn.QueryFirstOrDefault<Lead>(
                        "SELECT * FROM leads WHERE id = @leadId AND deleted_at IS NULL", 
                        new { leadId = leadId.Value }
                    );

                    if (lead == null)
                    {
                        return ResponseMessage(Request.CreateResponse(HttpStatusCode.NotFound, new
                        {
                            error = "Lead profile not found."
                        }));
                    }

                    // Fetch shortlisted properties via proposals
                    var proposalProps = conn.Query<Property>(@"
                        SELECT DISTINCT pr.* FROM properties pr
                        JOIN proposal_items pi ON pr.id = pi.property_id
                        JOIN proposals p ON pi.proposal_id = p.id
                        WHERE p.lead_id = @leadId", 
                        new { leadId = leadId.Value }
                    ).ToList();

                    // Fallback configuration match
                    List<Property> matchedProperties = proposalProps;
                    if (matchedProperties.Count == 0)
                    {
                        decimal budgetMax = lead.BudgetMax ?? 80000000;
                        matchedProperties = conn.Query<Property>(@"
                            SELECT * FROM properties 
                            WHERE price <= @budgetMax AND price_raw != '0' 
                            ORDER BY price DESC 
                            LIMIT 4", 
                            new { budgetMax }
                        ).ToList();
                    }

                    // Sanitize property fields (mask owners/contracts in client portal)
                    var sanitizedProps = matchedProperties.Select(pr => new
                    {
                        id = pr.Id,
                        prop_id = pr.PropId,
                        society = pr.Society,
                        location = pr.Location,
                        price_raw = pr.PriceRaw,
                        configuration = pr.Configuration,
                        area_sqft = pr.AreaSqft,
                        interiors = pr.Interiors,
                        facing = pr.Facing,
                        possession = pr.Possession,
                        amenities = pr.Amenities
                    }).ToList();

                    // Fetch advisor/client portal chat messages
                    var messages = conn.Query<ClientMessage>(@"
                        SELECT * FROM client_messages 
                        WHERE lead_id = @leadId 
                        ORDER BY id ASC", 
                        new { leadId = leadId.Value }
                    ).ToList();

                    return Ok(new
                    {
                        success = true,
                        lead = new
                        {
                            id = lead.Id,
                            name = lead.Name,
                            phone = lead.Phone,
                            stage = lead.Stage,
                            agent_name = lead.AgentName ?? "Vasu Jain"
                        },
                        properties = sanitizedProps,
                        messages = messages
                    });
                }
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        [HttpPost]
        [Route("api/client/messages")]
        public IHttpActionResult PostClientMessage([FromBody] Newtonsoft.Json.Linq.JObject body)
        {
            int? leadId = GetClientLeadId();
            if (!leadId.HasValue) return Unauthorized();

            if (body == null || body["message"] == null) 
                return BadRequest("Message content cannot be blank.");

            string message = body["message"].ToString().Trim();
            if (string.IsNullOrEmpty(message))
                return BadRequest("Message content cannot be blank.");

            try
            {
                using (var conn = new NpgsqlConnection(GetConnString()))
                {
                    conn.Open();

                    conn.Execute(@"
                        INSERT INTO client_messages (lead_id, sender, message, created_at)
                        VALUES (@leadId, 'client', @message, @createdAt)",
                        new { leadId = leadId.Value, message, createdAt = DateTime.UtcNow.ToString("o") }
                    );

                    // Log activity on timeline
                    conn.Execute(@"
                        INSERT INTO lead_activities (lead_id, type, description, timestamp)
                        VALUES (@leadId, 'Client', @desc, @timestamp)",
                        new
                        {
                            leadId = leadId.Value,
                            desc = $"Client sent portal message: \"{(message.Length > 30 ? message.Substring(0, 30) + "..." : message)}\"",
                            timestamp = DateTime.UtcNow.ToString("o")
                        }
                    );

                    return Ok(new { success = true });
                }
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }
    }
}
