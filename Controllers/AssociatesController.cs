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
    public class AssociatesController : ApiController
    {
        private string GetConnString() => DbConnectionFactory.GetConnectionString();

        [HttpGet]
        [Route("api/associates")]
        public IHttpActionResult GetAssociates([FromUri] string search = null)
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                string sql = "SELECT * FROM associates";
                var paramsObj = new DynamicParameters();

                if (!string.IsNullOrEmpty(search))
                {
                    sql += " WHERE name ILIKE @search OR company ILIKE @search OR speciality_zones ILIKE @search";
                    paramsObj.Add("search", $"%{search}%");
                }

                sql += " ORDER BY id DESC";

                var associates = conn.Query<Associate>(sql, paramsObj).ToList();
                return Ok(associates);
            }
        }

        [HttpGet]
        [Route("api/associates/performance")]
        public IHttpActionResult GetPerformance()
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                // Simple performance metrics: co-brokerage shares and rating averages
                var query = @"
                    SELECT a.id, a.name, a.company, a.rating,
                           COALESCE(COUNT(s.id), 0) as sharesCount
                    FROM associates a
                    LEFT JOIN associate_shares s ON a.id = s.associate_id
                    GROUP BY a.id, a.name, a.company, a.rating
                    ORDER BY sharesCount DESC, a.rating DESC";
                
                var results = conn.Query<dynamic>(query).ToList();
                return Ok(results);
            }
        }

        [HttpGet]
        [Route("api/associates/{id}/shares")]
        public IHttpActionResult GetShares(int id)
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                var shares = conn.Query<dynamic>(@"
                    SELECT s.id, s.shared_at, s.shared_by, p.prop_id, p.society, p.location, p.price
                    FROM associate_shares s
                    JOIN properties p ON s.property_id = p.id
                    WHERE s.associate_id = @id
                    ORDER BY s.id DESC", 
                    new { id }
                ).ToList();
                
                return Ok(shares);
            }
        }

        [HttpPost]
        [Route("api/associates")]
        public IHttpActionResult CreateAssociate(Associate associate)
        {
            if (associate == null) return BadRequest("Associate data is empty.");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                string sql = @"
                    INSERT INTO associates (name, company, phone, email, co_brokerage_share, rating, speciality_zones, linked_inventories, is_inner_circle, agent_id)
                    VALUES (@Name, @Company, @Phone, @Email, @CoBrokerageShare, @Rating, @SpecialityZones, @LinkedInventories, @IsInnerCircle, @AgentId)
                    RETURNING id;";

                int insertedId = conn.ExecuteScalar<int>(sql, associate);
                associate.Id = insertedId;
                return Ok(associate);
            }
        }

        [HttpPut]
        [Route("api/associates/{id}")]
        public IHttpActionResult UpdateAssociate(int id, Associate associate)
        {
            if (associate == null) return BadRequest("Associate data is empty.");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                string sql = @"
                    UPDATE associates 
                    SET name = @Name, company = @Company, phone = @Phone, email = @Email, 
                        co_brokerage_share = @CoBrokerageShare, rating = @Rating, 
                        speciality_zones = @SpecialityZones, linked_inventories = @LinkedInventories, 
                        is_inner_circle = @IsInnerCircle, agent_id = @AgentId
                    WHERE id = @Id;";

                associate.Id = id;
                conn.Execute(sql, associate);
                return Ok(new { success = true });
            }
        }

        [HttpDelete]
        [Route("api/associates/{id}")]
        public IHttpActionResult DeleteAssociate(int id)
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                conn.Execute("DELETE FROM associates WHERE id = @id", new { id });
                return Ok(new { success = true });
            }
        }

        // Shared link logging helper
        [HttpPost]
        [Route("api/associates/share")]
        public IHttpActionResult LogAssociateShare([FromBody] Newtonsoft.Json.Linq.JObject body)
        {
            if (body == null || body["associateId"] == null || body["propertyId"] == null) 
                return BadRequest("Missing required parameters.");

            int associateId = (int)body["associateId"];
            int propertyId = (int)body["propertyId"];
            string sharedBy = body["sharedBy"]?.ToString() ?? "Agent";

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                conn.Execute(@"
                    INSERT INTO associate_shares (associate_id, property_id, shared_by, shared_at)
                    VALUES (@associateId, @propertyId, @sharedBy, @sharedAt)",
                    new { associateId, propertyId, sharedBy, sharedAt = DateTime.UtcNow.ToString("o") });

                return Ok(new { success = true });
            }
        }
    }
}
