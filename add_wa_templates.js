const fs = require('fs');
let code = fs.readFileSync('server/db.js', 'utf8');

const waTemplates = `
  // 10 WHATSAPP TEMPLATES
  await insertTemp('WA: 1. Quick Intro', 'WhatsApp', 'Initial Intro', 'Hi {name}, Vasu Jain from Subh Homes here! 🏡 Received your inquiry. Let me know a good time to share some exclusive listings tailored to your budget.');
  await insertTemp('WA: 2. Share Property Link', 'WhatsApp', 'Properties', 'Hi {name}, check out this stunning new launch in Whitefield: [Link]. It perfectly matches your 3BHK requirement. Let me know if you want the floor plans! 🏢');
  await insertTemp('WA: 3. Site Visit Confirmation', 'WhatsApp', 'Lead Nurture', 'Hello {name}! Confirming our site visit for tomorrow at 11 AM at Prestige Lakeside. 📍 Location pin: [Google Maps Link]. See you there!');
  await insertTemp('WA: 4. Following up post-visit', 'WhatsApp', 'Followup', 'Hi {name}, hope you loved the property tour today! ✨ Let me know if you have any questions about the payment schedule or if you want to proceed with booking a unit.');
  await insertTemp('WA: 5. Urgent Price Drop', 'WhatsApp', 'Negotiation', '🚨 Flash Update {name}! The developer just announced a temporary 5% price drop on the 3BHK units we saw. Valid only till Sunday. Should we lock one in?');
  await insertTemp('WA: 6. Project RERA Update', 'WhatsApp', 'Market Update', 'Hi {name}, great news! The project we discussed just received its official RERA certification. ✅ Here is the registration number: [Number]. Safe to proceed!');
  await insertTemp('WA: 7. Document Checklist', 'WhatsApp', 'Operations', 'Hi {name}, for the booking process tomorrow, please bring: 1) PAN Card, 2) Aadhar Card, 3) 2 Passport Photos, 4) Cheque book. 📝');
  await insertTemp('WA: 8. Loan Approval Connect', 'WhatsApp', 'Operations', 'Hello {name}, our banking partner from HDFC is ready to process your pre-approval. Can I share your contact number with them to initiate the KYC? 🏦');
  await insertTemp('WA: 9. Festive Offer Blast', 'WhatsApp', 'Re-engagement', '🎉 Festive Special! Subh Homes is offering zero-brokerage on select Grade-A projects this Diwali. Let me know if you are still looking for an investment! 🪔');
  await insertTemp('WA: 10. Registration Congrats', 'WhatsApp', 'After-Sales', 'Congratulations {name}! 🎊 The registration is officially complete. We will drop off the original documents and possession keys tomorrow morning. Welcome home! 🏡');

  console.log('Seeded 30 premium communication templates.');
`;

code = code.replace(/console\.log\('Seeded 30 premium communication templates\.'\);/, waTemplates);
fs.writeFileSync('server/db.js', code);
