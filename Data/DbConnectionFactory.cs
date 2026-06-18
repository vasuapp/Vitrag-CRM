using System;
using System.Configuration;
using System.Text.RegularExpressions;

namespace VitragCRM.Backend.Data
{
    public static class DbConnectionFactory
    {
        public static string GetConnectionString()
        {
            // Check for DATABASE_URL environment variable first
            string dbUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
            if (string.IsNullOrWhiteSpace(dbUrl))
            {
                // Fall back to connection string in App.config
                return ConfigurationManager.ConnectionStrings["DefaultConnection"]?.ConnectionString;
            }

            try
            {
                // Parse standard Postgres URI format:
                // postgres://username:password@host:port/database
                // or postgresql://username:password@host:port/database
                var match = Regex.Match(dbUrl, @"^postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)$");
                if (!match.Success)
                {
                    throw new FormatException("DATABASE_URL format is not recognized. It should follow postgres://user:pass@host:port/db");
                }

                string user = match.Groups[1].Value;
                string pass = match.Groups[2].Value;
                string host = match.Groups[3].Value;
                string portStr = match.Groups[4].Value;
                string db = match.Groups[5].Value;

                int port = string.IsNullOrEmpty(portStr) ? 5432 : int.Parse(portStr);

                // Build a valid Npgsql connection string
                return $"Host={host};Port={port};Database={db};Username={user};Password={pass};SSL Mode=Prefer;Trust Server Certificate=true;Command Timeout=30;Connection Idle Lifetime=15;";
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error parsing DATABASE_URL connection string: {ex.Message}");
                // Fallback to App.config if parsing fails
                return ConfigurationManager.ConnectionStrings["DefaultConnection"]?.ConnectionString;
            }
        }
    }
}
