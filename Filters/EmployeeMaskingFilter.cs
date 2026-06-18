using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Web.Http.Filters;
using Npgsql;
using Dapper;
using VitragCRM.Backend.Models;
using VitragCRM.Backend.Data;

namespace VitragCRM.Backend.Filters
{
    public class EmployeeMaskingAttribute : ActionFilterAttribute
    {
        public override void OnActionExecuted(HttpActionExecutedContext actionExecutedContext)
        {
            if (actionExecutedContext.Response == null || actionExecutedContext.Response.Content == null)
                return;

            // 1. Get the current Agent session from OWIN environment
            var owinContext = actionExecutedContext.Request.GetOwinContext();
            var agent = owinContext.Environment.ContainsKey("AgentSession") 
                ? owinContext.Environment["AgentSession"] as Agent 
                : null;

            // 2. Fetch System Settings to see if masking is enabled project-wide
            bool showMaskedFields = true;
            try
            {
                using (var conn = new NpgsqlConnection(DbConnectionFactory.GetConnectionString()))
                {
                    conn.Open();
                    string setting = conn.QueryFirstOrDefault<string>(
                        "SELECT value FROM system_settings WHERE key = 'showMaskedFields'"
                    );
                    if (setting != null)
                    {
                        showMaskedFields = setting.Equals("true", StringComparison.OrdinalIgnoreCase);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error fetching system settings for masking: {ex.Message}");
            }

            // 3. Determine if masking is required for this request
            bool isAdmin = agent == null || agent.Role.Equals("Admin", StringComparison.OrdinalIgnoreCase);
            bool isEmployee = agent != null && agent.Role.Equals("Employee", StringComparison.OrdinalIgnoreCase);
            
            // Allow pages parsing for phone_access
            List<string> allowedPages = new List<string>();
            if (agent != null)
            {
                if (agent.Role.Equals("Admin", StringComparison.OrdinalIgnoreCase))
                {
                    allowedPages.Add("*");
                }
                else
                {
                    try
                    {
                        if (!string.IsNullOrEmpty(agent.AllowedPages))
                        {
                            if (agent.AllowedPages.Contains("["))
                            {
                                allowedPages = Newtonsoft.Json.JsonConvert.DeserializeObject<List<string>>(agent.AllowedPages) ?? new List<string>();
                            }
                            else
                            {
                                allowedPages.Add(agent.AllowedPages);
                            }
                        }
                    }
                    catch
                    {
                        allowedPages.Add(agent.AllowedPages);
                    }
                }
            }

            bool hasPhoneAccess = isAdmin || allowedPages.Contains("*") || allowedPages.Contains("phone_access");
            bool shouldMaskData = !showMaskedFields || isEmployee;

            // 4. Extract and process the returned object
            if (actionExecutedContext.Response.Content is ObjectContent objectContent)
            {
                var value = objectContent.Value;
                if (value == null) return;

                // Process Property collections
                if (value is Property singleProp)
                {
                    MaskProperty(singleProp, agent, isAdmin, hasPhoneAccess, shouldMaskData);
                }
                else if (value is IEnumerable<Property> propList)
                {
                    foreach (var prop in propList)
                    {
                        MaskProperty(prop, agent, isAdmin, hasPhoneAccess, shouldMaskData);
                    }
                }
                // Process Lead collections
                else if (value is Lead singleLead)
                {
                    MaskLead(singleLead, agent, isAdmin, hasPhoneAccess, shouldMaskData);
                }
                else if (value is IEnumerable<Lead> leadList)
                {
                    foreach (var lead in leadList)
                    {
                        MaskLead(lead, agent, isAdmin, hasPhoneAccess, shouldMaskData);
                    }
                }
                // Process Commission collections
                else if (value is Commission singleComm)
                {
                    MaskCommission(singleComm, shouldMaskData);
                }
                else if (value is IEnumerable<Commission> commList)
                {
                    foreach (var comm in commList)
                    {
                        MaskCommission(comm, shouldMaskData);
                    }
                }
            }
        }

        private void MaskProperty(Property p, Agent agent, bool isAdmin, bool hasPhoneAccess, bool shouldMaskData)
        {
            if (p == null) return;

            // If the user does not have owner access, mask owner info
            bool agentIsOwner = agent != null && p.AgentId == agent.Id;
            bool shouldMaskContact = !isAdmin && !hasPhoneAccess && !agentIsOwner || shouldMaskData;

            if (shouldMaskContact)
            {
                p.OwnerName = "🔐 Hidden (Admin locked)";
                p.OwnerPhone = "🔐 Hidden";
                p.OwnerEmail = "🔐 Hidden";
                p.Comments = "🔐 Hidden comments";
                p.AdminComments = "🔐 Hidden admin comments";
                p.UnitNo = "🔐 Hidden";
                p.CommissionAgreed = "🔐 Hidden";
                p.ClosureCommissionPct = null;
                p.ClosureCommissionAmt = null;
            }
        }

        private void MaskLead(Lead l, Agent agent, bool isAdmin, bool hasPhoneAccess, bool shouldMaskData)
        {
            if (l == null) return;

            // If the agent is not assigned, mask details
            bool agentIsAssigned = agent != null && l.AgentId == agent.Id;
            bool shouldMaskContact = !isAdmin && !hasPhoneAccess && !agentIsAssigned || shouldMaskData;

            if (shouldMaskContact)
            {
                l.Phone = "🔐 Hidden";
                l.Email = "🔐 Hidden";
                l.AdminComments = "🔐 Hidden admin comments";
            }
        }

        private void MaskCommission(Commission c, bool shouldMaskData)
        {
            if (c == null) return;

            if (shouldMaskData)
            {
                c.DealValue = 0;
                c.CommissionPercentage = 0;
                c.CommissionAmount = 0;
                c.CoBrokerPayout = 0;
                c.Expenses = 0;
                c.BillingInvoice = "🔐 Hidden";
            }
        }
    }
}
