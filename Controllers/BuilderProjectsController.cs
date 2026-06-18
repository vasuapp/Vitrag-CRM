using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Http;
using Npgsql;
using Dapper;
using VitragCRM.Backend.Data;
using VitragCRM.Backend.Models;

namespace VitragCRM.Backend.Controllers
{
    public class BuilderProjectsController : ApiController
    {
        private string GetConnString() => DbConnectionFactory.GetConnectionString();

        [HttpGet]
        [Route("api/projects")]
        public IHttpActionResult GetProjects([FromUri] string search = null, [FromUri] string zone = null)
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                string sql = "SELECT * FROM builder_projects WHERE deleted_at IS NULL";
                var paramsObj = new DynamicParameters();

                if (!string.IsNullOrEmpty(search))
                {
                    sql += " AND (builder_name ILIKE @search OR project_name ILIKE @search OR location ILIKE @search OR special_tags ILIKE @search)";
                    paramsObj.Add("search", $"%{search}%");
                }
                if (!string.IsNullOrEmpty(zone))
                {
                    sql += " AND zone = @zone";
                    paramsObj.Add("zone", zone);
                }

                sql += " ORDER BY id DESC";

                var projects = conn.Query<BuilderProject>(sql, paramsObj).ToList();
                return Ok(projects);
            }
        }

        [HttpGet]
        [Route("api/projects/{id}")]
        public IHttpActionResult GetProject(int id)
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var project = conn.QueryFirstOrDefault<BuilderProject>(
                    "SELECT * FROM builder_projects WHERE id = @id AND deleted_at IS NULL", 
                    new { id }
                );
                if (project == null) return NotFound();
                return Ok(project);
            }
        }

        [HttpPost]
        [Route("api/projects")]
        public IHttpActionResult CreateProject(BuilderProject project)
        {
            if (project == null) return BadRequest("Project data is empty.");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                project.CreatedAt = DateTime.UtcNow.ToString("o");

                string sql = @"
                    INSERT INTO builder_projects (builder_name, project_name, location, land_parcel, tower, elevation, configuration, carpet_area, price_final, uc_rtmi, possession, subvention, clp_due, floor_rise, location_usp, metro_station, other_usp, special_tags, created_at, brochure_link, floor_plans, mother_docs, assignments, kyc_docs, photos, videos, cp_agreements, builder_details, finance_info, analytics_info, zone, onboarded_year, proj_id, google_map_url, unit_details, builder_poc_details, plot_dimension, plot_size, house_facing, plot_facing, custom_data)
                    VALUES (@BuilderName, @ProjectName, @Location, @LandParcel, @Tower, @Elevation, @Configuration, @CarpetArea, @PriceFinal, @UcRtmi, @Possession, @Subvention, @ClpDue, @FloorRise, @LocationUsp, @MetroStation, @OtherUsp, @SpecialTags, @CreatedAt, @BrochureLink, @FloorPlans, @MotherDocs, @Assignments, @KycDocs, @Photos, @Videos, @CpAgreements, @BuilderDetails, @FinanceInfo, @AnalyticsInfo, @Zone, @OnboardedYear, @ProjId, @GoogleMapUrl, @UnitDetails, @BuilderPocDetails, @PlotDimension, @PlotSize, @HouseFacing, @PlotFacing, CAST(@CustomData as jsonb))
                    RETURNING id;";

                int insertedId = conn.ExecuteScalar<int>(sql, project);

                // Auto-increment sequence counter update
                if (!string.IsNullOrEmpty(project.ProjId))
                {
                    try
                    {
                        // Format: e.g. PROJ-152/N-2026 or 152/N-2026
                        var match = System.Text.RegularExpressions.Regex.Match(project.ProjId, @"^(PROJ-)?(\d+)/");
                        if (match.Success)
                        {
                            int val = int.Parse(match.Groups[2].Value);
                            string year = project.OnboardedYear ?? DateTime.UtcNow.Year.ToString();
                            string counterKey = $"proj_global_{year}";

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
                        Console.WriteLine($"Error updating sequence counter on BuilderProject creation: {ex.Message}");
                    }
                }

                project.Id = insertedId;
                return Ok(project);
            }
        }

        [HttpPut]
        [Route("api/projects/{id}")]
        public IHttpActionResult UpdateProject(int id, BuilderProject project)
        {
            if (project == null) return BadRequest("Project data is empty.");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var existing = conn.QueryFirstOrDefault<BuilderProject>(
                    "SELECT * FROM builder_projects WHERE id = @id AND deleted_at IS NULL", 
                    new { id }
                );
                if (existing == null) return NotFound();

                project.Id = id;
                string sql = @"
                    UPDATE builder_projects 
                    SET builder_name = @BuilderName, project_name = @ProjectName, location = @Location, 
                        land_parcel = @LandParcel, tower = @Tower, elevation = @Elevation, 
                        configuration = @Configuration, carpet_area = @CarpetArea, price_final = @PriceFinal, 
                        uc_rtmi = @UcRtmi, possession = @Possession, subvention = @Subvention, clp_due = @ClpDue, 
                        floor_rise = @FloorRise, location_usp = @LocationUsp, metro_station = @MetroStation, 
                        other_usp = @OtherUsp, special_tags = @SpecialTags, brochure_link = @BrochureLink, 
                        floor_plans = @FloorPlans, mother_docs = @MotherDocs, assignments = @Assignments, 
                        kyc_docs = @KycDocs, photos = @Photos, videos = @Videos, cp_agreements = @CpAgreements, 
                        builder_details = @BuilderDetails, finance_info = @FinanceInfo, analytics_info = @AnalyticsInfo, 
                        zone = @Zone, onboarded_year = @OnboardedYear, proj_id = @ProjId, google_map_url = @GoogleMapUrl, 
                        unit_details = @UnitDetails, builder_poc_details = @BuilderPocDetails, 
                        plot_dimension = @PlotDimension, plot_size = @PlotSize, house_facing = @HouseFacing, 
                        plot_facing = @PlotFacing, custom_data = CAST(@CustomData as jsonb)
                    WHERE id = @Id;";

                conn.Execute(sql, project);
                return Ok(new { success = true, message = "Builder project updated successfully." });
            }
        }

        [HttpDelete]
        [Route("api/projects/{id}")]
        public IHttpActionResult DeleteProject(int id)
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var existing = conn.QueryFirstOrDefault<BuilderProject>(
                    "SELECT * FROM builder_projects WHERE id = @id AND deleted_at IS NULL", 
                    new { id }
                );
                if (existing == null) return NotFound();

                conn.Execute("UPDATE builder_projects SET deleted_at = @DeletedAt WHERE id = @id", new { DeletedAt = DateTime.UtcNow.ToString("o"), id });
                return Ok(new { success = true, message = "Builder project deleted successfully." });
            }
        }
    }
}
