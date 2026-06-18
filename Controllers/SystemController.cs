using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Web.Http;
using Microsoft.Owin;
using Npgsql;
using Dapper;
using VitragCRM.Backend.Data;
using VitragCRM.Backend.Models;

namespace VitragCRM.Backend.Controllers
{
    public class SystemController : ApiController
    {
        private string GetConnString() => DbConnectionFactory.GetConnectionString();

        private Agent GetAgent()
        {
            var owinContext = Request.GetOwinContext();
            return owinContext.Environment.ContainsKey("AgentSession") 
                ? owinContext.Environment["AgentSession"] as Agent 
                : null;
        }

        private readonly Dictionary<string, string> _defaultSettings = new Dictionary<string, string>
        {
            { "showMaskedFields", "true" },
            { "userName", "Vasu Jain" },
            { "userRole", "Owner / Admin" },
            { "coBrandName", "Subh Homes" },
            { "coBrandLogo", "" },
            { "coPhone", "+91 9964985128" },
            { "coEmail", "vasujain@subhhomes.com" },
            { "coAddress", "300, 2nd Floor, Kamraj Road, Bengaluru - 560 042" },
            { "coRera", "AG/KN/170731/000296" },
            { "coGstin", "29AMSPK0486E1ZO" },
            { "bankName", "SUBH HOMES" },
            { "bankAccount", "10060214087" },
            { "bankIfsc", "IDFB0080157" },
            { "bankType", "CURRENT ACCOUNT" },
            { "bankBranch", "IDFC FIRST BANK, KALYAN NAGAR BRANCH" },
            { "invoiceTerms", "1. Please make the payment on or before registration\n2. Service Charges for Seller is 2% plus Gst. For Buyer is 1% plus Gst. For UC properties no Service Charge. Rental Property 1 Month's rent plus Gst\n3. Subject to Bangalore Jurisdiction." }
        };

