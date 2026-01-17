// Gmail integration for sending quote emails
// Using Replit's Gmail connector
// WARNING: Never cache the Gmail client - access tokens expire
import { google } from 'googleapis';
import { storage } from './storage';

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Gmail not connected');
  }
  return accessToken;
}

async function getGmailClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

interface QuoteEmailData {
  customerName: string;
  customerEmail: string;
  deviceName: string;
  serviceName: string;
  price: string;
  repairTime?: string;
  warranty?: string;
}

function replaceMacros(template: string, data: QuoteEmailData): string {
  return template
    .replace(/\{customerName\}/g, data.customerName)
    .replace(/\{deviceName\}/g, data.deviceName)
    .replace(/\{serviceName\}/g, data.serviceName)
    .replace(/\{price\}/g, data.price)
    .replace(/\{repairTime\}/g, data.repairTime ? `Repair Time: ${data.repairTime}` : '')
    .replace(/\{warranty\}/g, data.warranty ? `Warranty: ${data.warranty}` : '');
}

const defaultEmailSubject = "Your Repair Quote: {serviceName} - ${price}";
const defaultEmailBody = `Dear {customerName},

Thank you for requesting a repair quote from RepairQuote!

Here are your quote details:

Device: {deviceName}
Service: {serviceName}
Estimated Price: ${"{price}"}
{repairTime}
{warranty}

To proceed with this repair, please reply to this email or visit our store.

Thank you for choosing RepairQuote!

Best regards,
The RepairQuote Team`;

export async function sendQuoteEmail(data: QuoteEmailData): Promise<boolean> {
  try {
    const gmail = await getGmailClient();
    
    // Fetch custom templates from database
    const subjectTemplate = await storage.getMessageTemplate('email_subject');
    const bodyTemplate = await storage.getMessageTemplate('email_body');
    
    const subject = replaceMacros(subjectTemplate?.content || defaultEmailSubject, data);
    const emailBody = replaceMacros(bodyTemplate?.content || defaultEmailBody, data).trim();
    
    const message = [
      `To: ${data.customerEmail}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      emailBody
    ].join('\n');

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    console.log(`Quote email sent to ${data.customerEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send quote email:', error);
    return false;
  }
}
