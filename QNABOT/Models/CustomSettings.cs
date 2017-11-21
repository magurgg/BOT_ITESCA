using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
namespace QNABOT.Models
{
    // Esto nos permite cargar las preferencias
    // del archivo appsettings.json
    public class CustomSettings
    {
        public string OcpApimSubscriptionKey { get; set; }
        public string KnowledgeBase { get; set; }
    }
}