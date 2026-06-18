using System;
using System.Configuration;
using Microsoft.Owin.Hosting;
using VitragCRM.Backend.Data;

namespace VitragCRM.Backend
{
    class Program
    {
        static void Main(string[] args)
        {
            // Force unbuffered console output for real-time Docker/Railway logs
            try {
                var stdout = new System.IO.StreamWriter(Console.OpenStandardOutput()) { AutoFlush = true };
                Console.SetOut(stdout);
                var stderr = new System.IO.StreamWriter(Console.OpenStandardError()) { AutoFlush = true };
                Console.SetError(stderr);
            } catch { }

            try
            {
                Console.WriteLine("Starting Vitrag CRM C# Backend Server...");

                // 1. Run database initialization and schema migration
                DbInitializer.Initialize();

                // 2. Read Port Configuration
                string portStr = Environment.GetEnvironmentVariable("PORT");
                if (string.IsNullOrWhiteSpace(portStr))
                {
                    portStr = ConfigurationManager.AppSettings["PORT"] ?? "5001";
                }

                if (!int.TryParse(portStr, out int port))
                {
                    port = 5001;
                }

                // Bind to all network interfaces (needed for Docker / Railway)
                string baseUri = $"http://*:{port}/";

                Console.WriteLine($"Starting OWIN Self-Host on {baseUri}");

                // 3. Start the Web Server
                using (WebApp.Start<Startup>(url: baseUri))
                {
                    Console.WriteLine($"Server is live. Listening on port {port}.");
                    Console.WriteLine("Press Ctrl+C to exit.");
                    
                    // Keep the console application running
                    System.Threading.Thread.Sleep(System.Threading.Timeout.Infinite);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"CRITICAL ERROR: Server failed to start: {ex.Message}");
                Console.WriteLine(ex.StackTrace);
                Environment.Exit(1);
            }
        }
    }
}
