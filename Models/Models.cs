using System;
using System.Collections.Generic;

namespace VitragCRM.Backend.Models
{
    public class Lead
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Phone { get; set; }
        public string Email { get; set; }
        public string Source { get; set; }
        public string Status { get; set; }
        public string Stage { get; set; }
        public string ProjectType { get; set; }
        public decimal? BudgetMin { get; set; }
        public decimal? BudgetMax { get; set; }
        public string Notes { get; set; }
        public string NextFollowup { get; set; }
        public string FollowupStatus { get; set; }
        public string Touchpoint { get; set; }
        public int? AssociateId { get; set; }
        public string CreatedAt { get; set; }
        public int? AgentId { get; set; }
        public string AgentName { get; set; }
        public string SpecialTags { get; set; }
        public string Documents { get; set; }
        public string LocationPreference { get; set; }
        public string ConfigBhk { get; set; }
        public string TimelinePreference { get; set; }
        public string RentalExpiryDate { get; set; }
        public int LeadScore { get; set; } = 15;
        public string DeletedAt { get; set; }
        public string AdminComments { get; set; }
        public string PropertyRequirement { get; set; }
        public string CustomLeadId { get; set; }
        public string CustomData { get; set; } = "{}";
        public bool ClosureSiteVisit { get; set; }
        public bool ClosureNegotiation { get; set; }
        public bool ClosureAgreement { get; set; }
        public bool ClosureRegistration { get; set; }
        public bool ClosureClosed { get; set; }
        public string ClosurePropId { get; set; }
        public decimal? ClosureCommissionAmt { get; set; }
        public string ClosureNotes { get; set; }
        public int? ProjectId { get; set; }
        public bool ClosureJointVisit { get; set; }
    }

    public class Property
    {
        public int Id { get; set; }
        public string PropId { get; set; }
        public string MandateType { get; set; }
        public string PropertyType { get; set; }
        public string Society { get; set; }
        public string Location { get; set; }
        public string Status { get; set; } = "AVAILABLE";
        public string SiteArea { get; set; }
        public decimal? AreaSqft { get; set; }
        public string Configuration { get; set; }
        public string FloorInfo { get; set; }
        public string FloorRange { get; set; }
        public string Interiors { get; set; }
        public string Facing { get; set; }
        public string Amenities { get; set; }
        public string CarPark { get; set; }
        public decimal? Price { get; set; }
        public string PriceRaw { get; set; }
        public string Possession { get; set; }
        public string ProjectSize { get; set; }
        public string ProjectStatus { get; set; }
        public string AdditionalInfo { get; set; }
        public string VideoLink { get; set; }
        public string PhotoLink { get; set; }
        public string BrochureLink { get; set; }
        public string OwnerName { get; set; }
        public string OwnerPhone { get; set; }
        public string OwnerEmail { get; set; }
        public string UnitNo { get; set; }
        public string RegistrationStatus { get; set; }
        public string Source { get; set; }
        public string SubSource { get; set; }
        public string Comments { get; set; }
        public decimal? Maintenance { get; set; }
        public decimal? Deposit { get; set; }
        public string AvailableFrom { get; set; }
        public string DateOfInventory { get; set; }
        public string AvailableFor { get; set; }
        public string PlotSize { get; set; }
        public string Sba { get; set; }
        public int? AssociateId { get; set; }
        public string SpecialTags { get; set; }
        public string LastUpdated { get; set; }
        public string SyncStatus { get; set; } = "NOT_SYNCED";
        public string Zone { get; set; }
        public string OnboardedYear { get; set; }
        public string PlotDimension { get; set; }
        public string HouseFacing { get; set; }
        public string PlotFacing { get; set; }
        public string HolderType { get; set; }
        public string DeletedAt { get; set; }
        public string AdminComments { get; set; }
        public int? ProjectId { get; set; }
        public int? AgentId { get; set; }
        public string CommissionAgreed { get; set; }
        public string GoogleMapUrl { get; set; }
        public string RoadWidth { get; set; }
        public string Fsi { get; set; }
        public bool ClosureSiteVisit { get; set; }
        public bool ClosureNegotiation { get; set; }
        public bool ClosureAgreement { get; set; }
        public bool ClosureRegistration { get; set; }
        public bool ClosureClosed { get; set; }
        public string ClosureBuyerName { get; set; }
        public string ClosureBuyerPhone { get; set; }
        public decimal? ClosureDealValue { get; set; }
        public decimal? ClosureCommissionPct { get; set; }
        public string ClosureDate { get; set; }
        public string ClosureNotes { get; set; }
        public bool ClosureJointVisit { get; set; }
        public decimal? ClosureCommissionAmt { get; set; }
        public string CustomData { get; set; } = "{}";
    }

    public class BuilderProject
    {
        public int Id { get; set; }
        public string BuilderName { get; set; }
        public string ProjectName { get; set; }
        public string Location { get; set; }
        public string LandParcel { get; set; }
        public string Tower { get; set; }
        public string Elevation { get; set; }
        public string Configuration { get; set; }
        public string CarpetArea { get; set; }
        public string PriceFinal { get; set; }
        public string UcRtmi { get; set; }
        public string Possession { get; set; }
        public string Subvention { get; set; }
        public string ClpDue { get; set; }
        public string FloorRise { get; set; }
        public string LocationUsp { get; set; }
        public string MetroStation { get; set; }
        public string OtherUsp { get; set; }
        public string SpecialTags { get; set; }
        public string CreatedAt { get; set; }
        public string BrochureLink { get; set; }
        public string FloorPlans { get; set; }
        public string MotherDocs { get; set; }
        public string Assignments { get; set; }
        public string KycDocs { get; set; }
        public string Photos { get; set; }
        public string Videos { get; set; }
        public string CpAgreements { get; set; }
        public string BuilderDetails { get; set; }
        public string FinanceInfo { get; set; }
        public string AnalyticsInfo { get; set; }
        public string Zone { get; set; }
        public string OnboardedYear { get; set; }
        public string ProjId { get; set; }
        public string GoogleMapUrl { get; set; }
        public string UnitDetails { get; set; }
        public string BuilderPocDetails { get; set; }
        public string PlotDimension { get; set; }
        public string PlotSize { get; set; }
        public string HouseFacing { get; set; }
        public string PlotFacing { get; set; }
        public string DeletedAt { get; set; }
        public string AdminComments { get; set; }
        public string CustomData { get; set; } = "{}";
    }

    public class DailyChecklistItem
    {
        public int Id { get; set; }
        public string ItemName { get; set; }
        public string RoutineType { get; set; }
        public int IsChecked { get; set; }
        public string RoutineDate { get; set; }
    }

    public class Associate
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Company { get; set; }
        public string Phone { get; set; }
        public string Email { get; set; }
        public decimal? CoBrokerageShare { get; set; }
        public int? Rating { get; set; }
        public string SpecialityZones { get; set; }
        public string LinkedInventories { get; set; }
        public int IsInnerCircle { get; set; }
        public int? AgentId { get; set; }
    }

    public class Commission
    {
        public int Id { get; set; }
        public string DealName { get; set; }
        public decimal? DealValue { get; set; }
        public decimal? CommissionPercentage { get; set; }
        public decimal? CoBrokerPayout { get; set; }
        public string BillingInvoice { get; set; }
        public decimal? Expenses { get; set; }
        public string PaymentStatus { get; set; } = "Pending";
        public string CreatedAt { get; set; }
        public string BookingDate { get; set; }
        public string AgreementDate { get; set; }
        public string RegistrationDate { get; set; }
        public string HandoverDate { get; set; }
        public decimal? CommissionAmount { get; set; }
        public int? AssociateId { get; set; }
        public int? LeadId { get; set; }
        public int? PropertyId { get; set; }
        public string CustomData { get; set; } = "{}";
    }

    public class TodoTask
    {
        public int Id { get; set; }
        public string Task { get; set; }
        public string Status { get; set; } = "Incomplete";
        public string DueDate { get; set; }
        public string Priority { get; set; } = "Medium";
    }

    public class Scratchpad
    {
        public int Id { get; set; }
        public string Content { get; set; }
        public string UpdatedAt { get; set; }
    }

    public class Habit
    {
        public int Id { get; set; }
        public string HabitName { get; set; }
        public string HabitDate { get; set; }
        public int IsDone { get; set; }
        public int? AgentId { get; set; }
    }

    public class Agent
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
        public string Phone { get; set; }
        public string Status { get; set; } = "ACTIVE";
        public string LocationSpecialty { get; set; }
        public int LeadsAssigned { get; set; }
        public string Role { get; set; } = "Agent";
        public string LoginPin { get; set; }
        public string AllowedPages { get; set; }
        public int PerformanceRating { get; set; } = 5;
    }

    public class DripCampaign
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Channel { get; set; }
        public string TargetLeadsStatus { get; set; }
        public string SequenceData { get; set; }
        public int IsActive { get; set; } = 1;
    }

    public class DripLog
    {
        public int Id { get; set; }
        public int? LeadId { get; set; }
        public string LeadName { get; set; }
        public int? CampaignId { get; set; }
        public string CampaignName { get; set; }
        public int StepIndex { get; set; }
        public string Message { get; set; }
        public string ScheduledDate { get; set; }
        public string SentDate { get; set; }
        public string Status { get; set; } = "SENT";
    }

    public class AutoAssignmentSetting
    {
        public int Id { get; set; }
        public string RuleType { get; set; } = "ROUND_ROBIN";
        public int IsActive { get; set; } = 1;
    }

    public class TelephonyCall
    {
        public int Id { get; set; }
        public int? LeadId { get; set; }
        public string LeadName { get; set; }
        public int? AgentId { get; set; }
        public string AgentName { get; set; }
        public int Duration { get; set; }
        public string RecordingUrl { get; set; }
        public string CallNotes { get; set; }
        public string CreatedAt { get; set; }
    }

    public class Proposal
    {
        public int Id { get; set; }
        public string Token { get; set; }
        public int? LeadId { get; set; }
        public string Title { get; set; }
        public string IntroMessage { get; set; }
        public string CreatedAt { get; set; }
        public List<Property> Items { get; set; }
    }

    public class ProposalItem
    {
        public int Id { get; set; }
        public int? ProposalId { get; set; }
        public int? PropertyId { get; set; }
        public string AgentComments { get; set; }
    }

    public class ClientMessage
    {
        public int Id { get; set; }
        public int? LeadId { get; set; }
        public string Sender { get; set; }
        public string Message { get; set; }
        public string CreatedAt { get; set; }
    }

    public class LeadTimeline
    {
        public int Id { get; set; }
        public int LeadId { get; set; }
        public string EventType { get; set; }
        public string EventDescription { get; set; }
        public string CreatedAt { get; set; }
    }

    public class LeadScorecard
    {
        public int Id { get; set; }
        public int LeadId { get; set; }
        public int Budget { get; set; } = 3;
        public int Timeline { get; set; } = 3;
        public int Funding { get; set; } = 3;
        public int Responsiveness { get; set; } = 3;
        public int Clarity { get; set; } = 3;
        public string UpdatedAt { get; set; }
    }

    public class AttendanceLog
    {
        public int Id { get; set; }
        public int AgentId { get; set; }
        public string AgentName { get; set; }
        public string ClockIn { get; set; }
        public string ClockOut { get; set; }
        public string AttendanceDate { get; set; }
    }

    public class InteractionLog
    {
        public int Id { get; set; }
        public int LeadId { get; set; }
        public string InteractionType { get; set; }
        public string Notes { get; set; }
        public string CreatedAt { get; set; }
    }

    public class SequenceCounter
    {
        public string CategoryKey { get; set; }
        public int LastValue { get; set; } = 150;
    }

    public class LeadActivity
    {
        public int Id { get; set; }
        public int LeadId { get; set; }
        public string Type { get; set; }
        public string Description { get; set; }
        public string Timestamp { get; set; }
    }

    public class LeadPropertyInterest
    {
        public int Id { get; set; }
        public int LeadId { get; set; }
        public int PropertyId { get; set; }
        public string Status { get; set; } = "Interested";
        public string Timestamp { get; set; }
    }

    public class Invoice
    {
        public int Id { get; set; }
        public string InvoiceNo { get; set; }
        public string InvoiceDate { get; set; }
        public string ClientName { get; set; }
        public string ClientGstin { get; set; }
        public string ClientAddress { get; set; }
        public string ProjectDeal { get; set; }
        public string Description { get; set; }
        public decimal? Amount { get; set; }
        public decimal? Cgst { get; set; }
        public decimal? Sgst { get; set; }
        public decimal? Total { get; set; }
        public string PaymentStatus { get; set; } = "Pending";
        public string BrokerName { get; set; } = "Ms Vasu Jain";
        public string BrokerAddress { get; set; }
        public string BrokerEmail { get; set; }
        public string BrokerPhone { get; set; }
        public string BrokerRera { get; set; }
        public string BrokerGstin { get; set; }
        public string BankName { get; set; }
        public string BankAccount { get; set; }
        public string BankIfsc { get; set; }
        public string BankAccountType { get; set; }
        public string BankBranch { get; set; }
        public string Terms { get; set; }
        public string UploadedFilePath { get; set; }
        public string CreatedAt { get; set; }
        public string Items { get; set; }
    }

    public class Sop
    {
        public int Id { get; set; }
        public string Title { get; set; }
        public string Steps { get; set; }
        public string CreatedAt { get; set; }
    }

    public class CommunicationTemplate
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Platform { get; set; }
        public string UseCase { get; set; }
        public string Content { get; set; }
        public string CreatedAt { get; set; }
    }

    public class AssociateShare
    {
        public int Id { get; set; }
        public int AssociateId { get; set; }
        public int PropertyId { get; set; }
        public string SharedAt { get; set; }
        public string SharedBy { get; set; }
    }

    public class DocumentVault
    {
        public int Id { get; set; }
        public string DocName { get; set; }
        public string DocUrl { get; set; }
        public string ReferenceType { get; set; }
        public int ReferenceId { get; set; }
        public string ReferenceName { get; set; }
        public string CreatedAt { get; set; }
        public string UploadedBy { get; set; }
    }

    public class SystemSetting
    {
        public string Key { get; set; }
        public string Value { get; set; }
    }

    public class DuplicateLeadsAudit
    {
        public int Id { get; set; }
        public string LeadName { get; set; }
        public string Phone { get; set; }
        public string Email { get; set; }
        public string Source { get; set; }
        public int? ExistingLeadId { get; set; }
        public string ExistingLeadName { get; set; }
        public string DetectedAt { get; set; }
        public string ActionTaken { get; set; } = "Pending Review";
    }

    public class CustomForm
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string ModuleType { get; set; }
        public string Sections { get; set; } = "[]";
        public string CreatedAt { get; set; }
        public string UpdatedAt { get; set; }
    }

    public class CustomTable
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public string Fields { get; set; } = "[]";
        public string CreatedAt { get; set; }
        public string UpdatedAt { get; set; }
    }

    public class CustomTableRow
    {
        public int Id { get; set; }
        public int TableId { get; set; }
        public string Data { get; set; } = "{}";
        public string CreatedAt { get; set; }
        public string UpdatedAt { get; set; }
    }

    public class CustomWorkflow
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string ModuleType { get; set; }
        public string TriggerEvent { get; set; }
        public string TriggerConditions { get; set; } = "{}";
        public string ActionType { get; set; }
        public string ActionConfig { get; set; } = "{}";
        public bool IsActive { get; set; } = true;
        public string CreatedAt { get; set; }
        public string UpdatedAt { get; set; }
    }
}
