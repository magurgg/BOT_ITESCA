using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Microsoft.Extensions.Options;
using System.Net.Http;
using System.Text;
using System.Net;
using System.IO;
using System.Net.Http.Headers;
using QNABOT.Models;

namespace QNABOT.Controllers
{
    public class HomeController : Controller
    {
        // Variables globales para retener la informacion
        private static string _OcpApimSubscriptionKey;
        private static string _KnowledgeBase;
        enum Mode { Add, Delete };
        //Obtenemos las dependencias de configuracion
        public HomeController(
            IOptions<CustomSettings> CustomSettings)
        {
            //Configuramos los valores de llaves
            _OcpApimSubscriptionKey = CustomSettings.Value.OcpApimSubscriptionKey;
            _KnowledgeBase = CustomSettings.Value.KnowledgeBase;
            var strFAQ = GetFAQ();
        }

        public async Task<ActionResult> Index(string searchString, string NewQuestion, string NewAnswer)
        {   
            QnAQuery objQnAResult = new QnAQuery();
            objQnAResult.Message = "";
            try
            {
                if (searchString != null)
                {
                    objQnAResult = await QueryQnABot(searchString);
                    Console.WriteLine("Pregunta: " + searchString);
                    String answer = objQnAResult.Answer;
                    Console.WriteLine("Respuesta: " + answer);
                    if (answer.Equals("No good match found in the KB"))
                    {
                        objQnAResult.Answer = "No tengo esa información a la mano, pero te contactaré con un ingeniero especializado en eso :)";
                        answer = "No tengo esa información a la mano, pero te contactaré con un ingeniero especializado en eso :)";
                    }
                    String link = "";
                    String link2 = "";
                    int index = answer.IndexOf("&lt;");
                    if (index > 0)
                    {
                        // Tiene imagen
                        link = answer.Substring(index + 4);
                        answer = answer.Remove(index);
                    }
                    else
                    {
                        index = answer.IndexOf("&gt;");
                        if (index > 0)
                        {
                            // Tiene video
                            link2 = answer.Substring(index + 4);
                            answer = answer.Remove(index);
                        }
                    }
                    Program.questions.Add(searchString);
                    Program.answers.Add(answer);
                    Program.images.Add(link);
                    Program.videos.Add(link2);
                }
                if (this.Request.ContentLength > 0)
                {
                    if (Request.Form["AddEntry"].Count() > 0)
                {
                    // El boton de agregar entrada fue presionado
                    if ((NewQuestion != null) && (NewAnswer != null))
                    {
                        // LLamamos al servicio de qna
                        objQnAResult.Message =
                            await UpdateQueryQnABot(NewQuestion, NewAnswer, Mode.Add);
                        objQnAResult.Message =
                            await TrainAndPublish();
                        var strFAQ = await GetFAQ();
                    }
                }
                else if (Request.Form["DeleteEntry"].Count() > 0)
                {
                    // El boton de eliminar entrada fue presionado
                    if ((NewQuestion != null) && (NewAnswer != null))
                    {
                        // LLamamos al servicio de qna
                        objQnAResult.Message =
                            await UpdateQueryQnABot(NewQuestion, NewAnswer, Mode.Delete);
                        objQnAResult.Message =
                            await TrainAndPublish();
                        var strFAQ = await GetFAQ();
                    }
                }
                }
                return View(objQnAResult);
            }
            catch (Exception ex)
            {
                ModelState.AddModelError(string.Empty, "Error: " + ex);
                return View(objQnAResult);
            }
        }

