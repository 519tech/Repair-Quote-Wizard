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
  serviceDescription?: string;
  price: string;
  repairTime?: string;
  warranty?: string;
}

function cleanupSingleServicePlaceholders(text: string): string {
  return text
    .replace(/\{[a-zA-Z]+\}/g, '')
    .replace(/^\s*[\r\n]/gm, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function replaceMacros(template: string, data: QuoteEmailData): string {
  const result = template
    .replace(/\{customerName\}/g, data.customerName)
    .replace(/\{deviceName\}/g, data.deviceName)
    .replace(/\{serviceName\}/g, data.serviceName)
    .replace(/\{serviceDescription\}/g, data.serviceDescription || '')
    .replace(/\{price\}/g, data.price)
    .replace(/\{repairTime\}/g, data.repairTime ? `Repair Time: ${data.repairTime}` : '')
    .replace(/\{warranty\}/g, data.warranty ? `Warranty: ${data.warranty}` : '');
  
  return cleanupSingleServicePlaceholders(result);
}

const defaultEmailSubject = "Your Repair Quote: {serviceName} - ${price} plus taxes";
const defaultEmailBody = `Dear {customerName},

Thank you for requesting a repair quote from RepairQuote!

Here are your quote details:

Device: {deviceName}
Service: {serviceName}
Estimated Price: ${"{price}"} plus taxes
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

// Combined multi-service quote email
interface CombinedQuoteEmailData {
  customerName: string;
  customerEmail: string;
  deviceName: string;
  services: Array<{
    serviceName: string;
    serviceDescription?: string;
    price: string;
    repairTime?: string;
    warranty?: string;
  }>;
  grandTotal: string;
  multiServiceDiscount?: string;
}

const defaultServiceItemTemplate = `{serviceName}
$\{servicePrice} plus taxes
{repairTime}
{warranty}`;

function buildServicesList(services: CombinedQuoteEmailData['services'], serviceItemTemplate: string): string {
  return services.map(s => {
    return serviceItemTemplate
      .replace(/\{serviceName\}/g, s.serviceName)
      .replace(/\{servicePrice\}/g, s.price)
      .replace(/\{repairTime\}/g, s.repairTime || '')
      .replace(/\{warranty\}/g, s.warranty || '')
      .replace(/\{serviceDescription\}/g, s.serviceDescription || '');
  }).join('\n\n');
}

function cleanupEmptyPlaceholders(text: string): string {
  return text
    .replace(/\{[a-zA-Z]+\}/g, '')
    .replace(/^\s*[\r\n]/gm, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function replaceCombinedEmailMacros(template: string, data: CombinedQuoteEmailData): Promise<string> {
  const serviceNames = data.services.map(s => s.serviceName).join(', ');
  const serviceDescriptions = data.services.map(s => s.serviceDescription).filter(Boolean).join('; ');
  const repairTimes = data.services.map(s => s.repairTime).filter(Boolean).join(', ');
  const warranties = data.services.map(s => s.warranty).filter(Boolean).join(', ');
  
  const serviceItemTemplate = await storage.getMessageTemplate('service_item_template');
  const servicesList = buildServicesList(data.services, serviceItemTemplate?.content || defaultServiceItemTemplate);
  
  const result = template
    .replace(/\{customerName\}/g, data.customerName)
    .replace(/\{deviceName\}/g, data.deviceName)
    .replace(/\{serviceName\}/g, serviceNames)
    .replace(/\{serviceDescription\}/g, serviceDescriptions)
    .replace(/\{price\}/g, data.grandTotal)
    .replace(/\{repairTime\}/g, repairTimes)
    .replace(/\{warranty\}/g, warranties)
    .replace(/\{servicesList\}/g, servicesList)
    .replace(/\{multiServiceDiscount\}/g, data.multiServiceDiscount ? `Multi-Service Discount: $${data.multiServiceDiscount}` : '');
  
  return cleanupEmptyPlaceholders(result);
}

export async function sendCombinedQuoteEmail(data: CombinedQuoteEmailData): Promise<boolean> {
  try {
    const gmail = await getGmailClient();
    
    const subjectTemplate = await storage.getMessageTemplate('email_subject');
    const bodyTemplate = await storage.getMessageTemplate('email_body');
    
    const defaultSubject = "Your Repair Quote: {serviceName} - ${price} plus taxes";
    const defaultBody = `Dear {customerName},

Thank you for requesting a repair quote from RepairQuote!

Here are your quote details:

Device: {deviceName}

{servicesList}

Total: $\{price} plus taxes

To proceed with this repair, please reply to this email or visit our store.

Thank you for choosing RepairQuote!

Best regards,
The RepairQuote Team`;

    const subject = await replaceCombinedEmailMacros(subjectTemplate?.content || defaultSubject, data);
    const emailBody = await replaceCombinedEmailMacros(bodyTemplate?.content || defaultBody, data);

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

    console.log(`Combined quote email sent to ${data.customerEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send combined quote email:', error);
    return false;
  }
}

// Admin notification email for quote submissions
interface AdminNotificationData {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  deviceName: string;
  services: Array<{
    serviceName: string;
    price: string;
    repairTime?: string;
    warranty?: string;
  }>;
  grandTotal: string;
  multiServiceDiscount?: string;
  notes?: string;
}

export async function sendAdminNotificationEmail(data: AdminNotificationData): Promise<boolean> {
  try {
    // Get admin email from settings
    const adminEmailSetting = await storage.getMessageTemplate('admin_notification_email');
    if (!adminEmailSetting?.content) {
      console.log('Admin notification email not configured');
      return false;
    }
    
    const gmail = await getGmailClient();
    
    const servicesList = data.services.map(s => 
      `- ${s.serviceName}: $${s.price}${s.repairTime ? ` (${s.repairTime})` : ''}${s.warranty ? ` - ${s.warranty} warranty` : ''}`
    ).join('\n');

    const subject = `New Quote Request - ${data.customerName} - $${data.grandTotal}`;
    const discountLine = data.multiServiceDiscount ? `\nMulti-Service Discount: -$${data.multiServiceDiscount}` : '';
    const emailBody = `New Quote Request Received

Customer Information:
- Name: ${data.customerName}
- Email: ${data.customerEmail}
- Phone: ${data.customerPhone || 'Not provided'}

Device: ${data.deviceName}

Selected Services:
${servicesList}
${discountLine}
Grand Total: $${data.grandTotal} plus taxes

${data.notes ? `Customer Notes:\n${data.notes}` : ''}
-------------------
This is an automated notification from RepairQuote.`;

    const messageHeaders = [
      `To: ${adminEmailSetting.content}`,
      `Subject: ${subject}`,
    ];
    
    if (data.customerEmail) {
      messageHeaders.push(`Reply-To: ${data.customerEmail}`);
    }
    
    messageHeaders.push('Content-Type: text/plain; charset=utf-8');
    
    const message = [...messageHeaders, '', emailBody].join('\n');

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

    console.log(`Admin notification email sent to ${adminEmailSetting.content} (reply-to: ${data.customerEmail || 'none'})`);
    return true;
  } catch (error) {
    console.error('Failed to send admin notification email:', error);
    return false;
  }
}

// Unknown device quote email
interface UnknownDeviceQuoteEmailData {
  customerName: string;
  customerEmail: string;
  deviceDescription: string;
  issueDescription: string;
}

export async function sendUnknownDeviceQuoteEmail(data: UnknownDeviceQuoteEmailData): Promise<boolean> {
  try {
    const gmail = await getGmailClient();
    
    // Fetch custom template from database
    const bodyTemplate = await storage.getMessageTemplate('unknown_device_email');
    
    const defaultBody = `Dear ${data.customerName},

Thank you for contacting RepairQuote!

We have received your repair inquiry. Our team will review your device details and get back to you with a quote as soon as possible.

Your submitted information:
- Device Description: ${data.deviceDescription}
- Issue: ${data.issueDescription}

We will contact you shortly at this email address with a personalized quote.

Thank you for choosing RepairQuote!

Best regards,
The RepairQuote Team`;

    const emailBody = bodyTemplate?.content
      ?.replace(/\{customerName\}/g, data.customerName)
      ?.replace(/\{deviceDescription\}/g, data.deviceDescription)
      ?.replace(/\{issueDescription\}/g, data.issueDescription)
      || defaultBody;

    const subject = `Your Repair Inquiry - We'll Get Back to You Soon`;

    const message = [
      `To: ${data.customerEmail}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      emailBody.trim()
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

    console.log(`Unknown device quote email sent to ${data.customerEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send unknown device quote email:', error);
    return false;
  }
}

// Admin notification for unknown device quotes
export async function sendUnknownDeviceAdminNotification(data: UnknownDeviceQuoteEmailData & { customerPhone?: string }): Promise<boolean> {
  try {
    const adminEmailSetting = await storage.getMessageTemplate('admin_notification_email');
    if (!adminEmailSetting?.content) {
      console.log('Admin notification email not configured');
      return false;
    }
    
    const gmail = await getGmailClient();

    const subject = `New Unknown Device Quote Request - ${data.customerName}`;
    const emailBody = `New Unknown Device Quote Request Received

Customer Information:
- Name: ${data.customerName}
- Email: ${data.customerEmail}
- Phone: ${data.customerPhone || 'Not provided'}

Device Description: ${data.deviceDescription}

Issue Description: ${data.issueDescription}

-------------------
ACTION REQUIRED: Please contact this customer to provide a personalized quote.

This is an automated notification from RepairQuote.`;

    const messageHeaders = [
      `To: ${adminEmailSetting.content}`,
      `Subject: ${subject}`,
    ];
    
    if (data.customerEmail) {
      messageHeaders.push(`Reply-To: ${data.customerEmail}`);
    }
    
    messageHeaders.push('Content-Type: text/plain; charset=utf-8');
    
    const message = [...messageHeaders, '', emailBody].join('\n');

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

    console.log(`Unknown device admin notification sent to ${adminEmailSetting.content} (reply-to: ${data.customerEmail || 'none'})`);
    return true;
  } catch (error) {
    console.error('Failed to send unknown device admin notification:', error);
    return false;
  }
}

// Test email function - sends a test email with sample data
export async function sendTestEmail(recipientEmail: string): Promise<boolean> {
  const testData = {
    customerName: 'Test Customer',
    customerEmail: recipientEmail,
    deviceName: 'iPhone 15 Pro Max',
    services: [
      {
        serviceName: 'Screen Replacement',
        serviceDescription: 'Replace cracked or damaged screen',
        price: '$299.99',
        repairTime: '1-2 hours',
        warranty: '90 days'
      },
      {
        serviceName: 'Battery Replacement',
        serviceDescription: 'Replace worn battery',
        price: '$89.99',
        repairTime: '30 minutes',
        warranty: '60 days'
      }
    ],
    grandTotal: '$389.98'
  };

  console.log(`Sending test email to ${recipientEmail}...`);
  return await sendCombinedQuoteEmail(testData);
}

// Send API error notification to admin
export async function sendApiErrorNotification(serviceName: string, errorMessage: string, endpoint?: string): Promise<boolean> {
  try {
    const adminEmailSetting = await storage.getMessageTemplate('admin_notification_email');
    if (!adminEmailSetting?.content) {
      console.log('Admin notification email not configured - skipping API error notification');
      return false;
    }
    
    const gmail = await getGmailClient();
    
    const subject = `⚠️ API Error: ${serviceName}`;
    const emailBody = `API Error Notification

Service: ${serviceName}
Time: ${new Date().toLocaleString()}
${endpoint ? `Endpoint: ${endpoint}` : ''}

Error Details:
${errorMessage}

-------------------
This is an automated notification from RepairQuote.
Please check the integration settings and connection status.`;

    const messageHeaders = [
      `To: ${adminEmailSetting.content}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${subject}`,
    ].join('\r\n');

    const message = `${messageHeaders}\r\n\r\n${emailBody}`;
    const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });

    console.log(`API error notification sent to ${adminEmailSetting.content}`);
    return true;
  } catch (error) {
    console.error('Failed to send API error notification:', error);
    return false;
  }
}