        [HttpGet]
        [Route("api/system/settings")]
        public IHttpActionResult GetSettings()
        {
            try
            {
                var settings = new Dictionary<string, object>();

                // Load defaults first
                foreach (var kv in _defaultSettings)
                {
                    if (kv.Key == "showMaskedFields")
                        settings[kv.Key] = kv.Value == "true";
                    else
                        settings[kv.Key] = kv.Value;
                }

                // Override from database
                using (var conn = new NpgsqlConnection(GetConnString()))
                {
                    conn.Open();
                    var rows = conn.Query<SystemSetting>("SELECT * FROM system_settings").ToList();
                    foreach (var r in rows)
                    {
                        if (r.Key == "showMaskedFields")
                            settings[r.Key] = r.Value.Equals("true", StringComparison.OrdinalIgnoreCase);
                        else
                            settings[r.Key] = r.Value;
                    }
                }

                return Ok(settings);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        [HttpPost]
        [Route("api/system/settings")]
        public IHttpActionResult SaveSettings(Dictionary<string, object> updates)
        {
            if (updates == null) return BadRequest("Updates dictionary is empty.");

            try
            {
                using (var conn = new NpgsqlConnection(GetConnString()))
                {
                    conn.Open();
                    foreach (var kv in updates)
                    {
                        if (kv.Value == null) continue;
                        string valStr = kv.Value.ToString();

                        conn.Execute(@"
                            INSERT INTO system_settings (key, value)
                            VALUES (@Key, @Value)
                            ON CONFLICT (key) 
                            DO UPDATE SET value = EXCLUDED.value",
                            new { Key = kv.Key, Value = valStr }
                        );
                    }
                }

                return GetSettings();
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        [HttpGet]
        [Route("api/system/db-status")]
        public IHttpActionResult GetDbStatus()
        {
            string dbUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
            bool isRemoteDb = !string.IsNullOrEmpty(dbUrl) && 
                              !dbUrl.Contains("localhost") && 
                              !dbUrl.Contains("127.0.0.1");

            return Ok(new
            {
                initialized = true,
                attempts = 1,
                error = (string)null,
                databaseUrlConfigured = !string.IsNullOrEmpty(dbUrl),
                isLocalDb = !isRemoteDb
            });
        }

        [HttpGet]
        [Route("api/export/{table}")]
        public IHttpActionResult ExportTable(string table, [FromUri] string password = null)
        {
            string[] allowedTables = { "leads", "properties", "builder_projects" };
            if (!allowedTables.Contains(table.ToLower()))
            {
                return BadRequest("Invalid table requested");
            }

            // Check passwords or masking settings if showMaskedFields is false
            bool showMaskedFieldsSetting = true;
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                string val = conn.QueryFirstOrDefault<string>("SELECT value FROM system_settings WHERE key = 'showMaskedFields'");
                if (val != null)
                {
                    showMaskedFieldsSetting = val.Equals("true", StringComparison.OrdinalIgnoreCase);
                }
            }

            if (!showMaskedFieldsSetting && password != "admin123")
            {
                return ResponseMessage(Request.CreateErrorResponse(HttpStatusCode.Forbidden, "Admin authorization password required"));
            }

            try
            {
                using (var conn = new NpgsqlConnection(GetConnString()))
                {
                    conn.Open();
                    // Select all rows
                    string query = $"SELECT * FROM {table} WHERE deleted_at IS NULL ORDER BY id DESC";
                    var rows = conn.Query<IDictionary<string, object>>(query).Select(x => (IDictionary<string, object>)x).ToList();

                    if (rows.Count == 0)
                    {
                        // Return empty column names header
                        var columnQuery = $"SELECT column_name FROM information_schema.columns WHERE table_name = '{table}'";
                        var cols = conn.Query<string>(columnQuery).ToList();
                        string emptyCsv = string.Join(",", cols);
                        return CsvResponse(emptyCsv, $"{table}_export.csv");
                    }

                    var headers = rows[0].Keys.ToList();
                    string csv = string.Join(",", headers.Select(EscapeCsvValue)) + "\n";

                    foreach (var row in rows)
                    {
                        var values = headers.Select(h => row.ContainsKey(h) ? row[h] : null);
                        csv += string.Join(",", values.Select(v => EscapeCsvValue(v?.ToString() ?? ""))) + "\n";
                    }

                    return CsvResponse(csv, $"{table}_export.csv");
                }
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }

        private string EscapeCsvValue(string val)
        {
            if (string.IsNullOrEmpty(val)) return "";
            if (val.Contains(",") || val.Contains("\"") || val.Contains("\n") || val.Contains("\r"))
            {
                return "\"" + val.Replace("\"", "\"\"") + "\"";
            }
            return val;
        }

        private IHttpActionResult CsvResponse(string content, string filename)
        {
            var response = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(content)
            };
            response.Content.Headers.ContentType = new MediaTypeHeaderValue("text/csv");
            response.Content.Headers.ContentDisposition = new ContentDispositionHeaderValue("attachment")
            {
                FileName = filename
            };
            return ResponseMessage(response);
        }

        [HttpGet]
        [Route("api/system/backup/download")]
        public IHttpActionResult DownloadBackup()
        {
            try
            {
                string backupsDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "backups");
                if (!Directory.Exists(backupsDir))
                {
                    Directory.CreateDirectory(backupsDir);
                }

                string timestamp = DateTime.UtcNow.ToString("yyyy-MM-dd_HH-mm-ss");
                string backupFilename = $"realpro_crm_backup_{timestamp}_full.sql";
                string backupPath = Path.Combine(backupsDir, backupFilename);

                // Fallback structured text generation of database tables
                // This generates standard PG INSERT scripts dynamically in case pg_dump is missing!
                using (var conn = new NpgsqlConnection(GetConnString()))
                {
                    conn.Open();
                    var writer = new StringWriter();
                    writer.WriteLine($"-- REALPro Vitrag CRM PG SQL Backup");
                    writer.WriteLine($"-- Generated: {DateTime.UtcNow} UTC\n");

                    string[] tables = {
                        "system_settings", "agents", "leads", "properties", "builder_projects",
                        "daily_checklist", "associates", "commissions", "todo_tasks", "scratchpad",
                        "habits", "drip_campaigns", "drip_logs", "auto_assignment_settings",
                        "telephony_calls", "proposals", "proposal_items", "client_messages",
                        "lead_timeline", "lead_scorecards", "attendance_logs", "interaction_logs",
                        "sequence_counters", "lead_activities", "lead_property_interest", "invoices",
                        "sops", "communication_templates", "associate_shares", "document_vault",
                        "duplicate_leads_audit", "custom_forms", "custom_tables", "custom_table_rows",
                        "custom_workflows"
                    };

                    foreach (var table in tables)
                    {
                        try
                        {
                            writer.WriteLine($"-- Table: {table}");
                            var rows = conn.Query<IDictionary<string, object>>($"SELECT * FROM {table}").Select(x => (IDictionary<string, object>)x).ToList();
                            if (rows.Count == 0) continue;

                            var keys = rows[0].Keys.ToList();
                            string columnsList = string.Join(", ", keys);

                            foreach (var r in rows)
                            {
                                var vals = new List<string>();
                                foreach (var key in keys)
                                {
                                    var valObj = r[key];
                                    if (valObj == null)
                                    {
                                        vals.Add("NULL");
                                    }
                                    else if (valObj is bool b)
                                    {
                                        vals.Add(b ? "TRUE" : "FALSE");
                                    }
                                    else if (valObj is int || valObj is long || valObj is decimal || valObj is double || valObj is float)
                                    {
                                        vals.Add(valObj.ToString());
                                    }
                                    else
                                    {
                                        // Escape single quotes for SQL string literals
                                        string escaped = valObj.ToString().Replace("'", "''");
                                        vals.Add($"'{escaped}'");
                                    }
                                }

                                writer.WriteLine($"INSERT INTO {table} ({columnsList}) VALUES ({string.Join(", ", vals)});");
                            }
                            writer.WriteLine();
                        }
                        catch (Exception tableEx)
                        {
                            writer.WriteLine($"-- Failed to back up table {table}: {tableEx.Message}");
                        }
                    }

                    File.WriteAllText(backupPath, writer.ToString());
                }

                var response = new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(File.ReadAllText(backupPath))
                };
                response.Content.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
                response.Content.Headers.ContentDisposition = new ContentDispositionHeaderValue("attachment")
                {
                    FileName = backupFilename
                };
                return ResponseMessage(response);
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }
    }
}