        public async Task<ActionResult> About(string NewQuestion, string NewAnswer)
        {
            QnAQuery objQnAResult = new QnAQuery();
            objQnAResult.Message = "";
            try
            {
                if (this.Request.ContentLength > 0)
                {
                    if (Request.Form["AddEntry"].Count() > 0)
                    {
                        // El agregar entrada se ejecuta
                        if ((NewQuestion != null) && (NewAnswer != null))
                        {
                            // Llamamos a los servicios del qna
                            objQnAResult.Message =
                                await UpdateQueryQnABot(NewQuestion, NewAnswer, Mode.Add);
                            objQnAResult.Message =
                                await TrainAndPublish();
                            var strFAQ = await GetFAQ();
                        }
                    }
                    else if (Request.Form["DeleteEntry"].Count() > 0)
                    {
                        // Eliminar entrada se ejecuta
                        if ((NewQuestion != null) && (NewAnswer != null))
                        {
                            // Llamamos a los servicios del qna
                            objQnAResult.Message =
                                await UpdateQueryQnABot(NewQuestion, NewAnswer, Mode.Delete);
                            objQnAResult.Message =
                                await TrainAndPublish();
                            var strFAQ = await GetFAQ();
                        }
                    }
                }
                return View(objQnAResult);
            }
            catch (Exception ex)
            {
                ModelState.AddModelError(string.Empty, "Error: " + ex);
                return View(objQnAResult);
            }
        }

        public IActionResult Error()
        {
            return View();
        }

        private static async Task<QnAQuery> QueryQnABot(string Query)
        {
            QnAQuery QnAQueryResult = new QnAQuery();
            using (System.Net.Http.HttpClient client =
                new System.Net.Http.HttpClient())
            {
                string RequestURI = String.Format("{0}{1}{2}{3}{4}",
                    @"https://westus.api.cognitive.microsoft.com/",
                    @"qnamaker/v1.0/",
                    @"knowledgebases/",
                    _KnowledgeBase,
                    @"/generateAnswer");
                var httpContent =
                    new StringContent($"{{\"question\": \"{Query}\"}}",
                    Encoding.UTF8, "application/json");
                httpContent.Headers.Add(
                    "Ocp-Apim-Subscription-Key", _OcpApimSubscriptionKey);
                System.Net.Http.HttpResponseMessage msg =
                    await client.PostAsync(RequestURI, httpContent);
                if (msg.IsSuccessStatusCode)
                {
                    var JsonDataResponse =
                        await msg.Content.ReadAsStringAsync();
                    QnAQueryResult =
                        JsonConvert.DeserializeObject<QnAQuery>(JsonDataResponse);
                }
            }
            return QnAQueryResult;
        }

        private static async Task<string> GetFAQ()
        {
            string strFAQUrl = "";
            string strLine;
            StringBuilder sb = new StringBuilder();

            // obtenemos la url de las faq
            using (System.Net.Http.HttpClient client =
                new System.Net.Http.HttpClient())
            {
                string RequestURI = String.Format("{0}{1}{2}{3}{4}",
                    @"https://westus.api.cognitive.microsoft.com/",
                    @"qnamaker/v2.0/",
                    @"knowledgebases/",
                    _KnowledgeBase,
                    @"? ");

                client.DefaultRequestHeaders.Add(
                    "Ocp-Apim-Subscription-Key", _OcpApimSubscriptionKey);

                System.Net.Http.HttpResponseMessage msg =
                    await client.GetAsync(RequestURI);

                if (msg.IsSuccessStatusCode)
                {
                    var JsonDataResponse =
                        await msg.Content.ReadAsStringAsync();

                    strFAQUrl =
                        JsonConvert.DeserializeObject<string>(JsonDataResponse);
                }
            }

            // hacemos una solicitud para las llamadas de contenido
            var req = WebRequest.Create(strFAQUrl);
            var r = await req.GetResponseAsync().ConfigureAwait(false);

            // Limpiamos las respuestas
            Program.questionTable.Clear();
            Program.answersTable.Clear();
            using (var responseReader = new StreamReader(r.GetResponseStream()))
            {
                // Leemos cada linea de respuesta
                while ((strLine = responseReader.ReadLine()) != null)
                {

                    // Leer el contenido del constructor de cadenas
                    string[] strCurrentLine = strLine.Split('\t');

                    Program.questionTable.Add(strCurrentLine[0]);
                    Program.answersTable.Add(strCurrentLine[1]);

                    sb.Append((String.Format("{0},{1},{2}\n",
                        CleanContent(strCurrentLine[0]),
                        CleanContent(strCurrentLine[1]),
                        CleanContent(strCurrentLine[2])
                        )));
                }
            }
            Program.questionTable.RemoveAt(0);
            Program.answersTable.RemoveAt(0);

            // regresa el contenido del constructor de cadenas
            return "hi";
        }

