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
    public class PropertiesController : ApiController
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
        [Route("api/properties")]
        public IHttpActionResult GetProperties(
            [FromUri] string search = null,
            [FromUri] string type = null,
            [FromUri] string config = null,
            [FromUri] string zone = null,
            [FromUri] string status = null,
            [FromUri] string mandate_type = null,
            [FromUri] string facing = null,
            [FromUri] string house_facing = null,
            [FromUri] string plot_facing = null,
            [FromUri] decimal? min_price = null,
            [FromUri] decimal? max_price = null,
            [FromUri] int? agent_id = null)
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                string sql = "SELECT * FROM properties WHERE deleted_at IS NULL";
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
                    sql += " AND (society ILIKE @search OR location ILIKE @search OR prop_id ILIKE @search OR owner_name ILIKE @search OR special_tags ILIKE @search)";
                    paramsObj.Add("search", $"%{search}%");
                }
                if (!string.IsNullOrEmpty(type))
                {
                    sql += " AND property_type = @type";
                    paramsObj.Add("type", type);
                }
                if (!string.IsNullOrEmpty(config))
                {
                    sql += " AND configuration ILIKE @config";
                    paramsObj.Add("config", $"%{config}%");
                }
                if (!string.IsNullOrEmpty(zone))
                {
                    sql += " AND zone = @zone";
                    paramsObj.Add("zone", zone);
                }
                if (!string.IsNullOrEmpty(status))
                {
                    sql += " AND status = @status";
                    paramsObj.Add("status", status);
                }
                if (!string.IsNullOrEmpty(mandate_type))
                {
                    sql += " AND mandate_type = @mandate_type";
                    paramsObj.Add("mandate_type", mandate_type);
                }
                if (!string.IsNullOrEmpty(facing))
                {
                    sql += " AND facing = @facing";
                    paramsObj.Add("facing", facing);
                }
                if (!string.IsNullOrEmpty(house_facing))
                {
                    sql += " AND house_facing = @house_facing";
                    paramsObj.Add("house_facing", house_facing);
                }
                if (!string.IsNullOrEmpty(plot_facing))
                {
                    sql += " AND plot_facing = @plot_facing";
                    paramsObj.Add("plot_facing", plot_facing);
                }
                if (min_price.HasValue)
                {
                    sql += " AND price >= @min_price";
                    paramsObj.Add("min_price", min_price.Value);
                }
                if (max_price.HasValue)
                {
                    sql += " AND price <= @max_price";
                    paramsObj.Add("max_price", max_price.Value);
                }
                if (agent_id.HasValue)
                {
                    sql += " AND agent_id = @agent_id";
                    paramsObj.Add("agent_id", agent_id.Value);
                }

                sql += " ORDER BY id DESC";

                var properties = conn.Query<Property>(sql, paramsObj).ToList();
                return Ok(properties);
            }
        }

        [HttpGet]
        [Route("api/properties/{id}")]
        public IHttpActionResult GetProperty(int id)
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var property = conn.QueryFirstOrDefault<Property>(
                    "SELECT * FROM properties WHERE id = @id AND deleted_at IS NULL", 
                    new { id }
                );
                if (property == null) return NotFound();

                var currentAgent = GetAgent();
                if (currentAgent != null && currentAgent.Role.Equals("Employee", StringComparison.OrdinalIgnoreCase) && property.AgentId != currentAgent.Id)
                {
                    return Unauthorized();
                }

                return Ok(property);
            }
        }

        [HttpPost]
        [Route("api/properties")]
        public IHttpActionResult CreateProperty(Property property)
        {
            if (property == null) return BadRequest("Property data is empty.");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();

                var currentAgent = GetAgent();
                if (!property.AgentId.HasValue && currentAgent != null)
                {
                    property.AgentId = currentAgent.Id;
                }

                property.LastUpdated = DateTime.UtcNow.ToString("o");
                property.Status = string.IsNullOrEmpty(property.Status) ? "AVAILABLE" : property.Status;
                property.SyncStatus = "NOT_SYNCED";

                string sql = @"
                    INSERT INTO properties (prop_id, mandate_type, property_type, society, location, status, site_area, area_sqft, configuration, floor_info, floor_range, interiors, facing, amenities, car_park, price, price_raw, possession, project_size, project_status, additional_info, video_link, photo_link, brochure_link, owner_name, owner_phone, owner_email, unit_no, registration_status, source, sub_source, comments, maintenance, deposit, available_from, date_of_inventory, available_for, plot_size, sba, associate_id, special_tags, last_updated, sync_status, zone, onboarded_year, plot_dimension, house_facing, plot_facing, holder_type, project_id, agent_id, commission_agreed, google_map_url, road_width, fsi, closure_site_visit, closure_negotiation, closure_agreement, closure_registration, closure_closed, closure_buyer_name, closure_buyer_phone, closure_deal_value, closure_commission_pct, closure_date, closure_notes, closure_joint_visit, custom_data)
                    VALUES (@PropId, @MandateType, @PropertyType, @Society, @Location, @Status, @SiteArea, @AreaSqft, @Configuration, @FloorInfo, @FloorRange, @Interiors, @Facing, @Amenities, @CarPark, @Price, @PriceRaw, @Possession, @ProjectSize, @ProjectStatus, @AdditionalInfo, @VideoLink, @PhotoLink, @BrochureLink, @OwnerName, @OwnerPhone, @OwnerEmail, @UnitNo, @RegistrationStatus, @Source, @SubSource, @Comments, @Maintenance, @Deposit, @AvailableFrom, @DateOfInventory, @AvailableFor, @PlotSize, @Sba, @AssociateId, @SpecialTags, @LastUpdated, @SyncStatus, @Zone, @OnboardedYear, @PlotDimension, @HouseFacing, @PlotFacing, @HolderType, @ProjectId, @AgentId, @CommissionAgreed, @GoogleMapUrl, @RoadWidth, @Fsi, @ClosureSiteVisit, @ClosureNegotiation, @ClosureAgreement, @ClosureRegistration, @ClosureClosed, @ClosureBuyerName, @ClosureBuyerPhone, @ClosureDealValue, @ClosureCommissionPct, @ClosureDate, @ClosureNotes, @ClosureJointVisit, CAST(@CustomData as jsonb))
                    RETURNING id;";

                int insertedId = conn.ExecuteScalar<int>(sql, property);

                // Auto-increment sequence counter update
                if (!string.IsNullOrEmpty(property.PropId))
                {
                    try
                    {
                        // Parse counterKey and nextVal if generatedId was used
                        // Format: e.g. CRT152/N-2026 or 152/N-2026
                        var match = System.Text.RegularExpressions.Regex.Match(property.PropId, @"^([A-Z]*)(\d+)/");
                        if (match.Success)
                        {
                            string prefix = match.Groups[1].Value;
                            int val = int.Parse(match.Groups[2].Value);
                            
                            string category = "prop_residential_resale";
                            if (prefix == "CRT") category = "prop_commercial_rental";
                            else if (prefix == "C") category = "prop_commercial_sale";
                            else if (prefix == "RT") category = "prop_residential_rental";

                            string year = property.OnboardedYear ?? DateTime.UtcNow.Year.ToString();
                            string counterKey = $"{category}_{year}";

                            conn.Execute(@"
                                INSERT INTO sequence_counters (category_key, last_value)
                                VALUES (@counterKey, @val)
                                ON CONFLICT (category_key)
                                DO UPDATE SET last_value = GREATEST(sequence_counters.last_value, EXCLUDED.last_value);",
                                new { counterKey, val });
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error updating sequence counter on Property creation: {ex.Message}");
                    }
                }

                property.Id = insertedId;
                return Ok(property);
            }
        }

        [HttpPut]
        [Route("api/properties/{id}")]
        public IHttpActionResult UpdateProperty(int id, Property property)
        {
            if (property == null) return BadRequest("Property data is empty.");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var existing = conn.QueryFirstOrDefault<Property>(
                    "SELECT * FROM properties WHERE id = @id AND deleted_at IS NULL", 
                    new { id }
                );
                if (existing == null) return NotFound();

                var currentAgent = GetAgent();
                if (currentAgent != null && currentAgent.Role.Equals("Employee", StringComparison.OrdinalIgnoreCase) && existing.AgentId != currentAgent.Id)
                {
                    return Unauthorized();
                }

                property.LastUpdated = DateTime.UtcNow.ToString("o");
                property.Id = id;

                string sql = @"
                    UPDATE properties 
                    SET prop_id = @PropId, mandate_type = @MandateType, property_type = @PropertyType, society = @Society, 
                        location = @Location, status = @Status, site_area = @SiteArea, area_sqft = @AreaSqft, 
                        configuration = @Configuration, floor_info = @FloorInfo, floor_range = @FloorRange, 
                        interiors = @Interiors, facing = @Facing, amenities = @Amenities, car_park = @CarPark, 
                        price = @Price, price_raw = @PriceRaw, possession = @Possession, project_size = @ProjectSize, 
                        project_status = @ProjectStatus, additional_info = @AdditionalInfo, video_link = @VideoLink, 
                        photo_link = @PhotoLink, brochure_link = @BrochureLink, owner_name = @OwnerName, 
                        owner_phone = @OwnerPhone, owner_email = @OwnerEmail, unit_no = @UnitNo, 
                        registration_status = @RegistrationStatus, source = @Source, sub_source = @SubSource, 
                        comments = @Comments, maintenance = @Maintenance, deposit = @Deposit, 
                        available_from = @AvailableFrom, date_of_inventory = @DateOfInventory, available_for = @AvailableFor, 
                        plot_size = @PlotSize, sba = @Sba, associate_id = @AssociateId, special_tags = @SpecialTags, 
                        last_updated = @LastUpdated, sync_status = @SyncStatus, zone = @Zone, 
                        onboarded_year = @OnboardedYear, plot_dimension = @PlotDimension, house_facing = @HouseFacing, 
                        plot_facing = @PlotFacing, holder_type = @HolderType, project_id = @ProjectId, agent_id = @AgentId, 
                        commission_agreed = @CommissionAgreed, google_map_url = @GoogleMapUrl, road_width = @RoadWidth, 
                        fsi = @Fsi, closure_site_visit = @ClosureSiteVisit, closure_negotiation = @ClosureNegotiation, 
                        closure_agreement = @ClosureAgreement, closure_registration = @ClosureRegistration, 
                        closure_closed = @ClosureClosed, closure_buyer_name = @ClosureBuyerName, 
                        closure_buyer_phone = @ClosureBuyerPhone, closure_deal_value = @ClosureDealValue, 
                        closure_commission_pct = @ClosureCommissionPct, closure_date = @ClosureDate, 
                        closure_notes = @ClosureNotes, closure_joint_visit = @ClosureJointVisit, 
                        custom_data = CAST(@CustomData as jsonb)
                    WHERE id = @Id;";

                conn.Execute(sql, property);
                return Ok(new { success = true, message = "Property updated successfully." });
            }
        }

        [HttpDelete]
        [Route("api/properties/{id}")]
        public IHttpActionResult DeleteProperty(int id)
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var existing = conn.QueryFirstOrDefault<Property>(
                    "SELECT * FROM properties WHERE id = @id AND deleted_at IS NULL", 
                    new { id }
                );
                if (existing == null) return NotFound();

                var currentAgent = GetAgent();
                if (currentAgent != null && currentAgent.Role.Equals("Employee", StringComparison.OrdinalIgnoreCase) && existing.AgentId != currentAgent.Id)
                {
                    return Unauthorized();
                }

                conn.Execute("UPDATE properties SET deleted_at = @DeletedAt WHERE id = @id", new { DeletedAt = DateTime.UtcNow.ToString("o"), id });
                return Ok(new { success = true, message = "Property deleted successfully." });
            }
        }

        [HttpGet]
        [Route("api/properties/{id}/activity-log")]
        public IHttpActionResult GetActivityLog(int id)
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var logs = conn.Query<LeadActivity>(
                    "SELECT * FROM lead_activities WHERE lead_id = @id ORDER BY id DESC", // Uses lead_activities table in Node.js for simplicity
                    new { id }
                ).ToList();
                return Ok(logs);
            }
        }

        [HttpPost]
        [Route("api/properties/{id}/activity-log")]
        public IHttpActionResult CreateActivityLog(int id, LeadActivity activity)
        {
            if (activity == null) return BadRequest("Missing activity data.");

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
        [Route("api/generate-id")]
        public IHttpActionResult GenerateId(
            [FromUri] string propType = null, 
            [FromUri] string availableFor = null, 
            [FromUri] string isProject = null, 
            [FromUri] string zone = null, 
            [FromUri] string year = null)
        {
            try
            {
                string z = zone ?? "N";
                string y = year ?? DateTime.UtcNow.Year.ToString();
                string prefix = "";
                string counterKey = "";

                if (isProject == "true")
                {
                    prefix = "PROJ-";
                    counterKey = $"proj_global_{y}";
                }
                else
                {
                    // Calculate ID Logic
                    bool isComm = !string.IsNullOrEmpty(propType) && 
                        (propType.IndexOf("commercial", StringComparison.OrdinalIgnoreCase) >= 0 ||
                         propType.IndexOf("retail", StringComparison.OrdinalIgnoreCase) >= 0 ||
                         propType.IndexOf("warehouse", StringComparison.OrdinalIgnoreCase) >= 0 ||
                         propType.IndexOf("office", StringComparison.OrdinalIgnoreCase) >= 0 ||
                         propType.IndexOf("showroom", StringComparison.OrdinalIgnoreCase) >= 0);

                    bool isRent = !string.IsNullOrEmpty(availableFor) && 
                        (availableFor.IndexOf("rent", StringComparison.OrdinalIgnoreCase) >= 0 ||
                         availableFor.IndexOf("lease", StringComparison.OrdinalIgnoreCase) >= 0);

                    string category = "prop_residential_resale";
                    if (isComm && isRent)
                    {
                        category = "prop_commercial_rental";
                        prefix = "CRT";
                    }
                    else if (isComm && !isRent)
                    {
                        category = "prop_commercial_sale";
                        prefix = "C";
                    }
                    else if (!isComm && isRent)
                    {
                        category = "prop_residential_rental";
                        prefix = "RT";
                    }
                    else
                    {
                        category = "prop_residential_resale";
                        prefix = "";
                    }

                    counterKey = $"{category}_{y}";
                }

                using (var conn = new NpgsqlConnection(GetConnString()))
                {
                    conn.Open();
                    int lastValue = conn.ExecuteScalar<int>(
                        "SELECT last_value FROM sequence_counters WHERE category_key = @counterKey",
                        new { counterKey }
                    );

                    int nextVal = lastValue == 0 ? 151 : lastValue + 1;
                    string generatedId = $"{prefix}{nextVal}/{z}-{y}";

                    return Ok(new
                    {
                        generatedId,
                        nextVal,
                        counterKey
                    });
                }
            }
            catch (Exception ex)
            {
                return InternalServerError(ex);
            }
        }
    }
}
