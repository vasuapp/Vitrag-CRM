using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web.Http;
using Microsoft.Owin;
using Npgsql;
using Dapper;
using VitragCRM.Backend.Data;
using VitragCRM.Backend.Models;
using VitragCRM.Backend.Filters;

namespace VitragCRM.Backend.Controllers
{
    [EmployeeMasking]
    public class LeadsController : ApiController
    {
        private string GetConnString() => DbConnectionFactory.GetConnectionString();

        private Agent GetAgent()
        {
            var owinContext = Request.GetOwinContext();
            return owinContext.Environment.ContainsKey("AgentSession") 
                ? owinContext.Environment["AgentSession"] as Agent 
                : null;
        }

        [HttpGet]
        [Route("api/leads")]
        public IHttpActionResult GetLeads(
            [FromUri] string search = null, 
            [FromUri] string stage = null, 
            [FromUri] string status = null, 
            [FromUri] int? agent_id = null)
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                string sql = "SELECT * FROM leads WHERE deleted_at IS NULL";
                var paramsObj = new DynamicParameters();

                // Apply RBAC filters if the logged-in agent is an Employee
                var currentAgent = GetAgent();
                if (currentAgent != null && currentAgent.Role.Equals("Employee", StringComparison.OrdinalIgnoreCase))
                {
                    sql += " AND agent_id = @currentAgentId";
                    paramsObj.Add("currentAgentId", currentAgent.Id);
                }

                if (!string.IsNullOrEmpty(search))
                {
                    sql += " AND (name ILIKE @search OR phone ILIKE @search OR email ILIKE @search OR special_tags ILIKE @search OR custom_lead_id ILIKE @search)";
                    paramsObj.Add("search", $"%{search}%");
                }
                if (!string.IsNullOrEmpty(stage))
                {
                    sql += " AND stage = @stage";
                    paramsObj.Add("stage", stage);
                }
                if (!string.IsNullOrEmpty(status))
                {
                    sql += " AND status = @status";
                    paramsObj.Add("status", status);
                }
                if (agent_id.HasValue)
                {
                    sql += " AND agent_id = @agent_id";
                    paramsObj.Add("agent_id", agent_id.Value);
                }

                sql += " ORDER BY id DESC";

