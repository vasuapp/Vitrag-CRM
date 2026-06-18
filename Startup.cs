using System;
using System.Web.Http;
using Owin;
using Microsoft.Owin.StaticFiles;
using Microsoft.Owin.FileSystems;
using Newtonsoft.Json.Serialization;
using Newtonsoft.Json;
using VitragCRM.Backend.Middleware;

namespace VitragCRM.Backend
{
    public class Startup
    {
        public void Configuration(IAppBuilder app)
        {
            // 1. Custom CORS Middleware
            app.Use(async (context, next) =>
            {
                context.Response.Headers.Set("Access-Control-Allow-Origin", "*");
                context.Response.Headers.Set("Access-Control-Allow-Headers", "Content-Type, x-agent-session, Cookie, Authorization");
                context.Response.Headers.Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

                if (context.Request.Method == "OPTIONS")
                {
                    context.Response.StatusCode = 200;
                    return;
                }

                await next();
            });

            // 2. Enable OWIN Session Authentication Middleware
            app.Use<SessionAuthenticationHandler>();

            // 3. Configure Web API
            HttpConfiguration config = new HttpConfiguration();
            
            // Enable Attribute Routing
            config.MapHttpAttributeRoutes();

            // Default Route Mapping
            config.Routes.MapHttpRoute(
                name: "DefaultApi",
                routeTemplate: "api/{controller}/{id}",
                defaults: new { id = RouteParameter.Optional }
            );

            // Configure CamelCase Serializer and JSON Formatting
            var jsonSettings = config.Formatters.JsonFormatter.SerializerSettings;
            jsonSettings.ContractResolver = new CamelCasePropertyNamesContractResolver();
            jsonSettings.NullValueHandling = NullValueHandling.Include;
            jsonSettings.ReferenceLoopHandling = ReferenceLoopHandling.Ignore;

            // Make JSON formatter the default formatter
            config.Formatters.Remove(config.Formatters.XmlFormatter);

            app.UseWebApi(config);

            // 4. Configure Static File Server to serve the frontend from './public'
            try
            {
                string publicPath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "public");
                if (!System.IO.Directory.Exists(publicPath))
                {
                    string tempPath = AppDomain.CurrentDomain.BaseDirectory;
                    while (!string.IsNullOrEmpty(tempPath))
                    {
                        string candidate = System.IO.Path.Combine(tempPath, "public");
                        if (System.IO.Directory.Exists(candidate))
                        {
                            publicPath = candidate;
                            break;
                        }
                        tempPath = System.IO.Path.GetDirectoryName(tempPath);
                    }
                }

                Console.WriteLine($"Serving static frontend files from: {publicPath}");

                var fileServerOptions = new FileServerOptions
                {
                    EnableDefaultFiles = true,
                    FileSystem = new PhysicalFileSystem(publicPath)
                };
                fileServerOptions.DefaultFilesOptions.DefaultFileNames = new[] { "index.html" };
                
                app.UseFileServer(fileServerOptions);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Warning: Failed to set up file server for static files: {ex.Message}");
            }
        }
    }
}
