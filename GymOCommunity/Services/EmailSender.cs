using System.Net;
using System.Net.Mail;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Identity.UI.Services;

public class EmailSender : IEmailSender
{
    private readonly IConfiguration _configuration;

    public EmailSender(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public async Task SendEmailAsync(string email, string subject, string htmlMessage)
    {
        var smtpServer = _configuration["EmailSettings:SmtpServer"];
        var smtpPort = int.Parse(_configuration["EmailSettings:SmtpPort"]);
        var senderEmail = _configuration["EmailSettings:SenderEmail"];
        var senderPassword = _configuration["EmailSettings:SenderPassword"];

        // ⚙️ Cấu hình chung để tránh lỗi HELO invalid
        ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
        ServicePointManager.ServerCertificateValidationCallback = delegate { return true; };

        using (var client = new SmtpClient(smtpServer, smtpPort))
        {
            client.Credentials = new NetworkCredential(senderEmail, senderPassword);
            client.EnableSsl = true;
            client.DeliveryMethod = SmtpDeliveryMethod.Network;

            // 👇 Nếu dùng Gmail, bật dòng này
            if (smtpServer.Contains("gmail"))
                client.TargetName = "STARTTLS/smtp.gmail.com";

            var mailMessage = new MailMessage
            {
                From = new MailAddress(senderEmail, "GymOCommunity"),
                Subject = subject,
                Body = htmlMessage,
                IsBodyHtml = true
            };

            
        }
    }
}