                var leads = conn.Query<Lead>(sql, paramsObj).ToList();
                return Ok(leads);
            }
        }

        [HttpGet]
        [Route("api/leads/{id}")]
        public IHttpActionResult GetLead(int id)
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var lead = conn.QueryFirstOrDefault<Lead>("SELECT * FROM leads WHERE id = @id AND deleted_at IS NULL", new { id });
                if (lead == null) return NotFound();

                var currentAgent = GetAgent();
                if (currentAgent != null && currentAgent.Role.Equals("Employee", StringComparison.OrdinalIgnoreCase) && lead.AgentId != currentAgent.Id)
                {
                    return Unauthorized();
                }

                return Ok(lead);
            }
        }

        [HttpPost]
        [Route("api/leads")]
        public IHttpActionResult CreateLead(Lead lead)
        {
            if (lead == null) return BadRequest("Lead data is empty.");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();

                // Check for duplicates
                string cleanPhone = System.Text.RegularExpressions.Regex.Replace(lead.Phone ?? "", @"[^0-9]", "");
                if (!string.IsNullOrEmpty(cleanPhone))
                {
                    var existing = conn.QueryFirstOrDefault<Lead>(
                        "SELECT * FROM leads WHERE phone = @Phone AND deleted_at IS NULL LIMIT 1",
                        new { Phone = lead.Phone }
                    );

                    if (existing != null)
                    {
                        // Log duplicate audit
                        conn.Execute(@"
                            INSERT INTO duplicate_leads_audit (lead_name, phone, email, source, existing_lead_id, existing_lead_name, detected_at, action_taken)
                            VALUES (@Name, @Phone, @Email, @Source, @ExistingId, @ExistingName, @DetectedAt, 'Pending Review')",
                            new
                            {
                                Name = lead.Name,
                                Phone = lead.Phone,
                                Email = lead.Email,
                                Source = lead.Source ?? "API Inbound",
                                ExistingId = existing.Id,
                                ExistingName = existing.Name,
                                DetectedAt = DateTime.UtcNow.ToString("o")
                            });

                        return BadRequest("Duplicate lead detected based on phone number.");
                    }
                }

                // If agent_id not provided, assign automatically (Round Robin fallback)
                var currentAgent = GetAgent();
                if (!lead.AgentId.HasValue && currentAgent != null)
                {
                    lead.AgentId = currentAgent.Id;
                    lead.AgentName = currentAgent.Name;
                }

                string sql = @"
                    INSERT INTO leads (name, phone, email, source, status, stage, project_type, budget_min, budget_max, notes, next_followup, followup_status, touchpoint, associate_id, created_at, agent_id, agent_name, special_tags, documents, location_preference, config_bhk, timeline_preference, rental_expiry_date, lead_score, admin_comments, property_requirement)
                    VALUES (@Name, @Phone, @Email, @Source, @Status, @Stage, @ProjectType, @BudgetMin, @BudgetMax, @Notes, @NextFollowup, @FollowupStatus, @Touchpoint, @AssociateId, @CreatedAt, @AgentId, @AgentName, @SpecialTags, @Documents, @LocationPreference, @ConfigBhk, @TimelinePreference, @RentalExpiryDate, @LeadScore, @AdminComments, @PropertyRequirement)
                    RETURNING id;";

                lead.CreatedAt = DateTime.UtcNow.ToString("o");
                lead.Stage = string.IsNullOrEmpty(lead.Stage) ? "Raw Lead" : lead.Stage;
                lead.Status = string.IsNullOrEmpty(lead.Status) ? "WARM" : lead.Status;
                lead.Touchpoint = string.IsNullOrEmpty(lead.Touchpoint) ? "Calls" : lead.Touchpoint;
                lead.LeadScore = 15;

                int insertedId = conn.ExecuteScalar<int>(sql, lead);
                string customLeadId = $"LD-{1000 + insertedId}";
                
                conn.Execute("UPDATE leads SET custom_lead_id = @customLeadId WHERE id = @insertedId", new { customLeadId, insertedId });

                // Log activity
                conn.Execute(@"
                    INSERT INTO lead_activities (lead_id, type, description, timestamp)
                    VALUES (@insertedId, 'System', 'Lead profile auto-registered.', @Timestamp)",
                    new { insertedId, Timestamp = DateTime.UtcNow.ToString("o") });

                lead.Id = insertedId;
                lead.CustomLeadId = customLeadId;
                return Ok(lead);
            }
        }

        [HttpPut]
        [Route("api/leads/{id}")]
        public IHttpActionResult UpdateLead(int id, Lead lead)
        {
            if (lead == null) return BadRequest("Lead data is empty.");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var existing = conn.QueryFirstOrDefault<Lead>("SELECT * FROM leads WHERE id = @id AND deleted_at IS NULL", new { id });
                if (existing == null) return NotFound();

                var currentAgent = GetAgent();
                if (currentAgent != null && currentAgent.Role.Equals("Employee", StringComparison.OrdinalIgnoreCase) && existing.AgentId != currentAgent.Id)
                {
                    return Unauthorized();
                }

                string sql = @"
                    UPDATE leads 
                    SET name = @Name, phone = @Phone, email = @Email, source = @Source, status = @Status, stage = @Stage, 
                        project_type = @ProjectType, budget_min = @BudgetMin, budget_max = @BudgetMax, notes = @Notes, 
                        next_followup = @NextFollowup, followup_status = @FollowupStatus, touchpoint = @Touchpoint, 
                        associate_id = @AssociateId, agent_id = @AgentId, agent_name = @AgentName, special_tags = @SpecialTags, 
                        documents = @Documents, location_preference = @LocationPreference, config_bhk = @ConfigBhk, 
                        timeline_preference = @TimelinePreference, rental_expiry_date = @RentalExpiryDate, 
                        lead_score = @LeadScore, admin_comments = @AdminComments, property_requirement = @PropertyRequirement
                    WHERE id = @Id;";

                lead.Id = id;
                conn.Execute(sql, lead);

                return Ok(new { success = true, message = "Lead updated successfully." });
            }
        }

        [HttpDelete]
        [Route("api/leads/{id}")]
        public IHttpActionResult DeleteLead(int id)
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var existing = conn.QueryFirstOrDefault<Lead>("SELECT * FROM leads WHERE id = @id AND deleted_at IS NULL", new { id });
                if (existing == null) return NotFound();

                var currentAgent = GetAgent();
                if (currentAgent != null && currentAgent.Role.Equals("Employee", StringComparison.OrdinalIgnoreCase) && existing.AgentId != currentAgent.Id)
                {
                    return Unauthorized();
                }

                conn.Execute("UPDATE leads SET deleted_at = @DeletedAt WHERE id = @id", new { DeletedAt = DateTime.UtcNow.ToString("o"), id });
                return Ok(new { success = true, message = "Lead deleted successfully." });
            }
        }

        [HttpPatch]
        [Route("api/leads/{id}/stage")]
        public IHttpActionResult PatchStage(int id, [FromBody] Newtonsoft.Json.Linq.JObject body)
        {
            if (body == null || body["stage"] == null) return BadRequest("Missing stage parameter.");
            string newStage = body["stage"].ToString();

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var existing = conn.QueryFirstOrDefault<Lead>("SELECT * FROM leads WHERE id = @id AND deleted_at IS NULL", new { id });
                if (existing == null) return NotFound();

                conn.Execute("UPDATE leads SET stage = @newStage WHERE id = @id", new { newStage, id });

                // Log to timeline
                conn.Execute(@"
                    INSERT INTO lead_timeline (lead_id, event_type, event_description, created_at)
                    VALUES (@id, 'STAGE_CHANGE', @Desc, @CreatedAt)",
                    new { id, Desc = $"Lead stage updated from '{existing.Stage}' to '{newStage}'.", CreatedAt = DateTime.UtcNow.ToString("o") });

                return Ok(new { success = true, stage = newStage });
            }
        }

        [HttpPatch]
        [Route("api/leads/{id}/closure")]
        public IHttpActionResult PatchClosure(int id, Lead closureData)
        {
            if (closureData == null) return BadRequest("Missing closure data.");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var existing = conn.QueryFirstOrDefault<Lead>("SELECT * FROM leads WHERE id = @id AND deleted_at IS NULL", new { id });
                if (existing == null) return NotFound();

                string sql = @"
                    UPDATE leads 
                    SET closure_site_visit = @ClosureSiteVisit, closure_negotiation = @ClosureNegotiation, 
                        closure_agreement = @ClosureAgreement, closure_registration = @ClosureRegistration, 
                        closure_closed = @ClosureClosed, closure_prop_id = @ClosurePropId, 
                        closure_commission_amt = @ClosureCommissionAmt, closure_notes = @ClosureNotes, 
                        closure_joint_visit = @ClosureJointVisit
                    WHERE id = @Id;";

                closureData.Id = id;
                conn.Execute(sql, closureData);

                // Add timeline event
                conn.Execute(@"
                    INSERT INTO lead_timeline (lead_id, event_type, event_description, created_at)
                    VALUES (@id, 'SYSTEM', 'Lead transaction milestones updated.', @CreatedAt)",
                    new { id, CreatedAt = DateTime.UtcNow.ToString("o") });

                return Ok(new { success = true, message = "Lead closure milestones updated." });
            }
        }

        [HttpGet]
        [Route("api/leads/{id}/activities")]
        public IHttpActionResult GetActivities(int id)
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var activities = conn.Query<LeadActivity>(
                    "SELECT * FROM lead_activities WHERE lead_id = @id ORDER BY id DESC",
                    new { id }
                ).ToList();
                return Ok(activities);
            }
        }

        [HttpPost]
        [Route("api/leads/{id}/activities")]
        public IHttpActionResult CreateActivity(int id, LeadActivity activity)
        {
            if (activity == null) return BadRequest("Missing activity details.");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                activity.LeadId = id;
                activity.Timestamp = DateTime.UtcNow.ToString("o");

                conn.Execute(@"
                    INSERT INTO lead_activities (lead_id, type, description, timestamp)
                    VALUES (@LeadId, @Type, @Description, @Timestamp)",
                    activity);

                return Ok(new { success = true });
            }
        }

        [HttpGet]
        [Route("api/leads/{id}/timeline")]
        public IHttpActionResult GetTimeline(int id)
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var timeline = conn.Query<LeadTimeline>(
                    "SELECT * FROM lead_timeline WHERE lead_id = @id ORDER BY id DESC",
                    new { id }
                ).ToList();
                return Ok(timeline);
            }
        }

        [HttpGet]
        [Route("api/leads/{id}/scorecard")]
        public IHttpActionResult GetScorecard(int id)
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var scorecard = conn.QueryFirstOrDefault<LeadScorecard>(
                    "SELECT * FROM lead_scorecards WHERE lead_id = @id",
                    new { id }
                );

                if (scorecard == null)
                {
                    // Return default scorecard
                    scorecard = new LeadScorecard { LeadId = id };
                }

                return Ok(scorecard);
            }
        }

        [HttpPut]
        [Route("api/leads/{id}/scorecard")]
        public IHttpActionResult UpdateScorecard(int id, LeadScorecard scorecard)
        {
            if (scorecard == null) return BadRequest("Missing scorecard data.");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                scorecard.LeadId = id;
                scorecard.UpdatedAt = DateTime.UtcNow.ToString("o");

                string checkSql = "SELECT COUNT(*) FROM lead_scorecards WHERE lead_id = @id";
                int exists = conn.ExecuteScalar<int>(checkSql, new { id });

                if (exists > 0)
                {
                    conn.Execute(@"
                        UPDATE lead_scorecards 
                        SET budget = @Budget, timeline = @Timeline, funding = @Funding, 
                            responsiveness = @Responsiveness, clarity = @Clarity, updated_at = @UpdatedAt
                        WHERE lead_id = @LeadId",
                        scorecard);
                }
                else
                {
                    conn.Execute(@"
                        INSERT INTO lead_scorecards (lead_id, budget, timeline, funding, responsiveness, clarity, updated_at)
                        VALUES (@LeadId, @Budget, @Timeline, @Funding, @Responsiveness, @Clarity, @UpdatedAt)",
                        scorecard);
                }

                // Update lead score in leads table dynamically
                int newLeadScore = (scorecard.Budget + scorecard.Timeline + scorecard.Funding + scorecard.Responsiveness + scorecard.Clarity) * 4;
                conn.Execute("UPDATE leads SET lead_score = @newLeadScore WHERE id = @id", new { newLeadScore, id });

                return Ok(new { success = true, leadScore = newLeadScore });
            }
        }

        [HttpGet]
        [Route("api/leads/{id}/interactions")]
        public IHttpActionResult GetInteractions(int id)
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var logs = conn.Query<InteractionLog>(
                    "SELECT * FROM interaction_logs WHERE lead_id = @id ORDER BY id DESC",
                    new { id }
                ).ToList();
                return Ok(logs);
            }
        }

        [HttpPost]
        [Route("api/leads/{id}/interactions")]
        public IHttpActionResult CreateInteraction(int id, InteractionLog log)
        {
            if (log == null) return BadRequest("Missing interaction details.");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                log.LeadId = id;
                log.CreatedAt = DateTime.UtcNow.ToString("o");

                conn.Execute(@"
                    INSERT INTO interaction_logs (lead_id, interaction_type, notes, created_at)
                    VALUES (@LeadId, @InteractionType, @Notes, @CreatedAt)",
                    log);

                return Ok(new { success = true });
            }
        }

        [HttpGet]
        [Route("api/leads/{id}/matches")]
        public IHttpActionResult GetMatches(int id)
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var lead = conn.QueryFirstOrDefault<Lead>("SELECT * FROM leads WHERE id = @id AND deleted_at IS NULL", new { id });
                if (lead == null) return NotFound();

                // Match algorithm: configuration, budget, location preferences
                decimal maxBudget = lead.BudgetMax ?? 1000000000;
                string query = @"
                    SELECT * FROM properties 
                    WHERE deleted_at IS NULL AND status = 'AVAILABLE' AND price <= @maxBudget";

                var matches = conn.Query<Property>(query, new { maxBudget }).ToList();

                // Perform scoring and sorting in-memory based on location and bhk config matching
                var scored = matches.Select(p => {
                    int score = 0;
                    if (!string.IsNullOrEmpty(lead.ConfigBhk) && !string.IsNullOrEmpty(p.Configuration) && p.Configuration.Contains(lead.ConfigBhk.Substring(0, 1)))
                        score += 50;
                    if (!string.IsNullOrEmpty(lead.LocationPreference) && !string.IsNullOrEmpty(p.Location) && p.Location.IndexOf(lead.LocationPreference, StringComparison.OrdinalIgnoreCase) >= 0)
                        score += 30;
                    return new { Property = p, Score = score };
                })
                .OrderByDescending(x => x.Score)
                .Select(x => x.Property)
                .Take(10)
                .ToList();

                return Ok(scored);
            }
        }
    }
}
