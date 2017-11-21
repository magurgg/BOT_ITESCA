using System;
using System.Collections.Generic;
using System.IO;
using System.Collections;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;

namespace QNABOT
{
    public class Program
    {
        public static ArrayList questions = new ArrayList();
        public static ArrayList answers = new ArrayList();
        public static ArrayList answersTable = new ArrayList();
        public static ArrayList questionTable = new ArrayList();
        public static ArrayList images = new ArrayList();
        public static ArrayList videos = new ArrayList();

        public static void Main(string[] args)
        {
            var host = new WebHostBuilder()
                .UseKestrel()
                .UseContentRoot(Directory.GetCurrentDirectory())
                .UseIISIntegration()
                .UseStartup<Startup>()
                .UseApplicationInsights()
                .Build();
            host.Run();
            
        }
    }
}
