// SMS integration via Zapier webhook for OpenPhone
// Configure ZAPIER_WEBHOOK_URL environment variable

interface QuoteSmsData {
  customerName: string;
  customerPhone: string;
  deviceName: string;
  serviceName: string;
  price: string;
  repairTime?: string;
  warranty?: string;
}

export async function sendQuoteSms(data: QuoteSmsData): Promise<boolean> {
  const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('ZAPIER_WEBHOOK_URL not configured - SMS not sent');
    return false;
  }

  if (!data.customerPhone) {
    console.log('No phone number provided - SMS not sent');
    return false;
  }

  try {
    const message = `Hi ${data.customerName}! Your RepairQuote: ${data.serviceName} for ${data.deviceName} - $${data.price}${data.repairTime ? `. Time: ${data.repairTime}` : ''}${data.warranty ? `. Warranty: ${data.warranty}` : ''}. Reply for more info!`;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: data.customerPhone,
        message: message,
        customerName: data.customerName,
        deviceName: data.deviceName,
        serviceName: data.serviceName,
        price: data.price,
        repairTime: data.repairTime || '',
        warranty: data.warranty || ''
      })
    });

    if (response.ok) {
      console.log(`Quote SMS webhook triggered for ${data.customerPhone}`);
      return true;
    } else {
      console.error('Zapier webhook failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('Failed to trigger SMS webhook:', error);
    return false;
  }
}