        private static async Task<string> UpdateQueryQnABot(string newQuestion, string newAnswer, Mode paramMode)
        {
            string strResponse = "";
            // crea una entrada de base de conocimiento
            QnAKnowledgeBase objQnAKnowledgeBase = new QnAKnowledgeBase();
            QnaPair objQnaPair = new QnaPair();
            objQnaPair.question = newQuestion;
            objQnaPair.answer = newAnswer;

            if (paramMode == Mode.Add)
            {
                Add objAdd = new Add();
                objAdd.qnaPairs = new List<QnaPair>();
                objAdd.urls = new List<string>();
                objAdd.qnaPairs.Add(objQnaPair);
                objQnAKnowledgeBase.add = objAdd;
            }

            if (paramMode == Mode.Delete)
            {
                Delete objDelete = new Delete();
                objDelete.qnaPairs = new List<QnaPair>();
                objDelete.urls = new List<string>();
                objDelete.qnaPairs.Add(objQnaPair);
                objQnAKnowledgeBase.delete = objDelete;
            }

            using (System.Net.Http.HttpClient client =
                new System.Net.Http.HttpClient())
            {
                string RequestURI = String.Format("{0}{1}{2}{3}? ",
                    @"https://westus.api.cognitive.microsoft.com/",
                    @"qnamaker/v2.0/",
                    @"knowledgebases/",
                    _KnowledgeBase);

                using (HttpRequestMessage request =
                    new HttpRequestMessage(new HttpMethod("PATCH"), RequestURI))
                {
                    request.Content = new StringContent(
                        JsonConvert.SerializeObject(objQnAKnowledgeBase),
                        System.Text.Encoding.UTF8, "application/json");

                    request.Content.Headers.Add(
                        "Ocp-Apim-Subscription-Key",
                        _OcpApimSubscriptionKey);

                    HttpResponseMessage response = await client.SendAsync(request);
                    if (response.IsSuccessStatusCode)
                    {
                        strResponse = $"Operation {paramMode} completed.";
                    }
                    else
                    {
                        string responseContent =
                            await response.Content.ReadAsStringAsync();

                        strResponse = responseContent;
                    }
                }
            }

            return strResponse;
        }

        private static async Task<string> TrainAndPublish()
        {
            string strResponse = "";

            using (System.Net.Http.HttpClient client =
                new System.Net.Http.HttpClient())
            {
                string RequestURI = String.Format("{0}{1}{2}{3}",
                    @"https://westus.api.cognitive.microsoft.com/",
                    @"qnamaker/v2.0/",
                    @"knowledgebases/",
                    _KnowledgeBase);

                var httpContent =
                    new StringContent("",
                    Encoding.UTF8, "application/json");

                httpContent.Headers.Add(
                    "Ocp-Apim-Subscription-Key", _OcpApimSubscriptionKey);

                System.Net.Http.HttpResponseMessage response =
                    await client.PutAsync(RequestURI, httpContent);

                if (response.IsSuccessStatusCode)
                {
                    strResponse = $"Operation Train and Publish completed.";
                }
                else
                {
                    string responseContent =
                        await response.Content.ReadAsStringAsync();

                    strResponse = responseContent;
                }
            }

            return strResponse;
        }

        private static string CleanContent(string paramString)
        {
            // limpia saltos de linea
            paramString = paramString.Replace(@"\n", "");

            // limpia comas
            // paramString = paramString.Replace(",", "");

            // limpia ultima coma
            paramString = paramString.Remove(paramString.Length - 1);

            return paramString;
        }
    }
}
