using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Http;
using Npgsql;
using Dapper;
using VitragCRM.Backend.Data;
using VitragCRM.Backend.Models;
using VitragCRM.Backend.Filters;

namespace VitragCRM.Backend.Controllers
{
    [EmployeeMasking]
    public class CommissionsController : ApiController
    {
        private string GetConnString() => DbConnectionFactory.GetConnectionString();

        [HttpGet]
        [Route("api/commissions")]
        public IHttpActionResult GetCommissions([FromUri] string search = null)
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                string sql = "SELECT * FROM commissions";
                var paramsObj = new DynamicParameters();

                if (!string.IsNullOrEmpty(search))
                {
                    sql += " WHERE deal_name ILIKE @search OR payment_status ILIKE @search";
                    paramsObj.Add("search", $"%{search}%");
                }

                sql += " ORDER BY id DESC";

                var commissions = conn.Query<Commission>(sql, paramsObj).ToList();
                return Ok(commissions);
            }
        }

        [HttpPost]
        [Route("api/commissions")]
        public IHttpActionResult CreateCommission(Commission commission)
        {
            if (commission == null) return BadRequest("Commission data is empty.");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                commission.CreatedAt = DateTime.UtcNow.ToString("o");
                commission.PaymentStatus = string.IsNullOrEmpty(commission.PaymentStatus) ? "Pending" : commission.PaymentStatus;

                // Calculate commission amount if value and percentage exist
                if (commission.DealValue.HasValue && commission.CommissionPercentage.HasValue)
                {
                    commission.CommissionAmount = commission.DealValue.Value * (commission.CommissionPercentage.Value / 100);
                }

                string sql = @"
                    INSERT INTO commissions (deal_name, deal_value, commission_percentage, co_broker_payout, billing_invoice, expenses, payment_status, created_at, booking_date, agreement_date, registration_date, handover_date, commission_amount, associate_id, lead_id, property_id, custom_data)
                    VALUES (@DealName, @DealValue, @CommissionPercentage, @CoBrokerPayout, @BillingInvoice, @Expenses, @PaymentStatus, @CreatedAt, @BookingDate, @AgreementDate, @RegistrationDate, @HandoverDate, @CommissionAmount, @AssociateId, @LeadId, @PropertyId, CAST(@CustomData as jsonb))
                    RETURNING id;";

                int insertedId = conn.ExecuteScalar<int>(sql, commission);
                commission.Id = insertedId;
                return Ok(commission);
            }
        }

        [HttpPut]
        [Route("api/commissions/{id}")]
        public IHttpActionResult UpdateCommission(int id, Commission commission)
        {
            if (commission == null) return BadRequest("Commission data is empty.");

            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                commission.Id = id;

                // Calculate commission amount
                if (commission.DealValue.HasValue && commission.CommissionPercentage.HasValue)
                {
                    commission.CommissionAmount = commission.DealValue.Value * (commission.CommissionPercentage.Value / 100);
                }

                string sql = @"
                    UPDATE commissions 
                    SET deal_name = @DealName, deal_value = @DealValue, commission_percentage = @CommissionPercentage, 
                        co_broker_payout = @CoBrokerPayout, billing_invoice = @BillingInvoice, expenses = @Expenses, 
                        payment_status = @PaymentStatus, booking_date = @BookingDate, agreement_date = @AgreementDate, 
                        registration_date = @RegistrationDate, handover_date = @HandoverDate, 
                        commission_amount = @CommissionAmount, associate_id = @AssociateId, lead_id = @LeadId, 
                        property_id = @PropertyId, custom_data = CAST(@CustomData as jsonb)
                    WHERE id = @Id;";

                conn.Execute(sql, commission);
                return Ok(new { success = true });
            }
        }

        [HttpDelete]
        [Route("api/commissions/{id}")]
        public IHttpActionResult DeleteCommission(int id)
        {
            using (var conn = new NpgsqlConnection(GetConnString()))
            {
                conn.Open();
                conn.Execute("DELETE FROM commissions WHERE id = @id", new { id });
                return Ok(new { success = true });
            }
        }
    }
}
