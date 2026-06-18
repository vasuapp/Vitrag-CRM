using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Web.Http;
using Npgsql;
using Dapper;
using Newtonsoft.Json;
using VitragCRM.Backend.Data;
using VitragCRM.Backend.Models;

namespace VitragCRM.Backend.Controllers
{
    public class OperationsController : ApiController
    {
        private string GetConnString() => DbConnectionFactory.GetConnectionString();

        // ==========================================
        // 1. SOPs & Templates Endpoints
        // ==========================================
        [HttpGet]
        [Route("api/sops")]
        public IHttpActionResult GetSops()
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var sops = conn.Query<Sop>("SELECT * FROM sops ORDER BY id ASC").ToList();
                return Ok(sops);
            }
        }

        [HttpPost]
        [Route("api/sops")]
        public IHttpActionResult CreateSop([FromBody] Newtonsoft.Json.Linq.JObject body)
        {
            if (body == null || body["title"] == null || body["steps"] == null)
                return BadRequest("Missing required title/steps parameters.");

            string title = body["title"].ToString();
            string stepsJson = JsonConvert.SerializeObject(body["steps"]);

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                conn.Execute(
                    "INSERT INTO sops (title, steps, created_at) VALUES (@title, @steps, @createdAt)",
                    new { title, steps = stepsJson, createdAt = DateTime.UtcNow.ToString("o") }
                );
                return Ok(new { success = true });
            }
        }

        [HttpPost]
        [Route("api/sops/reset")]
        public IHttpActionResult ResetSops()
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                DbInitializer.SeedDefaultSops(conn);
                return Ok(new { success = true, message = "SOPs reset to default stack." });
            }
        }

        [HttpGet]
        [Route("api/templates")]
        public IHttpActionResult GetTemplates()
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var templates = conn.Query<CommunicationTemplate>("SELECT * FROM communication_templates ORDER BY id ASC").ToList();
                return Ok(templates);
            }
        }

        [HttpPost]
        [Route("api/templates")]
        public IHttpActionResult CreateTemplate(CommunicationTemplate template)
        {
            if (template == null) return BadRequest("Template details missing.");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                template.CreatedAt = DateTime.UtcNow.ToString("o");
                string sql = @"
                    INSERT INTO communication_templates (name, platform, use_case, content, created_at)
                    VALUES (@Name, @Platform, @UseCase, @Content, @CreatedAt)
                    RETURNING id;";
                
                int insertedId = conn.ExecuteScalar<int>(sql, template);
                template.Id = insertedId;
                return Ok(template);
            }
        }

        // ==========================================
        // 2. Agents / Roster / Attendance Endpoints
        // ==========================================
        [HttpGet]
        [Route("api/agents")]
        [Route("api/team")]
        [Route("api/team/profiles")]
        public IHttpActionResult GetTeam()
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var agents = conn.Query<Agent>("SELECT * FROM agents ORDER BY id ASC").ToList();
                return Ok(agents);
            }
        }

        [HttpPost]
        [Route("api/agents")]
        public IHttpActionResult CreateAgent(Agent agent)
        {
            if (agent == null) return BadRequest("Agent data missing.");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                string sql = @"
                    INSERT INTO agents (name, email, phone, status, location_specialty, role, login_pin, allowed_pages, performance_rating)
                    VALUES (@Name, @Email, @Phone, @Status, @LocationSpecialty, @Role, @LoginPin, @AllowedPages, @PerformanceRating)
                    RETURNING id;";
                
                int insertedId = conn.ExecuteScalar<int>(sql, agent);
                agent.Id = insertedId;
                return Ok(agent);
            }
        }

        [HttpGet]
        [Route("api/attendance/logs")]
        public IHttpActionResult GetAttendanceLogs()
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var logs = conn.Query<AttendanceLog>("SELECT * FROM attendance_logs ORDER BY id DESC").ToList();
                return Ok(logs);
            }
        }

        [HttpPost]
        [Route("api/attendance/clock-in")]
        public IHttpActionResult ClockIn([FromBody] Newtonsoft.Json.Linq.JObject body)
        {
            if (body == null || body["agentId"] == null || body["agentName"] == null)
                return BadRequest("Missing required agentId/agentName.");

            int agentId = (int)body["agentId"];
            string agentName = body["agentName"].ToString();
            string dateStr = DateTime.UtcNow.ToString("yyyy-MM-dd");
            string timeStr = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                conn.Execute(@"
                    INSERT INTO attendance_logs (agent_id, agent_name, clock_in, attendance_date)
                    VALUES (@agentId, @agentName, @timeStr, @dateStr)",
                    new { agentId, agentName, timeStr, dateStr });

                return Ok(new { success = true, clockIn = timeStr });
            }
        }

        [HttpPost]
        [Route("api/attendance/clock-out")]
        public IHttpActionResult ClockOut([FromBody] Newtonsoft.Json.Linq.JObject body)
        {
            if (body == null || body["agentId"] == null)
                return BadRequest("Missing required agentId.");

            int agentId = (int)body["agentId"];
            string dateStr = DateTime.UtcNow.ToString("yyyy-MM-dd");
            string timeStr = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                conn.Execute(@"
                    UPDATE attendance_logs 
                    SET clock_out = @timeStr 
                    WHERE agent_id = @agentId AND attendance_date = @dateStr AND clock_out IS NULL",
                    new { agentId, timeStr, dateStr });

                return Ok(new { success = true, clockOut = timeStr });
            }
        }

        // ==========================================
        // 3. Checklist, Tasks & Habits
        // ==========================================
        [HttpGet]
        [Route("api/daily/checklist")]
        public IHttpActionResult GetChecklist([FromUri] string date = null)
        {
            string searchDate = date ?? DateTime.UtcNow.ToString("yyyy-MM-dd");
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var items = conn.Query<DailyChecklistItem>(
                    "SELECT * FROM daily_checklist WHERE routine_date = @searchDate",
                    new { searchDate }
                ).ToList();
                return Ok(items);
            }
        }

        [HttpPost]
        [Route("api/daily/checklist")]
        public IHttpActionResult CreateChecklistItem(DailyChecklistItem item)
        {
            if (item == null) return BadRequest("Checklist item data is missing.");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                if (string.IsNullOrEmpty(item.RoutineDate))
                {
                    item.RoutineDate = DateTime.UtcNow.ToString("yyyy-MM-dd");
                }

                string sql = @"
                    INSERT INTO daily_checklist (item_name, routine_type, is_checked, routine_date)
                    VALUES (@ItemName, @RoutineType, @IsChecked, @RoutineDate)
                    RETURNING id;";

                int insertedId = conn.ExecuteScalar<int>(sql, item);
                item.Id = insertedId;
                return Ok(item);
            }
        }

        [HttpPut]
        [Route("api/daily/checklist/{id}")]
        public IHttpActionResult UpdateChecklistItem(int id, DailyChecklistItem item)
        {
            if (item == null) return BadRequest("Checklist item data is missing.");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                string sql = @"
                    UPDATE daily_checklist 
                    SET is_checked = @IsChecked 
                    WHERE id = @Id;";

                conn.Execute(sql, new { IsChecked = item.IsChecked, Id = id });
                return Ok(new { success = true });
            }
        }

        [HttpGet]
        [Route("api/dashboard/todo")]
        public IHttpActionResult GetTodoTasks()
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var tasks = conn.Query<TodoTask>("SELECT * FROM todo_tasks ORDER BY id DESC").ToList();
                return Ok(tasks);
            }
        }

        [HttpPost]
        [Route("api/dashboard/todo")]
        public IHttpActionResult CreateTodoTask(TodoTask task)
        {
            if (task == null) return BadRequest("Task details missing.");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                task.Status = string.IsNullOrEmpty(task.Status) ? "Incomplete" : task.Status;
                task.Priority = string.IsNullOrEmpty(task.Priority) ? "Medium" : task.Priority;

                string sql = @"
                    INSERT INTO todo_tasks (task, status, due_date, priority)
                    VALUES (@Task, @Status, @DueDate, @Priority)
                    RETURNING id;";

                int insertedId = conn.ExecuteScalar<int>(sql, task);
                task.Id = insertedId;
                return Ok(task);
            }
        }

        [HttpPut]
        [Route("api/dashboard/todo/{id}")]
        public IHttpActionResult UpdateTodoTask(int id, TodoTask task)
        {
            if (task == null) return BadRequest("Task details missing.");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                string sql = @"
                    UPDATE todo_tasks 
                    SET task = @Task, status = @Status, due_date = @DueDate, priority = @Priority 
                    WHERE id = @Id;";

                task.Id = id;
                conn.Execute(sql, task);
                return Ok(new { success = true });
            }
        }

        [HttpGet]
        [Route("api/dashboard/scratchpad")]
        public IHttpActionResult GetScratchpad()
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var pad = conn.QueryFirstOrDefault<Scratchpad>(
                    "SELECT * FROM scratchpad ORDER BY id DESC LIMIT 1"
                );
                return Ok(pad ?? new Scratchpad { Content = "" });
            }
        }

        [HttpPost]
        [Route("api/dashboard/scratchpad")]
        public IHttpActionResult SaveScratchpad([FromBody] Newtonsoft.Json.Linq.JObject body)
        {
            if (body == null || body["content"] == null) return BadRequest("Missing content.");
            string content = body["content"].ToString();

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                int exists = conn.ExecuteScalar<int>("SELECT COUNT(*) FROM scratchpad");
                
                string timeStr = DateTime.UtcNow.ToString("o");
                if (exists > 0)
                {
                    conn.Execute(
                        "UPDATE scratchpad SET content = @content, updated_at = @timeStr",
                        new { content, timeStr }
                    );
                }
                else
                {
                    conn.Execute(
                        "INSERT INTO scratchpad (content, updated_at) VALUES (@content, @timeStr)",
                        new { content, timeStr }
                    );
                }
                return Ok(new { success = true });
            }
        }

        [HttpGet]
        [Route("api/habits")]
        public IHttpActionResult GetHabits([FromUri] string date = null)
        {
            string searchDate = date ?? DateTime.UtcNow.ToString("yyyy-MM-dd");
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var habits = conn.Query<Habit>(
                    "SELECT * FROM habits WHERE habit_date = @searchDate ORDER BY id ASC",
                    new { searchDate }
                ).ToList();
                return Ok(habits);
            }
        }

        [HttpPost]
        [Route("api/habits")]
        public IHttpActionResult CreateHabit(Habit habit)
        {
            if (habit == null) return BadRequest("Habit data missing.");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                if (string.IsNullOrEmpty(habit.HabitDate))
                {
                    habit.HabitDate = DateTime.UtcNow.ToString("yyyy-MM-dd");
                }

                string sql = @"
                    INSERT INTO habits (habit_name, habit_date, is_done, agent_id)
                    VALUES (@HabitName, @HabitDate, @IsDone, @AgentId)
                    RETURNING id;";

                int insertedId = conn.ExecuteScalar<int>(sql, habit);
                habit.Id = insertedId;
                return Ok(habit);
            }
        }

        [HttpPut]
        [Route("api/habits/{id}")]
        public IHttpActionResult UpdateHabit(int id, Habit habit)
        {
            if (habit == null) return BadRequest("Habit data missing.");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                conn.Execute(
                    "UPDATE habits SET is_done = @IsDone WHERE id = @Id",
                    new { IsDone = habit.IsDone, Id = id }
                );
                return Ok(new { success = true });
            }
        }

        // ==========================================
        // 4. Invoices
        // ==========================================
        [HttpGet]
        [Route("api/invoices")]
        public IHttpActionResult GetInvoices()
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var invoices = conn.Query<Invoice>("SELECT * FROM invoices ORDER BY id DESC").ToList();
                return Ok(invoices);
            }
        }

        [HttpPost]
        [Route("api/invoices")]
        public IHttpActionResult CreateInvoice(Invoice invoice)
        {
            if (invoice == null) return BadRequest("Invoice details missing.");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                invoice.CreatedAt = DateTime.UtcNow.ToString("o");
                invoice.PaymentStatus = string.IsNullOrEmpty(invoice.PaymentStatus) ? "Pending" : invoice.PaymentStatus;

                // Calculate totals
                decimal amt = invoice.Amount ?? 0;
                invoice.Cgst = amt * 0.09m; // 9% CGST
                invoice.Sgst = amt * 0.09m; // 9% SGST
                invoice.Total = amt + invoice.Cgst + invoice.Sgst;

                string sql = @"
                    INSERT INTO invoices (invoice_no, invoice_date, client_name, client_gstin, client_address, project_deal, description, amount, cgst, sgst, total, payment_status, broker_name, broker_address, broker_email, broker_phone, broker_rera, broker_gstin, bank_name, bank_account, bank_ifsc, bank_account_type, bank_branch, terms, uploaded_file_path, created_at, items)
                    VALUES (@InvoiceNo, @InvoiceDate, @ClientName, @ClientGstin, @ClientAddress, @ProjectDeal, @Description, @Amount, @Cgst, @Sgst, @Total, @PaymentStatus, @BrokerName, @BrokerAddress, @BrokerEmail, @BrokerPhone, @BrokerRera, @BrokerGstin, @BankName, @BankAccount, @BankIfsc, @BankAccountType, @BankBranch, @Terms, @UploadedFilePath, @CreatedAt, @Items)
                    RETURNING id;";

                int insertedId = conn.ExecuteScalar<int>(sql, invoice);
                invoice.Id = insertedId;
                return Ok(invoice);
            }
        }

        // ==========================================
        // 5. Proposals
        // ==========================================
        [HttpGet]
        [Route("api/proposals")]
        public IHttpActionResult GetProposals()
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var proposals = conn.Query<Proposal>("SELECT * FROM proposals ORDER BY id DESC").ToList();
                return Ok(proposals);
            }
        }

        [HttpPost]
        [Route("api/proposals")]
        public IHttpActionResult CreateProposal([FromBody] Newtonsoft.Json.Linq.JObject body)
        {
            if (body == null || body["leadId"] == null || body["title"] == null || body["properties"] == null)
                return BadRequest("Missing required parameters.");

            int leadId = (int)body["leadId"];
            string title = body["title"].ToString();
            string intro = body["introMessage"]?.ToString() ?? "";
            var propertyIds = body["properties"].ToObject<List<int>>();

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                using (var trans = conn.BeginTransaction())
                {
                    try
                    {
                        string token = Guid.NewGuid().ToString("N").Substring(0, 12);
                        string sql = @"
                            INSERT INTO proposals (token, lead_id, title, intro_message, created_at)
                            VALUES (@token, @leadId, @title, @intro, @createdAt)
                            RETURNING id;";
                        
                        int propId = conn.ExecuteScalar<int>(sql, new { token, leadId, title, intro, createdAt = DateTime.UtcNow.ToString("o") }, transaction: trans);

                        foreach (var pid in propertyIds)
                        {
                            conn.Execute(@"
                                INSERT INTO proposal_items (proposal_id, property_id, agent_comments)
                                VALUES (@propId, @pid, '')",
                                new { propId, pid }, transaction: trans);
                        }

                        trans.Commit();
                        return Ok(new { success = true, token });
                    }
                    catch (Exception ex)
                    {
                        trans.Rollback();
                        return InternalServerError(ex);
                    }
                }
            }
        }

        [HttpGet]
        [Route("api/public/proposals/{token}")]
        public IHttpActionResult GetPublicProposal(string token)
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var proposal = conn.QueryFirstOrDefault<Proposal>(
                    "SELECT * FROM proposals WHERE token = @token",
                    new { token }
                );

                if (proposal == null) return NotFound();

                // Fetch matched properties
                var properties = conn.Query<Property>(@"
                    SELECT pr.* FROM properties pr
                    JOIN proposal_items pi ON pr.id = pi.property_id
                    WHERE pi.proposal_id = @id",
                    new { id = proposal.Id }
                ).ToList();

                // Sanitize property fields (mask owner details in public link space)
                var sanitized = properties.Select(pr => new
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

                return Ok(new
                {
                    success = true,
                    proposal = new
                    {
                        id = proposal.Id,
                        token = proposal.Token,
                        title = proposal.Title,
                        intro_message = proposal.IntroMessage,
                        created_at = proposal.CreatedAt
                    },
                    properties = sanitized
                });
            }
        }
    }
}
