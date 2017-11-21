using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
namespace QNABOT.Models
{
    //Sirve para guardar información cuando nos comuniquemos con el servicio qna
    public class QnAQuery
    {
        [JsonProperty(PropertyName = "question")]
        public string Question { get; set; }

        [JsonProperty(PropertyName = "answer")]
        public string Answer { get; set; }

        [JsonProperty(PropertyName = "score")]
        public double Score { get; set; }

        public string Message { get; set; }
    }
}